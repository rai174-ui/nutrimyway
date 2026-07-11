import re

with open('artifacts/nutrimyway-admin/src/pages/members.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
content = content.replace(
    'const [batchId, setBatchId] = useState("");',
    'const [batchId, setBatchId] = useState("");\n    const [search, setSearch] = useState("");\n    const [open, setOpen] = useState(false);'
)

# Replace the select block
select_block = '''            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 
ml-1">Product Batch</label>
              <select value={batchId} onChange={e => {
                const bId = e.target.value;
                setBatchId(bId);
                const selected = batches.find(b => b.id === Number(bId));
                if (selected) setQty(String(selected.pack_size || ""));
              }} disabled={loading}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none 
focus:ring-2 focus:ring-primary/40">
                <option value="">Select product batch...</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.ingredient_name} (Batch: {b.batch_number}, Size: 
{b.pack_size} {b.pack_unit})</option>)}
              </select>
            </div>'''

combobox_block = '''            <div className="relative">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Product Batch</label>
              <div 
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl focus-within:ring-2 focus-within:ring-primary/40 flex items-center justify-between"
              >
                <input
                  type="text"
                  placeholder={batchId && !search ? (batches.find(b => b.id === Number(batchId))?.ingredient_name || "Select...") : "Search batches..."}
                  className="bg-transparent outline-none w-full flex-1 disabled:opacity-50"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  disabled={loading}
                />
                <button type="button" className="text-muted-foreground px-1" onClick={(e) => { e.preventDefault(); setOpen(!open); }}>
                  ?
                </button>
              </div>
              
              {open && (
                <>
                  <div className="fixed inset-0 z-[101]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
                  <div className="absolute z-[102] w-full mt-1 bg-background border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {batches.filter(b => b.ingredient_name.toLowerCase().includes(search.toLowerCase()) || b.batch_number.toLowerCase().includes(search.toLowerCase())).map(b => (
                      <div 
                        key={b.id} 
                        className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBatchId(String(b.id));
                          setQty(String(b.pack_size || ""));
                          setSearch("");
                          setOpen(false);
                        }}
                      >
                        {b.ingredient_name} (Batch: {b.batch_number}, Size: {b.pack_size} {b.pack_unit})
                      </div>
                    ))}
                    {batches.filter(b => b.ingredient_name.toLowerCase().includes(search.toLowerCase()) || b.batch_number.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
                    )}
                  </div>
                </>
              )}
            </div>'''

content = content.replace(select_block.replace('\n', ''), combobox_block)
content = re.sub(r'<div>\s*<label className="block text-\[10px\] font-bold text-muted-foreground uppercase tracking-wider mb-1\.5\s*ml-1">Product Batch</label>\s*<select.*?</select>\s*</div>', combobox_block, content, flags=re.DOTALL)

with open('artifacts/nutrimyway-admin/src/pages/members.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
