import Parser from "rss-parser";

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1'
  }
});

const feeds = [
  "https://nutritionfacts.org/feed/",
  "https://www.sciencedaily.com/rss/health_medicine/nutrition.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
  "https://www.everydayhealth.com/rss/all",
  "https://medicalxpress.com/rss-feed/nutrition-news/",
  "https://www.news-medical.net/tag/feed/Nutrition.aspx"
];

async function test() {
  for (const url of feeds) {
    try {
      console.log(`Testing ${url}...`);
      const feed = await parser.parseURL(url);
      console.log(`Success! Title: ${feed.title}, Items: ${feed.items.length}`);
    } catch (err) {
      console.error(`Failed ${url}: ${err.message}`);
    }
  }
}

test();
