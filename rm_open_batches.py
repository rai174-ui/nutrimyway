with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if "{/* -- Open Batches -------------------------------------------- */}" in line:
        start_idx = i
    if "{/* -- New Batches -------------------------------------------- */}" in line:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    del lines[start_idx:end_idx]

with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "w", encoding="utf-8") as f:
    f.writelines(lines)
