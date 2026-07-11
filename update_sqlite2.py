import re

with open('artifacts/api-server/src/lib/sqlite.ts', 'r', encoding='utf-8') as f:
    content = f.read()

migration_code = '''
async function migrateAdminTables42(): Promise<void> {
  // Center-defined check-in categories replacing Menu Items
  await pool.query(
    CREATE TABLE IF NOT EXISTS checkin_categories (
      id SERIAL PRIMARY KEY,
      center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  );

  await pool.query(
    CREATE TABLE IF NOT EXISTS checkin_category_ingredients (
      category_id INTEGER NOT NULL REFERENCES checkin_categories(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      PRIMARY KEY (category_id, ingredient_id)
    )
  );

  await pool.query(
    CREATE TABLE IF NOT EXISTS visit_ingredient_selections (
      id SERIAL PRIMARY KEY,
      checkin_id INTEGER NOT NULL REFERENCES member_check_ins(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES checkin_categories(id) ON DELETE SET NULL,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  );
}
'''

# We need to replace the previous migrateAdminTables42 I just added, with this updated one.
# First, remove the old one.
content = re.sub(r'async function migrateAdminTables42.*?\n}\n', '', content, flags=re.DOTALL)
content = content.replace('export { pool, initDb };', migration_code + '\nexport { pool, initDb };')

with open('artifacts/api-server/src/lib/sqlite.ts', 'w', encoding='utf-8') as f:
    f.write(content)
