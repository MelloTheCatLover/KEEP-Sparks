import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "./config/db";

// Idempotent migration runner. Applied files are tracked in `_migrations`;
// re-running skips them. Each file runs inside its own transaction.
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function run(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  const applied = new Set<string>(
    (await pool.query<{ name: string }>("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`failed ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(count === 0 ? "no pending migrations" : `applied ${count} migration(s)`);
}

run()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
