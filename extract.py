import re

# 1. Update inventory.tsx
with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "r", encoding="utf-8") as f:
    inv = f.read()

# Remove AdjustBatchForm
adjust_form_start = inv.find("// -- Adjust Batch Form")
adjust_form_end = inv.find("// -- Batch Table Row")
if adjust_form_start != -1 and adjust_form_end != -1:
    adjust_form = inv[adjust_form_start:adjust_form_end]
    inv = inv[:adjust_form_start] + inv[adjust_form_end:]
else:
    adjust_form = ""

# Remove Open Batches section from BatchInventory
open_batches_start = inv.find("{/* -- Open Batches -------------------------------------------- */}")
open_batches_end = inv.find("{/* -- New Batches -------------------------------------------- */}")
if open_batches_start != -1 and open_batches_end != -1:
    open_batches_section = inv[open_batches_start:open_batches_end]
    inv = inv[:open_batches_start] + inv[open_batches_end:]
else:
    open_batches_section = ""

# Remove activeBatches/openGroups logic from inventory
logic_start = inv.find("  const activeBatches = useMemo(() => batches.filter(b => b.status !== \"consumed\"), [batches]);")
logic_end = inv.find("  // Center-stock new (sealed) batches only")
if logic_start != -1 and logic_end != -1:
    open_batches_logic = inv[logic_start:logic_end]
    inv = inv[:logic_start] + inv[logic_end:]
else:
    open_batches_logic = ""

with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "w", encoding="utf-8") as f:
    f.write(inv)

# Write to a temp file so we can inspect
with open("open_batches_logic.txt", "w", encoding="utf-8") as f:
    f.write(adjust_form + "\n" + open_batches_logic + "\n" + open_batches_section)
