import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import pg from "pg";
// Windows has no Unix root/uid concept. Manage the supplied binaries directly
// rather than querying OS user information for a Unix-only root check.
export class WindowsPostgres {
  private started = false;
  private directory: string;
  private password: string;
  private port: number;
  constructor(directory: string, password: string, port: number) {
    this.directory = directory;
    this.password = password;
    this.port = port;
  }
  private async binaries() {
    const name = "@embedded-postgres/windows-x64";
    return (await import(name)) as {
      initdb: string;
      postgres: string;
      pg_ctl: string;
    };
  }
  private async run(binary: string, args: string[]) {
    await new Promise<void>((res, rej) => {
      const p = spawn(binary, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      p.stdout.on("data", (s) => (output += s));
      p.stderr.on("data", (s) => (output += s));
      p.once("error", rej);
      p.once("exit", (code) =>
        code === 0 ? res() : rej(new Error(`PostgreSQL (${code}): ${output}`)),
      );
    });
  }
  async initialise() {
    const { initdb } = await this.binaries();
    await this.run(initdb, [
      "-D",
      this.directory,
      "-U",
      "postgres",
      "--auth=scram-sha-256",
      `--pwfile=${resolve("var/database-password")}`,
      "--encoding=UTF8",
      "--locale=C",
    ]);
  }
  async start() {
    const { pg_ctl } = await this.binaries();
    const logPath = resolve("var/postgres-startup.log");
    // pg_ctl creates the restricted Windows token required by PostgreSQL.
    // Starting postgres.exe directly from an elevated shell is rejected.
    try {
      await this.run(pg_ctl, [
        "-D",
        this.directory,
        "-l",
        logPath,
        "-o",
        `-h 127.0.0.1 -p ${this.port}`,
        "-w",
        "-t",
        "15",
        "start",
      ]);
      this.started = true;
      const client = this.getPgClient();
      try {
        await client.connect();
        const result = await client.query("SHOW data_directory");
        if (
          resolve(result.rows[0].data_directory).toLowerCase() !==
          resolve(this.directory).toLowerCase()
        )
          throw new Error("Portta farklı bir PostgreSQL kümesi çalışıyor.");
      } finally {
        await client.end();
      }
    } catch (error) {
      const log = await readFile(logPath, "utf8").catch(() => "");
      throw new Error(
        `${error instanceof Error ? error.message : error}\n${log.slice(-4000)}\nWindows'ta yönetici olarak açılmamış normal PowerShell kullanın.`,
      );
    }
  }
  getPgClient(database = "postgres", host = "127.0.0.1") {
    return new pg.Client({
      user: "postgres",
      password: this.password,
      port: this.port,
      host,
      database,
      connectionTimeoutMillis: 500,
    });
  }
  async stop() {
    if (!this.started) return;
    const { pg_ctl } = await this.binaries();
    await this.run(pg_ctl, ["-D", this.directory, "-m", "fast", "-w", "stop"]);
    this.started = false;
  }
}
