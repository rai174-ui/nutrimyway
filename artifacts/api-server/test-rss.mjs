import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['media:group', 'mediaGroup']
    ],
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1'
  }
});

const feeds = [
  "https://www.gainhealth.org/rss/news.xml",
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCddn8dUxYdgJz3PeKcx8FpQ"
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
