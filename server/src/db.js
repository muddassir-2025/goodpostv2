import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

// Neon requires SSL. The pooled connection string already includes sslmode=require,
// but we set rejectUnauthorized:false so Render's outbound TLS works without a CA bundle.
export const pool = new Pool({
  connectionString: env.databaseUrl || undefined,
  ssl: env.databaseUrl?.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 10,
});

export function query(text, params = []) {
  return pool.query(text, params);
}

export async function one(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

export async function many(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}
