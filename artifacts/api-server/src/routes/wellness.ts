import { Router } from "express";
import { pool } from "../lib/sqlite";
import { logger } from "../lib/logger";

const router = Router();

router.get("/wellness-articles", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    const { rows } = await pool.query(
      "SELECT id, title, description, link, source, pub_date, image_url FROM wellness_articles ORDER BY pub_date DESC LIMIT $1",
      [limit]
    );

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to fetch wellness articles");
    res.status(500).json({ error: "Failed to fetch wellness articles" });
  }
});

export default router;
