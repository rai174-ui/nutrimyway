import re

with open('artifacts/nutrimyway-admin/src/pages/set-menu.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("setUnit(ing.pack_unit)", "setUnit(ing.skus?.[0]?.pack_unit ?? 'g')")
content = content.replace("{i.pack_size}{i.pack_unit}", "{i.skus?.[0]?.pack_size ?? ''}{i.skus?.[0]?.pack_unit ?? ''}")

with open('artifacts/nutrimyway-admin/src/pages/set-menu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
