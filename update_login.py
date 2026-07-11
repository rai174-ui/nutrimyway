import re

with open('artifacts/nutrimyway-admin/src/pages/login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace states and useEffect
old_hooks = """  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) { navigate("/dashboard"); return; }
    apiGet<Center[]>("/admin/centers").then(setCenters).catch(() => {});
  }, [navigate]);"""

new_hooks = """  const [error, setError] = useState<string | null>(null);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [centersError, setCentersError] = useState(false);

  function fetchCenters() {
    setLoadingCenters(true);
    setCentersError(false);
    apiGet<Center[]>("/admin/centers")
      .then(setCenters)
      .catch(() => { setCentersError(true); })
      .finally(() => { setLoadingCenters(false); });
  }

  useEffect(() => {
    if (isAuthenticated()) { navigate("/dashboard"); return; }
    fetchCenters();
  }, [navigate]);"""

content = content.replace(old_hooks, new_hooks)

# Replace the select field
old_select = """          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Center</label>
            <select
              value={centerId}
              onChange={e => setCenterId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            >
              <option value="">Select a center…</option>
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>"""

new_select = """          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Center</label>
            {loadingCenters ? (
              <div className="w-full h-11 px-3 rounded-xl border border-input bg-background flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Waking up server...
              </div>
            ) : centersError ? (
              <div className="w-full flex items-center gap-2">
                <div className="h-11 px-3 rounded-xl border border-destructive/50 bg-destructive/10 flex-1 flex items-center text-sm text-destructive">
                  Failed to load centers
                </div>
                <button type="button" onClick={fetchCenters} className="h-11 px-4 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium transition-colors">
                  Retry
                </button>
              </div>
            ) : (
              <select
                value={centerId}
                onChange={e => setCenterId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              >
                <option value="">Select a center…</option>
                {centers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>"""

content = content.replace(old_select, new_select)

with open('artifacts/nutrimyway-admin/src/pages/login.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
