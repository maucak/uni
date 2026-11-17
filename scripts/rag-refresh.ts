// Fetch first, then import the newly written snapshot in the indexer.
const { runSync } = await import("./life-sync.ts");
await runSync(process.argv.find((a) => a.startsWith("--source="))?.slice(9));
await import("./rag-index.ts");
if (process.env.RAG_SEARCH_BACKEND === "qdrant") {
  // The PostgreSQL index CLI closes its pool; publication gets its own process/pool.
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const task = spawn(process.execPath, ["scripts/rag-qdrant-index.ts"], {
      stdio: "inherit",
      env: process.env,
    });
    task.once("error", reject);
    task.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Qdrant yayını başarısız (${code}).`)),
    );
  });
}
export {};
