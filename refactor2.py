import os
import re

# --- 1. Update inventory.tsx ---
with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "r", encoding="utf-8") as f:
    inv = f.read()

# We need to remove AdjustBatchForm, batchCapacity, batchUnit, exportInventoryXlsx, fmt, fmtTime, StatusChip from inventory.tsx
# But wait, it's easier to just use regex to remove them, or string replacement.
# They are scattered.

# Actually, I'll just write a script that generates a completely clean inventory.tsx and set-menu.tsx.
