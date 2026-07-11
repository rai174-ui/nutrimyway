import re
with open('artifacts/nutrimyway-admin/src/pages/members.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
content = content.replace(
    'const [loading, setLoading] = useState(false);',
    'const [loading, setLoading] = useState(false);\n  const [nameFilter, setNameFilter] = useState("");\n  const [viewType, setViewType] = useState<"details" | "summary">("details");'
)

# 2. Add filteredLogs and use it for grouped and totalKcal
content = content.replace(
    'const grouped = logs.reduce<Record<string, SelfLogEntry[]>>((acc, l) => {',
    'const filteredLogs = logs.filter(l => l.member_name.toLowerCase().includes(nameFilter.toLowerCase()));\n\n  const grouped = filteredLogs.reduce<Record<string, SelfLogEntry[]>>((acc, l) => {'
)

content = content.replace(
    'const totalKcal = logs.reduce((s, l) => s + (l.calories_kcal ?? 0), 0);',
    'const totalKcal = filteredLogs.reduce((s, l) => s + (l.calories_kcal ?? 0), 0);'
)

# 3. Add filters UI
filters_ui = """        <div className="px-5 py-3 border-b border-border shrink-0 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex flex-col gap-1 w-48">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Member Name</label>
            <input type="text" placeholder="Filter by name..." value={nameFilter} onChange={e => setNameFilter(e.target.value)}
              className="h-8 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
            <button 
              onClick={() => setViewType("details")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewType === "details" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Details
            </button>
            <button 
              onClick={() => setViewType("summary")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewType === "summary" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Daily Summary
            </button>
          </div>

          <div className="flex gap-2 ml-auto items-end">
            {filteredLogs.length > 0 && ("""

content = re.sub(
    r'<div className="px-5 py-3 border-b border-border shrink-0 flex flex-wrap items-end gap-3">.*?\{logs\.length > 0 && \(',
    filters_ui,
    content,
    flags=re.DOTALL
)

# Update logs.length to filteredLogs.length in Summary strip
content = content.replace(
    '{!loading && logs.length > 0 && (',
    '{!loading && filteredLogs.length > 0 && ('
)
content = content.replace(
    '<span><span className="font-semibold text-foreground">{logs.length}</span> entries</span>',
    '<span><span className="font-semibold text-foreground">{filteredLogs.length}</span> entries</span>'
)
content = content.replace(
    'logs.length === 0 ? (',
    'filteredLogs.length === 0 ? ('
)


# 4. Add Summary Table view
details_table = """                <table className="w-full">
                  <thead>"""

new_table_logic = """                {viewType === "details" ? (
                  <table className="w-full">
                    <thead>"""

content = content.replace(details_table, new_table_logic)

end_details_table = """                    ))}
                  </tbody>
                </table>"""

new_end_table_logic = """                    ))}
                  </tbody>
                </table>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Items Logged</th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Kcal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        entries.reduce<Record<string, { kcal: number, items: number }>>((acc, e) => {
                          const d = new Date(e.logged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                          acc[d] = acc[d] || { kcal: 0, items: 0 };
                          acc[d].kcal += (e.calories_kcal || 0);
                          acc[d].items += 1;
                          return acc;
                        }, {})
                      ).map(([date, summary]) => (
                        <tr key={date} className="border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-2 text-sm text-foreground">{date}</td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums text-muted-foreground">{summary.items} items</td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums font-medium text-foreground">{Math.round(summary.kcal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}"""

content = content.replace(end_details_table, new_end_table_logic)

with open('artifacts/nutrimyway-admin/src/pages/members.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
