import { Router } from "express";
import { pool } from "../lib/sqlite";

export const router = Router();

router.get("/images/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT data, mime_type FROM broadcast_images WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      res.status(404).send("Image not found");
      return;
    }

    const image = rows[0];
    res.setHeader("Content-Type", image.mime_type);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.send(image.data);
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).send("Internal Server Error");
  }
});
