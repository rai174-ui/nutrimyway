import re

with open('artifacts/nutrimyway-admin/src/pages/settings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '{ing.skus.map(s => (',
    '{(ing.skus || []).map(s => ('
)

with open('artifacts/nutrimyway-admin/src/pages/settings.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
