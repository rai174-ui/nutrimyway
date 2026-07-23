import cron from "node-cron";
import Parser from "rss-parser";
import { pool } from "../lib/sqlite";
import { logger } from "../lib/logger";

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
    ],
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1'
  }
});

const RSS_FEEDS = [
  { name: "NutritionFacts", url: "https://nutritionfacts.org/feed/" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/health_medicine/nutrition.xml" },
  { name: "NYT Health", url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml" },
  { name: "Nutrabay (India)", url: "https://nutrabay.com/magazine/category/nutrition/feed/" },
  { name: "Medical Dialogues", url: "https://medicaldialogues.in/diet-nutrition/feed" },
  { name: "GAIN Health (Europe)", url: "https://www.gainhealth.org/rss/news.xml" }
];

export async function fetchFeeds() {
  logger.info("Starting RSS feed sync for wellness trends...");
  let newArticlesCount = 0;

  for (const feedConfig of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedConfig.url);
      
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;

        // Try to extract an image URL from common RSS image tags
        let imageUrl = null;
        if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
          imageUrl = item.mediaContent.$.url;
        } else if (item.enclosure && item.enclosure.url) {
          imageUrl = item.enclosure.url;
        } else if (item.content) {
          // Fallback: try to extract img src from content using regex
          const match = item.content.match(/<img[^>]+src="([^">]+)"/);
          if (match && match[1]) {
            imageUrl = match[1];
          }
        }

        // Pub date
        let pubDate = new Date();
        if (item.pubDate) {
          const parsed = new Date(item.pubDate);
          if (!isNaN(parsed.getTime())) pubDate = parsed;
        }

        // Insert into database (ignore if link already exists)
        try {
          const { rowCount } = await pool.query(
            `INSERT INTO wellness_articles (title, description, link, source, pub_date, image_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (link) DO NOTHING`,
            [
              item.title,
              item.contentSnippet || item.content || "",
              item.link,
              feedConfig.name,
              pubDate.toISOString(),
              imageUrl
            ]
          );
          if (rowCount && rowCount > 0) {
            newArticlesCount++;
          }
        } catch (err) {
          logger.error({ err, link: item.link }, "Failed to insert wellness article");
        }
      }
    } catch (err) {
      logger.error({ err, url: feedConfig.url }, "Failed to fetch RSS feed");
    }
  }

  // Auto-cleanup: Remove articles older than 30 days to keep the database small and fresh
  try {
    const { rowCount: deletedCount } = await pool.query(
      `DELETE FROM wellness_articles WHERE pub_date < NOW() - INTERVAL '30 days'`
    );
    if (deletedCount && deletedCount > 0) {
      logger.info({ deletedCount }, "Cleaned up old wellness articles");
    }
  } catch (err) {
    logger.error({ err }, "Failed to cleanup old wellness articles");
  }

  logger.info({ newArticlesCount }, "Completed RSS feed sync.");
}

export function initRssSyncJob() {
  // Run on startup
  fetchFeeds().catch(err => logger.error({ err }, "Initial RSS sync failed"));

  // Run every 6 hours
  cron.schedule("0 */6 * * *", () => {
    fetchFeeds().catch(err => logger.error({ err }, "Scheduled RSS sync failed"));
  });
}
