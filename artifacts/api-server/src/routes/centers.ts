import { Router } from "express";
import { pool } from "../lib/sqlite";

const router = Router();

// GET /api/centers
router.get("/centers", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM centers ORDER BY name");
  res.json(rows);
});

export default router;
