with open('artifacts/api-server/src/lib/sqlite.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_migration = '''
async function migrateAdminTables41(): Promise<void> {
  // Check-in categories replacing the old BOM/menu logic
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkin_categories (
      id SERIAL PRIMARY KEY,
      center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkin_category_ingredients (
      category_id INTEGER NOT NULL REFERENCES checkin_categories(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      PRIMARY KEY (category_id, ingredient_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visit_ingredient_selections (
      id SERIAL PRIMARY KEY,
      checkin_id INTEGER NOT NULL REFERENCES member_check_ins(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES checkin_categories(id) ON DELETE SET NULL,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(checkin_id, category_id, ingredient_id)
    )
  `);
}

export { pool, initDb };'''

content = content.replace('export { pool, initDb };', new_migration)

init_call_old = 'await migrateAdminTables40();'
init_call_new = '''await migrateAdminTables40();
    await migrateAdminTables41();'''

content = content.replace(init_call_old, init_call_new)

with open('artifacts/api-server/src/lib/sqlite.ts', 'w', encoding='utf-8') as f:
    f.write(content)
