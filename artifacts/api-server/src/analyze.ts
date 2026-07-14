import { pool } from "./lib/sqlite";

async function analyze() {
  console.log("Analyzing Member Data...");
  try {
    // 1. Missing membership numbers
    const { rows: missingMembers } = await pool.query(
      "SELECT id, name, center_id FROM members WHERE membership_no IS NULL OR membership_no = ''"
    );
    console.log(`Members with missing membership numbers: ${missingMembers.length}`);
    if (missingMembers.length > 0) console.log(missingMembers.slice(0, 5));

    // 2. Missing emails
    const { rows: missingEmails } = await pool.query(
      "SELECT id, name, center_id FROM members WHERE email IS NULL OR email = ''"
    );
    console.log(`Members with missing emails: ${missingEmails.length}`);
    if (missingEmails.length > 0) console.log(missingEmails.slice(0, 5));

    // 3. Duplicate emails
    const { rows: duplicateEmails } = await pool.query(`
      SELECT email, COUNT(*) as count 
      FROM members 
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);
    console.log(`Duplicate emails found: ${duplicateEmails.length}`);
    if (duplicateEmails.length > 0) console.log(duplicateEmails);

    // 4. Duplicate membership numbers
    const { rows: duplicateMemberships } = await pool.query(`
      SELECT membership_no, COUNT(*) as count 
      FROM members 
      WHERE membership_no IS NOT NULL AND membership_no != ''
      GROUP BY membership_no 
      HAVING COUNT(*) > 1
    `);
    console.log(`Duplicate membership numbers found: ${duplicateMemberships.length}`);
    if (duplicateMemberships.length > 0) console.log(duplicateMemberships);

    // 5. Auth mismatches
    const { rows: authMismatches } = await pool.query(`
      SELECT m.id, m.email as member_email, u.email as auth_email
      FROM members m
      JOIN user_auth u ON m.id = u.member_id
      WHERE m.email != u.email OR (m.email IS NULL AND u.email IS NOT NULL) OR (m.email IS NOT NULL AND u.email IS NULL)
    `);
    console.log(`Auth email mismatches found: ${authMismatches.length}`);
    if (authMismatches.length > 0) console.log(authMismatches);

  } catch (err) {
    console.error("Error analyzing:", err);
  } finally {
    await pool.end();
  }
}

analyze();
