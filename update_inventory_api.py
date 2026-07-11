import re

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of `const batch = await apiPost<IngredientBatch>` or `const b = await apiPost<IngredientBatch>` 
# specifically for ingredient-batches.
content = re.sub(
    r'const batch = await apiPost<IngredientBatch>\(\s*`/admin/centers/\$\{centerId\}/ingredient-batches`,[\s\S]*?\);\s*if \(openNow\) \{\s*await apiPatch\(`/admin/ingredient-batches/\$\{batch\.id\}/open`\);\s*\}',
    r'''const batches = await apiPost<IngredientBatch[]>(
          `/admin/centers/${centerId}/ingredient-batches`,
          body
        );
        if (openNow && batches && batches.length > 0) {
          await apiPatch(`/admin/ingredient-batches/${batches[0].id}/open`);
        }''',
    content
)

content = re.sub(
    r'const b = await apiPost<IngredientBatch>\(\s*`/admin/centers/\$\{centerId\}/ingredient-batches`,[\s\S]*?\);\s*onSuccess\(\);',
    r'''const batches = await apiPost<IngredientBatch[]>(
          `/admin/centers/${centerId}/ingredient-batches`,
          {
            ingredient_id: Number(ingredientId),
            batch_number: batchNumber.trim(),
          }
        );
        onSuccess();''',
    content
)

with open('artifacts/nutrimyway-admin/src/pages/inventory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
