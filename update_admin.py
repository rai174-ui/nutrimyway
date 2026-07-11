import re

with open('artifacts/api-server/src/routes/admin.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the broken section using regex
old_broken_api = content[content.find('// --- Check-in Categories ---'):content.find('// --- External API Configs ---')]

categories_api = '''// --- Check-in Categories ---
  router.get("/admin/centers/:centerId/checkin-categories", requireAdmin, async (req, res) => {
    const { centerId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { rows } = await pool.query(
      `SELECT * FROM checkin_categories WHERE center_id = $1 ORDER BY display_order ASC, id ASC`,
      [centerId]
    );
    
    const { rows: mappings } = await pool.query(
      `SELECT ci.category_id, i.id as ingredient_id, i.name, i.flavour, i.serving_qty 
       FROM checkin_category_ingredients ci
       JOIN ingredients i ON i.id = ci.ingredient_id
       JOIN checkin_categories c ON c.id = ci.category_id
       WHERE c.center_id = $1`,
      [centerId]
    );

    const result = rows.map(cat => ({
      ...cat,
      ingredients: mappings.filter(m => m.category_id === cat.id)
    }));
    
    res.json(result);
  });

  router.post("/admin/centers/:centerId/checkin-categories", requireAdmin, async (req, res) => {
    const { centerId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { name, is_mandatory, display_order, ingredients } = req.body as {
      name: string; is_mandatory?: boolean; display_order?: number; ingredients?: number[];
    };
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    
    try {
      await pool.query("BEGIN");
      const { rows } = await pool.query(
        `INSERT INTO checkin_categories (center_id, name, is_mandatory, display_order) VALUES ($1, $2, $3, $4) RETURNING *`,
        [centerId, name.trim(), is_mandatory ?? true, display_order ?? 0]
      );
      const catId = rows[0].id;
      
      const mappedIngredients = [];
      if (Array.isArray(ingredients)) {
        for (const ingId of ingredients) {
          const { rows: ingRes } = await pool.query(
            `INSERT INTO checkin_category_ingredients (category_id, ingredient_id) VALUES ($1, $2) RETURNING ingredient_id`,
            [catId, ingId]
          );
          mappedIngredients.push(ingRes[0].ingredient_id);
        }
      }
      
      await pool.query("COMMIT");
      res.status(201).json({ ...rows[0], ingredients: mappedIngredients });
    } catch(e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  router.put("/admin/centers/:centerId/checkin-categories/:categoryId", requireAdmin, async (req, res) => {
    const { centerId, categoryId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { name, is_mandatory, display_order, ingredients } = req.body as {
      name?: string; is_mandatory?: boolean; display_order?: number; ingredients?: number[];
    };
    
    try {
      await pool.query("BEGIN");
      
      const updates = [];
      const values: any[] = [];
      if (name !== undefined) { updates.push(`name = $${values.length + 1}`); values.push(name.trim()); }
      if (is_mandatory !== undefined) { updates.push(`is_mandatory = $${values.length + 1}`); values.push(Boolean(is_mandatory)); }
      if (display_order !== undefined) { updates.push(`display_order = $${values.length + 1}`); values.push(Number(display_order)); }
      
      let updatedCat = null;
      if (updates.length > 0) {
        values.push(categoryId);
        values.push(centerId);
        const { rows } = await pool.query(
          `UPDATE checkin_categories SET ${updates.join(", ")} WHERE id = $${values.length - 1} AND center_id = $${values.length} RETURNING *`,
          values
        );
        if (!rows[0]) {
          await pool.query("ROLLBACK");
          res.status(404).json({ error: "Category not found" }); return;
        }
        updatedCat = rows[0];
      }
      
      if (Array.isArray(ingredients)) {
        await pool.query(`DELETE FROM checkin_category_ingredients WHERE category_id = $1`, [categoryId]);
        for (const ingId of ingredients) {
          await pool.query(
            `INSERT INTO checkin_category_ingredients (category_id, ingredient_id) VALUES ($1, $2)`,
            [categoryId, ingId]
          );
        }
      }
      
      await pool.query("COMMIT");
      res.json(updatedCat || { id: categoryId, updated: true });
    } catch(e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  router.delete("/admin/centers/:centerId/checkin-categories/:categoryId", requireAdmin, async (req, res) => {
    const { centerId, categoryId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { rows } = await pool.query(
      `DELETE FROM checkin_categories WHERE id = $1 AND center_id = $2 RETURNING id`,
      [categoryId, centerId]
    );
    if (!rows[0]) { res.status(404).json({ error: "Category not found" }); return; }
    res.json({ success: true });
  });
'''
if old_broken_api:
    content = content.replace(old_broken_api, categories_api)
with open('artifacts/api-server/src/routes/admin.ts', 'w', encoding='utf-8') as f:
    f.write(content)
