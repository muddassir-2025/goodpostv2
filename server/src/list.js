import { buildQuery } from "./query.js";
import { many, one } from "./db.js";

const ALLOWED_TABLES = new Set([
  "posts",
  "comments",
  "likes",
  "favorites",
  "follows",
  "conversations",
  "messages",
  "notifications",
  "stories",
]);

/**
 * List rows for a table using Appwrite-style queries.
 * `table` is always an internal constant (whitelisted), never user input.
 */
export async function listTable(table, queries = [], { defaultOrder = "" } = {}) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Unknown table: ${table}`);

  const q = buildQuery(table, queries, 1);
  // Never let a caller request an unbounded page.
  const limit = q.limit == null ? 100 : Math.min(Math.max(q.limit, 1), 200);
  const countRow = await one(
    `SELECT COUNT(*)::int AS total FROM ${table} ${q.where}`,
    q.params,
  );

  const params = [...q.params];
  let sql = `SELECT * FROM ${table} ${q.where} ${q.order || defaultOrder}`;
  params.push(limit);
  sql += ` LIMIT $${params.length}`;
  if (q.offset) {
    params.push(q.offset);
    sql += ` OFFSET $${params.length}`;
  }

  const rows = await many(sql, params);
  return { rows, total: countRow?.total ?? rows.length };
}
