import test from "node:test";
import assert from "node:assert/strict";

// Force the pool to point at nowhere so these tests never reach a real database.
process.env.DATABASE_URL = "";

const { listTable } = await import("../src/list.js");

test("listTable rejects tables that are not on the whitelist", async () => {
  await assert.rejects(() => listTable("information_schema.tables", []), /Unknown table/);
  await assert.rejects(() => listTable("profiles; DROP TABLE posts", []), /Unknown table/);
  await assert.rejects(() => listTable("pg_catalog.pg_tables", []), /Unknown table/);
});

test("listTable accepts every whitelisted table name", async () => {
  const tables = [
    "posts",
    "comments",
    "likes",
    "favorites",
    "follows",
    "conversations",
    "messages",
    "notifications",
    "stories",
  ];

  for (const table of tables) {
    // The whitelist check must pass; any later failure is a database error,
    // which is expected here because there is no database configured.
    const error = await listTable(table, []).then(
      () => null,
      (err) => err,
    );
    if (error) assert.doesNotMatch(error.message, /Unknown table/);
  }
});
