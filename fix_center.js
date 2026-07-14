const fs = require('fs');
const file = 'artifacts/nutrimyway/src/pages/center.tsx';
let content = fs.readFileSync(file, 'utf8');

const latestProgressRegex = /\/\*\s*Latest vitals\s*\*\/[\s\S]*?(?=\/\*\s*Trend charts\s*\*\/)/;
const trendChartsRegex = /\/\*\s*Trend charts\s*\*\/[\s\S]*?(?=\/\*\s*Visit history\s*\*\/)/;
const progressHistoryRegex = /\/\*\s*Visit history\s*\*\/[\s\S]*?(?=\/\*\s*Visit History \(check-in log\)\s*\*\/)/;
const visitHistoryRegex = /\/\*\s*Visit History \(check-in log\)\s*\*\/[\s\S]*?(?=\{\/\*\s*Log Progress sheet\s*\*\/)/;

const latestProgressMatch = content.match(latestProgressRegex);
const trendChartsMatch = content.match(trendChartsRegex);
const progressHistoryMatch = content.match(progressHistoryRegex);
const visitHistoryMatch = content.match(visitHistoryRegex);

if (!latestProgressMatch || !trendChartsMatch || !progressHistoryMatch || !visitHistoryMatch) {
  console.log("Could not find sections");
  process.exit(1);
}

let latestProgress = latestProgressMatch[0];
let trendCharts = trendChartsMatch[0];
let progressHistory = progressHistoryMatch[0];
let visitHistory = visitHistoryMatch[0];

// Make Latest Progress collapsible
latestProgress = latestProgress.replace(
  '<div className="flex items-center gap-2 mb-4">',
  '<button onClick={() => setShowLatestProgress(!showLatestProgress)} className="w-full flex items-center justify-between mb-4">\n          <div className="flex items-center gap-2">'
).replace(
  '<h2 className="text-sm font-semibold uppercase tracking-wider">Latest Progress</h2>\n        </div>',
  '<h2 className="text-sm font-semibold uppercase tracking-wider">Latest Progress</h2>\n          </div>\n          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showLatestProgress ? "rotate-180" : ""}`} />\n        </button>\n        {showLatestProgress && ('
).replace(
  '</div>\n      </section>',
  '</div>\n        )}\n      </section>'
);

// Make Progress History collapsible
progressHistory = progressHistory.replace(
  '<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Progress History</h2>',
  '<button onClick={() => setShowProgressHistory(!showProgressHistory)} className="w-full flex items-center justify-between px-1">\n          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress History</h2>\n          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showProgressHistory ? "rotate-180" : ""}`} />\n        </button>\n        {showProgressHistory && ('
).replace(
  '</div>\n      </section>',
  '</div>\n        )}\n      </section>'
);

// Make Visit History collapsible
visitHistory = visitHistory.replace(
  '<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Visit History</h2>',
  '<button onClick={() => setShowVisitHistory(!showVisitHistory)} className="w-full flex items-center justify-between px-1">\n          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Visit History</h2>\n          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showVisitHistory ? "rotate-180" : ""}`} />\n        </button>\n        {showVisitHistory && ('
).replace(
  '</div>\n      </section>',
  '</div>\n        )}\n      </section>'
);

const newOrder = trendCharts + progressHistory + latestProgress + visitHistory;

const allSectionsRegex = new RegExp(
  latestProgressRegex.source + trendChartsRegex.source + progressHistoryRegex.source + visitHistoryRegex.source
);

content = content.replace(allSectionsRegex, newOrder);

fs.writeFileSync(file, content);
console.log("Success");
