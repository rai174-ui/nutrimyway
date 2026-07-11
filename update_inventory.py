import re

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

with open('C:/Users/ABC/.gemini/antigravity/brain/86247692-a7fa-4726-aa93-501d4f89491c/scratch/QuickReceiptForm.tsx', 'r', encoding='utf-8') as f:
    new_quick = f.read()

# Replace QuickReceiptForm
start_idx = content.find("function QuickReceiptForm({")
end_idx = content.find("function AddBatchForm({", start_idx)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_quick + "\n\n// -- Add Batch Form (Deprecated) --\n\n" + content[end_idx:]
    print("Replaced QuickReceiptForm")

# Delete AddBatchForm body so it just returns null or we can just replace its usages
# Actually let's just make it return null so it doesn't break TS if we leave references
addbatch_start = content.find("function AddBatchForm({")
if addbatch_start != -1:
    addbatch_end = content.find("function ConsumptionPanel({", addbatch_start)
    if addbatch_end != -1:
        # keep the signature but return null
        content = content[:addbatch_start] + "function AddBatchForm(props: any) { return null; }\n\n" + content[addbatch_end:]
        print("Stubbed AddBatchForm")

# Remove memberBatches calculation
content = content.replace('''  // Member-assigned packs (open or new, shown in their own section)
  const memberBatches = useMemo(() =>
    activeBatches
      .filter(b => b.assigned_member_id != null)
      .map(b => ({ ...b, ingredient: ingredients.find(i => i.id === b.ingredient_id) }))
      .filter(b => b.ingredient),
  [activeBatches, ingredients]);

  // Center packs (not assigned to a member)
  const centerBatches = useMemo(() =>
    activeBatches.filter(b => b.assigned_member_id == null),
  [activeBatches]);''', '''  // Center packs (all active batches)
  const centerBatches = activeBatches;''')

# Remove Member Packs section
member_section_start = content.find("{/* -- Member Packs")
if member_section_start != -1:
    end_tag = "</section>"
    member_section_end = content.find(end_tag, member_section_start)
    if member_section_end != -1:
        close_brace = content.find(")}", member_section_end)
        if close_brace != -1 and close_brace - member_section_end < 20:
            member_section_end = close_brace + 2
        else:
            member_section_end += len(end_tag)
        content = content[:member_section_start] + content[member_section_end:]
        print("Removed Member Packs section")

content = content.replace("members={members}", "")

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
