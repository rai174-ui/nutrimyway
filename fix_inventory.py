with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "r", encoding="utf-8") as f:
    inv = f.read()

inv = inv.replace("{ingredient.material_code && (", "{ingredient.skus?.[0]?.material_code && (")
inv = inv.replace("{ingredient.material_code}</span>", "{ingredient.skus[0].material_code}</span>")
inv = inv.replace("req.pack_unit", "req.pack_unit || ''")
inv = inv.replace("ingredient.pack_unit", "ingredient.skus?.[0]?.pack_unit")

with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "w", encoding="utf-8") as f:
    f.write(inv)
