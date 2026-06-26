import pg from "pg";
import path from "path";
import { existsSync } from "fs";
import { logger } from "./logger";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return result.rows[0] ?? null;
}

async function createTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS centers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      date_of_joining TEXT,
      height_cm INTEGER
    );

    CREATE TABLE IF NOT EXISTS member_center_mapping (
      member_id INTEGER REFERENCES members(id),
      center_id TEXT REFERENCES centers(id),
      PRIMARY KEY (member_id, center_id)
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id SERIAL PRIMARY KEY,
      member_id INTEGER REFERENCES members(id),
      center_id TEXT REFERENCES centers(id),
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      weight_kg REAL,
      bmi REAL,
      resting_hr INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS consumption_logs (
      id SERIAL PRIMARY KEY,
      member_id INTEGER REFERENCES members(id),
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      meal_slot TEXT,
      food_item TEXT NOT NULL,
      quantity_g REAL,
      calories_kcal REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL
    );

    CREATE TABLE IF NOT EXISTS bom_items (
      id SERIAL PRIMARY KEY,
      plan_name TEXT,
      food_item TEXT NOT NULL,
      quantity_g REAL,
      calories_kcal REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL
    );

    CREATE TABLE IF NOT EXISTS pack_sizes (
      id SERIAL PRIMARY KEY,
      item_name TEXT NOT NULL,
      pack_label TEXT,
      weight_g REAL,
      calories_kcal REAL
    );

    CREATE TABLE IF NOT EXISTS issuances (
      id SERIAL PRIMARY KEY,
      member_id INTEGER REFERENCES members(id),
      center_id TEXT REFERENCES centers(id),
      pack_label TEXT,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS _seed_done (
      done INTEGER PRIMARY KEY
    );
  `);
}

function toDateStr(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.substring(0, 10);
  if (typeof val === "number") {
    const epoch = new Date(1900, 0, 0);
    const ms = (val - 1) * 86400000;
    return new Date(epoch.getTime() + ms).toISOString().substring(0, 10);
  }
  if (val instanceof Date) return val.toISOString().substring(0, 10);
  return String(val).substring(0, 10);
}

function toDateTimeStr(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (typeof val === "number") {
    const epoch = new Date(1900, 0, 0);
    const ms = (val - 1) * 86400000;
    return new Date(epoch.getTime() + ms).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return new Date().toISOString();
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

async function seedFromXlsx(): Promise<void> {
  const done = await queryOne("SELECT done FROM _seed_done WHERE done = 1");
  if (done) return;

  const XLSX_PATH = path.resolve(process.cwd(), "data", "composition.xlsx");

  if (!existsSync(XLSX_PATH)) {
    logger.warn({ path: XLSX_PATH }, "composition.xlsx not found, inserting defaults");
    await pool.query(`
      INSERT INTO members (id, name, date_of_joining, height_cm) VALUES (1, 'Demo Member', '2024-01-01', 170) ON CONFLICT DO NOTHING;
      INSERT INTO centers (id, name) VALUES ('CI-1', 'Center CI-1'), ('CI-2', 'Center CI-2'), ('Home', 'Home') ON CONFLICT DO NOTHING;
      INSERT INTO member_center_mapping (member_id, center_id) VALUES (1, 'CI-1'), (1, 'Home') ON CONFLICT DO NOTHING;
      INSERT INTO _seed_done (done) VALUES (1) ON CONFLICT DO NOTHING;
    `);
    return;
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.readFile(XLSX_PATH);

  // Member-Center Mapping sheet
  const mappingSheet = workbook.Sheets["Member-Center Mapping"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (mappingSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(mappingSheet, { defval: null });
    for (const row of rows) {
      const memberId = toNum(row["Member ID"] ?? row["member_id"] ?? row["id"]);
      const memberName = String(row["Member Name"] ?? row["name"] ?? row["Member"] ?? "Unknown");
      const centerId = String(row["Center ID"] ?? row["center_id"] ?? "CI-1");
      const centerName = String(row["Center Name"] ?? row["center"] ?? centerId);
      const doj = toDateStr(row["Date of Joining"] ?? row["date_of_joining"]);
      const height = toNum(row["Height (cm)"] ?? row["height_cm"] ?? row["Height"]);
      if (!memberId) continue;
      await pool.query(`INSERT INTO members (id, name, date_of_joining, height_cm) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [memberId, memberName, doj, height]);
      await pool.query(`INSERT INTO centers (id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [centerId, centerName]);
      await pool.query(`INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [memberId, centerId]);
    }
  }

  // Health Records
  const healthSheet = workbook.Sheets["HealthRecord"] ?? workbook.Sheets["Health Records"];
  if (healthSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(healthSheet, { defval: null });
    for (const row of rows) {
      const memberId = toNum(row["Member ID"] ?? row["member_id"]);
      if (!memberId) continue;
      await pool.query(
        `INSERT INTO health_records (member_id, center_id, recorded_at, weight_kg, bmi, resting_hr, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [memberId, row["Center ID"] ?? row["center_id"] ?? null, toDateTimeStr(row["Recorded At"] ?? row["recorded_at"] ?? row["Date"]),
         toNum(row["Weight (kg)"] ?? row["weight_kg"] ?? row["Weight"]),
         toNum(row["BMI"] ?? row["bmi"]),
         toNum(row["Resting HR"] ?? row["resting_hr"] ?? row["HR"]),
         row["Notes"] ?? null]
      );
    }
  }

  // Consumption logs
  const consumptionSheet = workbook.Sheets["Consumtion"] ?? workbook.Sheets["Consumption"] ?? workbook.Sheets["consumption_logs"];
  if (consumptionSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(consumptionSheet, { defval: null });
    for (const row of rows) {
      const memberId = toNum(row["Member ID"] ?? row["member_id"]);
      if (!memberId) continue;
      await pool.query(
        `INSERT INTO consumption_logs (member_id, logged_at, meal_slot, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [memberId, toDateTimeStr(row["Logged At"] ?? row["logged_at"] ?? row["Date"]),
         String(row["Meal Slot"] ?? row["meal_slot"] ?? "Breakfast"),
         String(row["Food Item"] ?? row["food_item"] ?? "Unknown"),
         toNum(row["Quantity (g)"] ?? row["quantity_g"] ?? row["Qty"]),
         toNum(row["Calories (kcal)"] ?? row["calories_kcal"] ?? row["Calories"]),
         toNum(row["Protein (g)"] ?? row["protein_g"] ?? row["Protein"]),
         toNum(row["Carbs (g)"] ?? row["carbs_g"] ?? row["Carbs"]),
         toNum(row["Fat (g)"] ?? row["fat_g"] ?? row["Fat"])]
      );
    }
  }

  // BOM
  const bomSheet = workbook.Sheets["BOM"] ?? workbook.Sheets["bom"];
  if (bomSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(bomSheet, { defval: null });
    for (const row of rows) {
      const foodItem = String(row["Food Item"] ?? row["food_item"] ?? row["Item"] ?? "");
      if (!foodItem) continue;
      await pool.query(
        `INSERT INTO bom_items (plan_name, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [row["Plan Name"] ?? row["plan_name"] ?? row["Plan"] ?? null, foodItem,
         toNum(row["Quantity (g)"] ?? row["quantity_g"] ?? row["Qty"]),
         toNum(row["Calories (kcal)"] ?? row["calories_kcal"] ?? row["Calories"]),
         toNum(row["Protein (g)"] ?? row["protein_g"] ?? row["Protein"]),
         toNum(row["Carbs (g)"] ?? row["carbs_g"] ?? row["Carbs"]),
         toNum(row["Fat (g)"] ?? row["fat_g"] ?? row["Fat"])]
      );
    }
  }

  // Pack Sizes
  const packSheet = workbook.Sheets["PackSize"] ?? workbook.Sheets["Pack Sizes"];
  if (packSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(packSheet, { defval: null });
    for (const row of rows) {
      const itemName = String(row["Item Name"] ?? row["item_name"] ?? row["Item"] ?? "");
      if (!itemName) continue;
      await pool.query(
        `INSERT INTO pack_sizes (item_name, pack_label, weight_g, calories_kcal) VALUES ($1,$2,$3,$4)`,
        [itemName, row["Pack Label"] ?? row["pack_label"] ?? null,
         toNum(row["Weight (g)"] ?? row["weight_g"] ?? row["Weight"]),
         toNum(row["Calories (kcal)"] ?? row["calories_kcal"] ?? row["Calories"])]
      );
    }
  }

  // Issuances
  const issuanceSheet = workbook.Sheets["Issuing "] ?? workbook.Sheets["Issuing"] ?? workbook.Sheets["Issuances"];
  if (issuanceSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(issuanceSheet, { defval: null });
    for (const row of rows) {
      const memberId = toNum(row["Member ID"] ?? row["member_id"]);
      if (!memberId) continue;
      await pool.query(
        `INSERT INTO issuances (member_id, center_id, pack_label, issued_at, status) VALUES ($1,$2,$3,$4,$5)`,
        [memberId, row["Center ID"] ?? row["center_id"] ?? null,
         row["Pack Label"] ?? row["pack_label"] ?? null,
         toDateTimeStr(row["Issued At"] ?? row["issued_at"] ?? row["Date"]),
         row["Status"] ?? row["status"] ?? "Issued"]
      );
    }
  }

  // Default member if nothing seeded
  const { rows } = await pool.query("SELECT COUNT(*) as c FROM members");
  if (Number(rows[0].c) === 0) {
    await pool.query(`
      INSERT INTO members (id, name, date_of_joining, height_cm) VALUES (1, 'Demo Member', '2024-01-01', 170) ON CONFLICT DO NOTHING;
      INSERT INTO centers (id, name) VALUES ('CI-1', 'Center CI-1'), ('CI-2', 'Center CI-2'), ('Home', 'Home') ON CONFLICT DO NOTHING;
      INSERT INTO member_center_mapping (member_id, center_id) VALUES (1, 'CI-1') ON CONFLICT DO NOTHING;
    `);
  }

  await pool.query("INSERT INTO _seed_done (done) VALUES (1) ON CONFLICT DO NOTHING");
  logger.info("Database seeded from composition.xlsx");
}

export async function initDb(): Promise<void> {
  await createTables();
  await seedFromXlsx();
}
