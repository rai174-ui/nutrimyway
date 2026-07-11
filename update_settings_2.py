import re

with open('artifacts/nutrimyway-admin/src/pages/settings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'setEditSkus(ing.skus.length > 0 ? [...ing.skus] : [{ material_code: "", pack_size: 1, pack_unit: "g" }]);',
    'setEditSkus((ing.skus || []).length > 0 ? [...ing.skus] : [{ material_code: "", pack_size: 1, pack_unit: "g" }]);'
)

with open('artifacts/nutrimyway-admin/src/pages/settings.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
