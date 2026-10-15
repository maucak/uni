import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { WindowsPostgres } from "./local-postgres.ts";
let database: EmbeddedPostgres | WindowsPostgres | undefined;
const children: ChildProcess[] = [];
let closing = false;
const npmEntry = process.env.npm_execpath;
if (!npmEntry) throw new Error("npm run dev ile çalıştırın.");
async function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    const ended = new Promise<void>((res) => {
      child.once("exit", () => res());
      setTimeout(res, 4000).unref();
    });
    if (process.platform === "win32")
      await new Promise<void>((res) => {
        const task = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { stdio: "ignore", windowsHide: true },
        );
        task.on("error", () => res());
        task.on("exit", () => res());
      });
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill();
      }
    }
    await ended;
  }
  if (database)
    await database
      .stop()
      .catch((e) => console.error("PostgreSQL kapatma:", e.message));
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
async function localSecret(path: string, length: number) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const value = randomBytes(length).toString("hex");
    await writeFile(path, value, { flag: "wx", mode: 0o600 });
    return value;
  }
}
function launch(script: string) {
  const child = spawn(process.execPath, [npmEntry!, "run", script], {
    stdio: "inherit",
    env: process.env,
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  children.push(child);
  return child;
}
async function run(script: string) {
  await new Promise<void>((res, rej) => {
    const child = launch(script);
    child.once("error", rej);
    child.once("exit", (code) =>
      code === 0 ? res() : rej(new Error(`${script} başarısız (${code})`)),
    );
  });
}
try {
  await mkdir("var", { recursive: true, mode: 0o700 });
  if (!process.env.JWT_SECRET)
    process.env.JWT_SECRET = await localSecret("var/jwt-secret", 48);
  if (!process.env.DATABASE_URL) {
    const password = await localSecret("var/database-password", 32);
    const port = Number(process.env.LOCAL_PG_PORT || 55432);
    database =
      process.platform === "win32"
        ? new WindowsPostgres(resolve("var/postgres"), password, port)
        : new EmbeddedPostgres({
            databaseDir: resolve("var/postgres"),
            user: "postgres",
            password,
            port,
            persistent: true,
            authMethod: "scram-sha-256",
            initdbFlags: ["--encoding=UTF8", "--locale=C"],
            postgresFlags: ["-h", "127.0.0.1", "-k", resolve("var")],
            onLog: () => {},
            onError: (message) => console.error(String(message)),
          });
    try {
      await access("var/postgres/PG_VERSION");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      await database.initialise();
    }
    await database.start();
    const client = database.getPgClient("postgres", "127.0.0.1");
    await client.connect();
    try {
      if (
        !(
          await client.query(
            "SELECT 1 FROM pg_database WHERE datname='kampuspusula'",
          )
        ).rowCount
      )
        await client.query("CREATE DATABASE kampuspusula");
    } finally {
      await client.end();
    }
    process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${port}/kampuspusula`;
    console.log("Yerel PostgreSQL hazır. Veriler var/postgres içinde kalıcı.");
  }
  await run("db:migrate");
  if (database) {
    await run("db:seed");
    await run("catalog:pilot");
    await run("catalog:osym");
  }
  for (const script of ["dev:api", "dev:web"]) {
    const child = launch(script);
    child.once("error", (e) => {
      console.error(e.message);
      void stop(1);
    });
    child.once("exit", (code) => {
      if (!closing) void stop(code ?? 1);
    });
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  await stop(1);
}
