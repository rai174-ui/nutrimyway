import { pool } from './src/lib/sqlite.js';
import { getCenterLimits, getTrialSettings } from './src/routes/admin.js';

async function test() {
  const centerId = 'DWK-1';
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const [{ checkinCap }, trialSettings] = await Promise.all([
      getCenterLimits(centerId),
      getTrialSettings(),
    ]);

    const [memberRes, menuRes, kcalRes, activeRes, expiringRes, weeklyRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM member_center_mapping WHERE center_id = $1', [centerId]),
      pool.query('SELECT COUNT(*) as count FROM menu_items WHERE center_id = $1', [centerId]),
      pool.query(
        `SELECT COALESCE(SUM(
           COALESCE(
             cl.calories_kcal,
             (SELECT SUM(mb.kcal) FROM menu_item_bom mb WHERE mb.menu_item_id = cl.menu_item_id AND mb.kcal IS NOT NULL)
           )
         ), 0) AS total_calories
         FROM consumption_logs cl
         JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
         WHERE mcm.center_id = $1 AND DATE(cl.logged_at AT TIME ZONE 'Asia/Kolkata') = $2 AND cl.checkin_id IS NOT NULL`,
        [centerId, today]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT member_id) AS count
         FROM member_check_ins
         WHERE center_id = $1 AND cancelled = FALSE AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = $2`,
        [centerId, today]
      ),
      pool.query(
        `SELECT COUNT(*) AS count
         FROM members m
         JOIN member_center_mapping mcm ON mcm.member_id = m.id
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS used FROM member_check_ins mci
           WHERE mci.member_id = m.id AND mci.cancelled = FALSE AND mci.checked_in_at >= COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz)
         ) ci ON TRUE
         WHERE mcm.center_id = $1
           AND (
             (m.valid_until IS NOT NULL AND DATE(m.valid_until) <= CURRENT_DATE + INTERVAL '10 days')
             OR COALESCE(ci.used, 0) >= (CASE WHEN m.member_type = 'trial_3day' THEN $3 ELSE $2 END)
           )`,
        [centerId, checkinCap, trialSettings.checkinCap]
      ),
      pool.query(
        `SELECT TO_CHAR(checked_in_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
                COUNT(DISTINCT member_id) AS count
         FROM member_check_ins
         WHERE center_id = $1
           AND cancelled = FALSE
           AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')
           AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') <  DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 month'
         GROUP BY day ORDER BY day`,
        [centerId]
      ),
    ]);
    console.log('Success!', expiringRes.rows);
  } catch(e) {
    console.error('ERROR:', e);
  }
  process.exit(0);
}
test();
