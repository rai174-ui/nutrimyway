import re

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace memberBatches and centerBatches
pattern = re.compile(r"// Member-assigned packs.*?const centerBatches = useMemo\(\(\) =>\s*activeBatches\.filter\(b => b\.assigned_member_id == null\),\s*\[activeBatches\]\);", re.DOTALL)
match = pattern.search(content)
if match:
    content = content[:match.start()] + "const centerBatches = activeBatches;" + content[match.end():]
    print("Replaced memberBatches declaration")

# Remove member section
start_pattern = "Member Packs"
idx = content.find(start_pattern)
if idx != -1:
    section_start = content.rfind("{/* --", 0, idx)
    if section_start != -1:
        # find the next </section>} or </section> )}
        end_idx = content.find("</section>", section_start)
        if end_idx != -1:
            close_brace = content.find(")}", end_idx, end_idx + 20)
            if close_brace != -1:
                content = content[:section_start] + content[close_brace+2:]
            else:
                content = content[:section_start] + content[end_idx+10:]
            print("Removed member packs section")

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
