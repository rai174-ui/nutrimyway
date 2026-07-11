import re

with open('artifacts/api-server/src/routes/members.ts', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'// GET /api/members/:id/checkin-options.*?// GET /api/members/:id/checkin-logs'

new_apis = '''// GET /api/members/:id/checkin-menu
router.get("/members/:id/checkin-menu", async (req, res) => {
  const memberId = Number(req.params.id);
  
  const { rows: checkinRows } = await pool.query(
    `SELECT id, center_id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkinRows[0]) { res.status(409).json({ error: "No active check-in" }); return; }
  const centerId = checkinRows[0].center_id;
  const checkinId = checkinRows[0].id;

  const { rows: categories } = await pool.query(
    `SELECT * FROM checkin_categories WHERE center_id = $1 ORDER BY display_order ASC, id ASC`,
    [centerId]
  );
  
  const { rows: mappings } = await pool.query(
    `SELECT ci.category_id, i.id as ingredient_id, i.name, i.flavour 
     FROM checkin_category_ingredients ci
     JOIN ingredients i ON i.id = ci.ingredient_id
     JOIN checkin_categories c ON c.id = ci.category_id
     WHERE c.center_id = $1`,
    [centerId]
  );
  
  const { rows: selections } = await pool.query(
    `SELECT category_id, ingredient_id FROM visit_ingredient_selections WHERE checkin_id = $1`,
    [checkinId]
  );

  const result = categories.map(cat => ({
    ...cat,
    ingredients: mappings.filter(m => m.category_id === cat.id)
  }));
  
  res.json({ categories: result, selections });
});

// POST /api/members/:id/checkin/selections
router.post("/members/:id/checkin/selections", async (req, res) => {
  const memberId = Number(req.params.id);
  
  const { rows: checkinRows } = await pool.query(
    `SELECT id, center_id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkinRows[0]) { res.status(409).json({ error: "No active check-in" }); return; }
  const checkinId = checkinRows[0].id;

  const { items } = req.body as { items?: { category_id?: number; ingredient_id: number }[] };
  
  if (!Array.isArray(items)) { res.status(400).json({ error: "items array required" }); return; }

  await pool.query("BEGIN");
  try {
    await pool.query(`DELETE FROM visit_ingredient_selections WHERE checkin_id = $1`, [checkinId]);
    for (const item of items) {
      if (item.ingredient_id) {
        await pool.query(
          `INSERT INTO visit_ingredient_selections (checkin_id, category_id, ingredient_id) VALUES ($1, $2, $3)`,
          [checkinId, item.category_id ?? null, item.ingredient_id]
        );
      }
    }
    await pool.query("COMMIT");
    res.json({ success: true, count: items.length });
  } catch (e) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: "Failed to save selections" });
  }
});

// GET /api/members/:id/checkin-logs'''

content = re.sub(pattern, new_apis, content, flags=re.DOTALL)

with open('artifacts/api-server/src/routes/members.ts', 'w', encoding='utf-8') as f:
    f.write(content)
