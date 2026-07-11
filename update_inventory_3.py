import re

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'ing.skus.map(sku => ({ ...sku, ingredientName: ing.name }))',
    '(ing.skus || []).map(sku => ({ ...sku, ingredientName: ing.name }))'
)

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
