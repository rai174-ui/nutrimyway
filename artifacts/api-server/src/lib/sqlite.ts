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

async function migrateColumns(): Promise<void> {
  const newCols = [
    "ALTER TABLE health_records ADD COLUMN IF NOT EXISTS body_fat_pct REAL",
    "ALTER TABLE health_records ADD COLUMN IF NOT EXISTS visceral_fat REAL",
    "ALTER TABLE health_records ADD COLUMN IF NOT EXISTS bmr REAL",
    "ALTER TABLE health_records ADD COLUMN IF NOT EXISTS metabolic_age INTEGER",
    "ALTER TABLE health_records ADD COLUMN IF NOT EXISTS muscle_mass_kg REAL",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS mobile TEXT",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_no TEXT",
    "ALTER TABLE otps ADD COLUMN IF NOT EXISTS email TEXT",
    "ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS email TEXT",
    // Allow mobile to be NULL so email-only OTPs/registrations work
    "ALTER TABLE otps ALTER COLUMN mobile DROP NOT NULL",
    "ALTER TABLE user_auth ALTER COLUMN mobile DROP NOT NULL",
  ];
  for (const sql of newCols) {
    await pool.query(sql);
  }
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS members_mobile_uidx ON members (mobile) WHERE mobile IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS members_email_uidx ON members (email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS members_membership_no_uidx ON members (membership_no) WHERE membership_no IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS user_auth_email_uidx ON user_auth (email) WHERE email IS NOT NULL;
  `);
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
      body_fat_pct REAL,
      visceral_fat REAL,
      bmr REAL,
      bmi REAL,
      metabolic_age INTEGER,
      muscle_mass_kg REAL,
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

    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
      mobile TEXT,
      email TEXT,
      otp TEXT NOT NULL,
      otp_token TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS user_auth (
      id SERIAL PRIMARY KEY,
      mobile TEXT,
      email TEXT,
      member_id INTEGER REFERENCES members(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS center_auth (
      center_id TEXT PRIMARY KEY REFERENCES centers(id),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS center_broadcast_settings (
      center_id TEXT PRIMARY KEY REFERENCES centers(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      schedule_time TEXT NOT NULL DEFAULT '09:00',
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      retention_days INTEGER NOT NULL DEFAULT 7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS member_broadcasts (
      id SERIAL PRIMARY KEY,
      center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_by TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS member_broadcasts_center_idx ON member_broadcasts(center_id);
    CREATE INDEX IF NOT EXISTS member_broadcasts_sent_idx ON member_broadcasts(sent_at DESC);

    CREATE TABLE IF NOT EXISTS member_broadcast_reads (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      broadcast_id INTEGER NOT NULL REFERENCES member_broadcasts(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(member_id, broadcast_id)
    );
    CREATE INDEX IF NOT EXISTS member_broadcast_reads_member_idx ON member_broadcast_reads(member_id);

    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      center_id TEXT NOT NULL REFERENCES centers(id),
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS menu_item_bom (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      ingredient TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'g',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function migrateAdminTables(): Promise<void> {
  await pool.query(`
    ALTER TABLE consumption_logs ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES menu_items(id);
  `);
  // Unique constraint prevents duplicate menu item names per center (protects name-fallback match)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS menu_items_center_name_uidx
    ON menu_items (center_id, LOWER(name));
  `);
}

async function migrateAdminTables3(): Promise<void> {
  // Check-in / check-out log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_check_ins (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id),
      center_id TEXT NOT NULL REFERENCES centers(id),
      checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checked_out_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS member_check_ins_active_idx
    ON member_check_ins (member_id) WHERE checked_out_at IS NULL
  `);
  // Make members.id auto-increment so admin can onboard new members
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS members_id_seq`);
  const { rows } = await pool.query(`SELECT MAX(id) as max FROM members`);
  const maxId = Number(rows[0]?.max ?? 0);
  await pool.query(`SELECT setval('members_id_seq', $1)`, [Math.max(maxId, 1)]);
  await pool.query(`ALTER TABLE members ALTER COLUMN id SET DEFAULT nextval('members_id_seq')`);
}

async function migrateAdminTables2(): Promise<void> {
  // Add is_active flag to centers so super admin can enable/disable them
  await pool.query(`
    ALTER TABLE centers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
  `);
  // Super admin credentials (single row, id = 'superadmin')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS super_admin_auth (
      id TEXT PRIMARY KEY DEFAULT 'superadmin',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function seedSuperAdmin(): Promise<void> {
  const { default: bcrypt } = await import("bcryptjs");
  const { rows } = await pool.query("SELECT id FROM super_admin_auth WHERE id = 'superadmin'");
  if (!rows[0]) {
    const password = generateCenterPassword();
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO super_admin_auth (id, password_hash) VALUES ('superadmin', $1) ON CONFLICT DO NOTHING",
      [hash]
    );
    logger.info({ initialPassword: password },
      "Super admin credentials seeded — save this password, it will not be shown again");
  }
}

function generateCenterPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

async function seedCenterPasswords(): Promise<void> {
  const { default: bcrypt } = await import("bcryptjs");
  const { rows: centers } = await pool.query("SELECT id, name FROM centers");

  for (const center of centers) {
    const { rows } = await pool.query(
      "SELECT center_id FROM center_auth WHERE center_id = $1",
      [center.id]
    );
    if (!rows[0]) {
      const password = generateCenterPassword();
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO center_auth (center_id, password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [center.id, hash]
      );
      // Log password once at startup — staff must retrieve it from server logs
      logger.info({ centerId: center.id, centerName: center.name, initialPassword: password },
        "Admin credentials seeded for center — save this password, it will not be shown again");
    }
  }
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

async function migrateAdminTables4(): Promise<void> {
  // Add kcal per ingredient to BOM rows
  await pool.query(`ALTER TABLE menu_item_bom ADD COLUMN IF NOT EXISTS kcal REAL`);
}

async function migrateAdminTables5(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      pack_size REAL NOT NULL DEFAULT 1,
      pack_unit TEXT NOT NULL DEFAULT 'g',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredient_batches (
      id SERIAL PRIMARY KEY,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      center_id TEXT NOT NULL REFERENCES centers(id),
      batch_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'consumed')),
      opened_at TIMESTAMPTZ,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_ingredient_batches_open
    ON ingredient_batches (ingredient_id, center_id)
    WHERE status = 'open'
  `);
}

async function migrateAdminTables6(): Promise<void> {
  // Link BOM rows to the ingredient master
  await pool.query(
    `ALTER TABLE menu_item_bom ADD COLUMN IF NOT EXISTS ingredient_id INTEGER REFERENCES ingredients(id)`
  );
  // Manual batch consumption recording (separate from member meal logs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_consumption_logs (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES ingredient_batches(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      notes TEXT,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrateAdminTables9(): Promise<void> {
  // Member DOB (day + month only, e.g. "15 Mar"), age at joining (decimal), and validity date
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS dob TEXT`);
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS age_at_joining REAL`);
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS valid_until DATE`);
}

async function migrateAdminTables10(): Promise<void> {
  // Active/inactive status for members (soft disable without deleting)
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);
}

async function migrateAdminTables11(): Promise<void> {
  // Item Master: material code, item description, flavour on ingredients
  await pool.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS material_code TEXT`);
  await pool.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS description TEXT`);
  await pool.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS flavour TEXT`);
}

async function migrateAdminTables12(): Promise<void> {
  // Menu item flavour variants — comma-separated list of available flavours per item
  await pool.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS flavours TEXT NOT NULL DEFAULT ''`);
}

async function migrateAdminTables13(): Promise<void> {
  // Track selected flavour on each consumption log entry
  await pool.query(`ALTER TABLE consumption_logs ADD COLUMN IF NOT EXISTS selected_flavour TEXT`);
}

async function migrateAdminTables15(): Promise<void> {
  // Cancel check-in: mark a visit as cancelled so no consumption is booked
  await pool.query(`ALTER TABLE member_check_ins ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT FALSE`);
}

async function migrateAdminTables14(): Promise<void> {
  // Member-assigned batches: a pack issued directly to a specific member
  await pool.query(`ALTER TABLE ingredient_batches ADD COLUMN IF NOT EXISTS assigned_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE ingredient_batches ADD COLUMN IF NOT EXISTS assigned_member_name TEXT`);
  // Relax the one-open-per-ingredient constraint so member packs can coexist with center-stock
  await pool.query(`DROP INDEX IF EXISTS uidx_ingredient_batches_open`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_ingredient_batches_open_center
    ON ingredient_batches (ingredient_id, center_id)
    WHERE status = 'open' AND assigned_member_id IS NULL
  `);
  // Batch adjustments: ± corrections on open batches with mandatory note
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_adjustments (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES ingredient_batches(id) ON DELETE CASCADE,
      qty_change NUMERIC(10,3) NOT NULL,
      note TEXT,
      adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrateAdminTables8(): Promise<void> {
  // Center access validity date — blocks login after this date when set
  await pool.query(`ALTER TABLE center_auth ADD COLUMN IF NOT EXISTS valid_until DATE`);
  // Super admin password reset tokens (one-time, 1-hour expiry)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS super_admin_reset_tokens (
      token TEXT PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrateAdminTables7(): Promise<void> {
  // Mandatory flag on menu items (e.g. "Afresh" drink always included)
  await pool.query(
    `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT FALSE`
  );
  // Per-visit menu selections: what each checked-in member had during their session
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visit_menu_selections (
      id SERIAL PRIMARY KEY,
      checkin_id INTEGER NOT NULL REFERENCES member_check_ins(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(checkin_id, menu_item_id)
    )
  `);
}

export async function initDb(): Promise<void> {
  await createTables();
  await migrateColumns();
  await seedFromXlsx();
  await migrateAdminTables();
  await migrateAdminTables2();
  await migrateAdminTables3();
  await migrateAdminTables4();
  await migrateAdminTables5();
  await migrateAdminTables6();
  await migrateAdminTables7();
  await migrateAdminTables8();
  await migrateAdminTables9();
  await migrateAdminTables10();
  await migrateAdminTables11();
  await migrateAdminTables12();
  await migrateAdminTables13();
  await migrateAdminTables14();
  await migrateAdminTables15();
  await migrateAdminTables16();
  await migrateAdminTables17();
  await migrateAdminTables18();
  await migrateAdminTables19();
  await migrateAdminTables20();
  await migrateAdminTables21();
  await migrateAdminTables22();
  await migrateAdminTables23();
  await migrateAdminTables24();
  await migrateAdminTables25();
  await migrateAdminTables26();
  await migrateAdminTables27();
  await migrateAdminTables28();
  await migrateAdminTables29();
  await seedCenterPasswords();
  await seedSuperAdmin();
}

async function migrateAdminTables20(): Promise<void> {
  // Actual received quantity per batch — may differ from Item Master pack_size
  await pool.query(`ALTER TABLE ingredient_batches ADD COLUMN IF NOT EXISTS received_qty REAL`);
  await pool.query(`ALTER TABLE ingredient_batches ADD COLUMN IF NOT EXISTS received_unit TEXT`);
}

async function migrateAdminTables21(): Promise<void> {
  // Serving quantity per visit for flavoured items — how many units are consumed per member checkout
  await pool.query(`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS serving_qty REAL NOT NULL DEFAULT 1`);
}

async function migrateAdminTables23(): Promise<void> {
  // Link consumption log entries back to the check-in visit that generated them
  await pool.query(
    `ALTER TABLE consumption_logs ADD COLUMN IF NOT EXISTS checkin_id INTEGER REFERENCES member_check_ins(id) ON DELETE SET NULL`
  );
}

async function migrateAdminTables24(): Promise<void> {
  // Kcal per serving for direct-flavour ingredients so checkout can log calories
  await pool.query(
    `ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS kcal_per_serving REAL`
  );
}

async function migrateAdminTables25(): Promise<void> {
  // Per-center configurable auto-checkout window (minutes); default 180
  await pool.query(
    `ALTER TABLE centers ADD COLUMN IF NOT EXISTS auto_checkout_min INTEGER NOT NULL DEFAULT 180`
  );
}

async function migrateAdminTables26(): Promise<void> {
  // OTP-by-email auth: email is no longer unique, membership_no identifies the member
  await pool.query(`ALTER TABLE otps ADD COLUMN IF NOT EXISTS member_id INTEGER REFERENCES members(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE otps ADD COLUMN IF NOT EXISTS otp_token TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS otps_token_idx ON otps(otp_token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS otps_member_idx ON otps(member_id)`);
  // Drop unique constraints so multiple members can share the same email
  await pool.query(`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_uidx`);
  await pool.query(`DROP INDEX IF EXISTS members_email_uidx`);
  await pool.query(`ALTER TABLE user_auth DROP CONSTRAINT IF EXISTS user_auth_email_uidx`);
  await pool.query(`DROP INDEX IF EXISTS user_auth_email_uidx`);
  await pool.query(`ALTER TABLE user_auth DROP CONSTRAINT IF EXISTS user_auth_mobile_key`);
  await pool.query(`DROP INDEX IF EXISTS user_auth_mobile_key`);
  // Add non-unique indexes for lookups
  await pool.query(`CREATE INDEX IF NOT EXISTS members_email_idx ON members(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS members_membership_no_idx ON members(membership_no)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS user_auth_email_idx ON user_auth(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS user_auth_mobile_idx ON user_auth(mobile)`);
}

async function migrateAdminTables27(): Promise<void> {
  // Center broadcast messaging: scheduled daily + ad-hoc broadcasts to active members
  await pool.query(`
    CREATE TABLE IF NOT EXISTS center_broadcast_settings (
      center_id TEXT PRIMARY KEY REFERENCES centers(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      schedule_time TEXT NOT NULL DEFAULT '09:00',
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      retention_days INTEGER NOT NULL DEFAULT 7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_broadcasts (
      id SERIAL PRIMARY KEY,
      center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_by TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS member_broadcasts_center_idx ON member_broadcasts(center_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS member_broadcasts_sent_idx ON member_broadcasts(sent_at DESC)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_broadcast_reads (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      broadcast_id INTEGER NOT NULL REFERENCES member_broadcasts(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(member_id, broadcast_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS member_broadcast_reads_member_idx ON member_broadcast_reads(member_id)`);
}

async function migrateAdminTables28(): Promise<void> {
  // Broadcast retention — how many days messages stay visible to members
  await pool.query(`ALTER TABLE center_broadcast_settings ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 7`);
}

async function migrateAdminTables29(): Promise<void> {
  // Per-member daily calorie target (kcal); null means fall back to center default
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS daily_kcal INTEGER`);
}

async function migrateAdminTables22(): Promise<void> {
  // Serving qty and day-of-week availability are now managed per flavour in the Flavour Master
  await pool.query(`ALTER TABLE center_flavours ADD COLUMN IF NOT EXISTS serving_qty REAL NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE center_flavours ADD COLUMN IF NOT EXISTS available_days TEXT NOT NULL DEFAULT 'all'`);
}

async function migrateAdminTables19(): Promise<void> {
  // Flavour master — center-scoped list of flavour names selectable in Item Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS center_flavours (
      id         SERIAL PRIMARY KEY,
      center_id  TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(center_id, name)
    )
  `);
}

async function migrateAdminTables18(): Promise<void> {
  // Per-member Gemini API key for AI food photo analysis
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS gemini_api_key TEXT`);
}

async function migrateAdminTables16(): Promise<void> {
  // Day-of-week availability for menu items: 'all' or comma-separated e.g. 'Mon,Wed,Fri'
  await pool.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available_days TEXT NOT NULL DEFAULT 'all'`);
}

async function migrateAdminTables17(): Promise<void> {
  // Track which flavour was chosen per menu-item selection at a visit
  await pool.query(`ALTER TABLE visit_menu_selections ADD COLUMN IF NOT EXISTS selected_flavour TEXT`);
  // Direct-order flavoured ingredient selections at check-in (not part of a menu item BOM)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visit_flavour_selections (
      id SERIAL PRIMARY KEY,
      checkin_id INTEGER NOT NULL REFERENCES member_check_ins(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      flavour TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(checkin_id, ingredient_id)
    )
  `);
}
