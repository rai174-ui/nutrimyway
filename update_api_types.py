import re

with open('artifacts/nutrimyway-admin/src/lib/api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_interfaces = '''
export interface CategoryIngredient {
  category_id: number;
  ingredient_id: number;
  name: string;
  flavour: string | null;
  serving_qty: number;
}

export interface CheckinCategory {
  id: number;
  center_id: string;
  name: string;
  is_mandatory: boolean;
  display_order: number;
  created_at: string;
  ingredients: CategoryIngredient[];
}
'''

content = content + '\n' + new_interfaces

with open('artifacts/nutrimyway-admin/src/lib/api.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# Update App.tsx nav label
with open('artifacts/nutrimyway-admin/src/App.tsx', 'r', encoding='utf-8') as f:
    app = f.read()
app = app.replace('title: "Set Menu", icon: Coffee, path: "/menu"', 'title: "Check-in Menu", icon: Coffee, path: "/menu"')
with open('artifacts/nutrimyway-admin/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app)

