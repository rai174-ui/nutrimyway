import re

def fix_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Restore missing $1, $2, etc. that got stripped by PowerShell
    content = re.sub(r'WHERE center_id =\s+ORDER', 'WHERE center_id = $1 ORDER', content)
    content = re.sub(r'WHERE member_id =\s+AND', 'WHERE member_id = $1 AND', content)
    content = re.sub(r'WHERE c\.center_id =\s+', 'WHERE c.center_id = $1', content)
    content = re.sub(r'VALUES \(\s*,\s*,\s*,\s*\)', 'VALUES ($1, $2, $3, $4)', content)
    content = re.sub(r'VALUES \(\s*,\s*\)', 'VALUES ($1, $2)', content)
    content = re.sub(r'category_id = \s+\]\)', 'category_id = $1\'],', content)
    content = re.sub(r'checkin_id = \s+\]\)', 'checkin_id = $1\'],', content)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file("artifacts/api-server/src/routes/admin.ts")
fix_file("artifacts/api-server/src/routes/members.ts")
