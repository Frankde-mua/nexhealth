import { DatabaseSync } from "node:sqlite";
import pg from "pg";
if (!process.env.DATABASE_URL || !process.argv[2])
  throw Error(
    "Usage: node --env-file=.env scripts/import-sqlite.mjs path/to/network.sqlite",
  );
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const state = JSON.parse(
  db.prepare("SELECT payload FROM state WHERE id=1").get().payload,
);
db.close();
state.sessions = [];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS state (id integer PRIMARY KEY,payload jsonb NOT NULL)",
  );
  const r = await pool.query(
    "INSERT INTO state VALUES (1,$1) ON CONFLICT DO NOTHING",
    [JSON.stringify(state)],
  );
  if (!r.rowCount)
    throw Error("Target already initialized; no data overwritten");
  console.log("Imported; sessions cleared");
} finally {
  await pool.end();
}
