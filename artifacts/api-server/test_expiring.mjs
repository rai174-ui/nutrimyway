import 'dotenv/config';
import { pool } from './src/lib/sqlite.js';

async function test() {
  const centerId = 'DWK-1';
  
  const q1 = await pool.query(`
    SELECT m.id, m.name, ci.used, m.valid_until
       FROM members m
       JOIN member_center_mapping mcm ON mcm.member_id = m.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS used FROM member_check_ins mci
         WHERE mci.member_id = m.id AND mci.cancelled = FALSE AND mci.checked_in_at >= COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz)
       ) ci ON TRUE
       WHERE mcm.center_id = $1
         AND (
           (m.valid_until IS NOT NULL AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
           OR (30 - COALESCE(ci.used, 0)) <= 7
         )
  `, [centerId]);
  
  console.log('Query 1 count:', q1.rows.length);
  console.log('Query 1 rows:', q1.rows);
  
  const q2 = await pool.query(`
     SELECT m.id, m.name, m.valid_until, m.member_type
     FROM members m
     JOIN member_center_mapping mcm ON mcm.member_id = m.id
     WHERE mcm.center_id = $1
       AND (
         (m.valid_until IS NOT NULL AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
         OR (
           (SELECT COUNT(*) FROM member_check_ins mci4 WHERE mci4.member_id = m.id AND mci4.cancelled = FALSE AND mci4.checked_in_at >= COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz))
             >= (CASE WHEN m.member_type = 'trial_3day' THEN (3 - 7) ELSE (30 - 7) END)
         )
       )
  `, [centerId]);

  console.log('Query 2 count:', q2.rows.length);
  console.log('Query 2 rows:', q2.rows);
  
  process.exit(0);
}
test().catch(console.error);
