import re

with open('artifacts/nutrimyway/src/pages/log.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the parts to remove
content = re.sub(r'  function isDirectFlavourSelected.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'  function handleMenuItemToggle.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'  function handleDirectFlavourToggle.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'  function removeSelection.*?\}', '', content, flags=re.DOTALL)

with open('artifacts/nutrimyway/src/pages/log.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
