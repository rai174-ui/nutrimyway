with open("artifacts/api-server/src/lib/sqlite.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("    await migrateAdminTables41();\n    await migrateAdminTables41();\n    await migrateAdminTables42();\n", "    await migrateAdminTables41();\n")
content = content.replace("    await migrateAdminTables41();\n  await migrateAdminTables42();\n", "    await migrateAdminTables41();\n")
content = content.replace("    await migrateAdminTables41();\n    await migrateAdminTables42();\n", "    await migrateAdminTables41();\n")

with open("artifacts/api-server/src/lib/sqlite.ts", "w", encoding="utf-8") as f:
    f.write(content)
