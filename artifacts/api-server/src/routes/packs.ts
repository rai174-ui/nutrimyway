import { Router } from "express";
import { pool } from "../lib/sqlite";

const router = Router();

// GET /api/pack-sizes
router.get("/pack-sizes", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM pack_sizes ORDER BY item_name");
  res.json(rows);
});

export default router;
