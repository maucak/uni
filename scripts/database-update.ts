import { useLocalDatabase } from "./environment.ts";
await useLocalDatabase();
const { pool } = await import("../server/db.ts");
try {
  const { migrate } = await import("./migrate.ts");
  await migrate();
} finally {
  await pool.end();
}
