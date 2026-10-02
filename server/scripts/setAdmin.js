// Promote/demote an admin by email:  npm run set-admin -- you@example.com
// Optional second arg demotes:       npm run set-admin -- you@example.com false
import { one, pool } from "../src/db.js";
import { validateEnvOrExit } from "../src/env.js";

const email = process.argv[2];
const grant = process.argv[3] === undefined ? true : !/^(false|0|no|off)$/i.test(process.argv[3]);

if (!email) {
  console.error("Usage: npm run set-admin -- <email> [true|false]");
  process.exit(1);
}

validateEnvOrExit();

const updated = await one(
  "UPDATE profiles SET is_admin = $2, updated_at = now() WHERE lower(email) = lower($1) RETURNING id, email, is_admin",
  [email, grant],
);

if (!updated) {
  console.error(`No profile found for ${email}.`);
  console.error("The user must sign in once so a profile row is created.");
  await pool.end();
  process.exit(1);
}

console.log(`${updated.is_admin ? "granted" : "revoked"} admin for ${updated.email} (${updated.id})`);
await pool.end();
