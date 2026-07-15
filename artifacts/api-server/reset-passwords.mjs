/**
 * Reset all center and super-admin passwords.
 * Run from the project root:
 *   pnpm --filter @workspace/api-server run reset-passwords
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import pkg from "pg";

const { Pool } = pkg;

// Load .env from project root (two levels up from artifacts/api-server)
try {
  const envPath = resolve(process.cwd(), "..", "..", ".env");
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — fall back to env vars already in the environment
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to your .env file or export it.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CENTERS = [
  { center_id: "DWK-1",  password: "Center@DWK1"  },
  { center_id: "CI-2",  password: "Center@CI2"  },
  { center_id: "Home",  password: "Center@Home" },
];
const SUPER_PASSWORD = "SuperAdmin@123";

async function run() {
  console.log("Resetting passwords...\n");

  const superHash = await bcrypt.hash(SUPER_PASSWORD, 10);
  await pool.query(
    `INSERT INTO super_admin_auth (id, password_hash)
     VALUES ('superadmin', $1)
     ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [superHash]
  );
  console.log(`  Super Admin    ->  ${SUPER_PASSWORD}`);

  for (const { center_id, password } of CENTERS) {
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await pool.query(
      `UPDATE center_auth SET password_hash = $1 WHERE center_id = $2`,
      [hash, center_id]
    );
    if (rowCount === 0) {
      await pool.query(
        `INSERT INTO center_auth (center_id, password_hash) VALUES ($1, $2)`,
        [center_id, hash]
      );
    }
    console.log(`  ${center_id.padEnd(8)}         ->  ${password}`);
  }

  console.log("\nDone.");
  await pool.end();
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
