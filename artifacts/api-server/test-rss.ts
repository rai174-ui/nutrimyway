import { fetchFeeds } from "./src/jobs/rss-sync";
import { initDb } from "./src/lib/sqlite";

async function run() {
  await initDb();
  await fetchFeeds();
  console.log("Done");
  process.exit(0);
}

run();
