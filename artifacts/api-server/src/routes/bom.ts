import { Router } from "express";
import { pool } from "../lib/sqlite";

const router = Router();

// GET /api/bom?plan=
router.get("/bom", async (req, res) => {
  const plan = req.query.plan as string | undefined;
  if (plan) {
    const { rows } = await pool.query("SELECT * FROM bom_items WHERE plan_name = $1 ORDER BY food_item", [plan]);
    res.json(rows);
  } else {
    const { rows } = await pool.query("SELECT * FROM bom_items ORDER BY plan_name, food_item");
    res.json(rows);
  }
});

export default router;
