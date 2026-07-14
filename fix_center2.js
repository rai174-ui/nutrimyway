const fs = require('fs');

const file = 'artifacts/nutrimyway/src/pages/center.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add state variables
const stateTarget = `  const [chartTab, setChartTab] = useState<'weight' | 'visceral'>('weight');`;
if (!content.includes(`const [showProgressHistory, setShowProgressHistory]`)) {
  content = content.replace(stateTarget, stateTarget + `\n  const [showProgressHistory, setShowProgressHistory] = useState(true);\n  const [showLatestProgress, setShowLatestProgress] = useState(true);\n  const [showVisitHistory, setShowVisitHistory] = useState(true);`);
}

// Ensure ChevronDown is imported
if (!content.includes('ChevronDown')) {
  content = content.replace('X, LogIn', 'X, ChevronDown, LogIn');
}

// Find sections using exactly known markers
const latestVitalsMarker = '{/* Latest vitals */}';
const trendChartsMarker = '{/* Trend charts */}';
const progressHistoryMarker = '{/* Visit history */}';
const visitHistoryLogMarker = '{/* Visit History (check-in log) */}';
const logProgressSheetMarker = '{/* Log Progress sheet */}';

const idxLatest = content.indexOf(latestVitalsMarker);
const idxTrend = content.indexOf(trendChartsMarker);
const idxProgress = content.indexOf(progressHistoryMarker);
const idxVisitLog = content.indexOf(visitHistoryLogMarker);
const idxSheet = content.indexOf(logProgressSheetMarker);

if (idxLatest === -1 || idxTrend === -1 || idxProgress === -1 || idxVisitLog === -1 || idxSheet === -1) {
  console.log("Could not find markers");
  process.exit(1);
}

const beforeSections = content.slice(0, idxLatest);
let latestVitals = content.slice(idxLatest, idxTrend);
let trendCharts = content.slice(idxTrend, idxProgress);
let progressHistory = content.slice(idxProgress, idxVisitLog);
let visitHistoryLog = content.slice(idxVisitLog, idxSheet);
const afterSections = content.slice(idxSheet);

// Make Latest Vitals collapsible
latestVitals = latestVitals.replace(
  '<div className="flex items-center gap-2 mb-4">\n          <Activity className="w-5 h-5 text-primary" />\n          <h2 className="text-sm font-semibold uppercase tracking-wider">Latest Progress</h2>\n        </div>',
  '<button onClick={() => setShowLatestProgress(!showLatestProgress)} className="w-full flex items-center justify-between mb-4">\n          <div className="flex items-center gap-2">\n            <Activity className="w-5 h-5 text-primary" />\n            <h2 className="text-sm font-semibold uppercase tracking-wider">Latest Progress</h2>\n          </div>\n          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showLatestProgress ? "rotate-180" : ""}`} />\n        </button>\n        {showLatestProgress && ('
);
// replace last </div>\n      </section>\n
let parts1 = latestVitals.split('</section>');
parts1[0] = parts1[0] + '  )}\n      ';
latestVitals = parts1.join('</section>');

// Make Progress History collapsible
progressHistory = progressHistory.replace(
  '<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Progress History</h2>',
  '<button onClick={() => setShowProgressHistory(!showProgressHistory)} className="w-full flex items-center justify-between px-1 mb-2">\n          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress History</h2>\n          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showProgressHistory ? "rotate-180" : ""}`} />\n        </button>\n        {showProgressHistory && ('
);
let parts2 = progressHistory.split('</section>');
parts2[0] = parts2[0] + '  )}\n      ';
progressHistory = parts2.join('</section>');


// Make Visit History Log collapsible
visitHistoryLog = visitHistoryLog.replace(
  '<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Visit History</h2>',
  '<button onClick={() => setShowVisitHistory(!showVisitHistory)} className="w-full flex items-center justify-between px-1 mb-2">\n          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Visit History</h2>\n          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showVisitHistory ? "rotate-180" : ""}`} />\n        </button>\n        {showVisitHistory && ('
);
let parts3 = visitHistoryLog.split('</section>');
parts3[0] = parts3[0] + '  )}\n      ';
visitHistoryLog = parts3.join('</section>');


// Order: 1. Trend charts, 2. Progress History, 3. Latest Vitals, 4. Visit History Log
const newContent = beforeSections + trendCharts + progressHistory + latestVitals + visitHistoryLog + afterSections;

fs.writeFileSync(file, newContent);
console.log("Success");
