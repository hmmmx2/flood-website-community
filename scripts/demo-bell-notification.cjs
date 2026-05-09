/**
 * Inserts one demo in-app notification for the given user so the bell
 * lights up on next refresh of the community site. Used for SCRUM-126
 * screenshot evidence. Does NOT trigger SMS, WhatsApp, or email — those
 * channels only fire from the Java service's FloodAlertFanOutListener
 * which is reached via the ingest pipeline, not from raw row inserts.
 *
 * Usage:
 *   cd flood-website-community
 *   node scripts/demo-bell-notification.cjs
 */

const { Client } = require('pg');

const TARGET_EMAIL = 'whispertofu20@gmail.com';

const url =
  'postgresql://neondb_owner:npg_wWQz47ALcopb@ep-empty-wave-anxnq609-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const u = await c.query('SELECT id FROM users WHERE email = $1', [TARGET_EMAIL]);
    if (u.rowCount !== 1) {
      console.error(`No user found for ${TARGET_EMAIL}`);
      process.exit(1);
    }
    const userId = u.rows[0].id;

    const r = await c.query(
      `INSERT INTO user_notifications
         (id, user_id, kind, title, body, link, severity, created_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, created_at`,
      [
        userId,
        'flood.alert.demo',
        'Demo Critical Alert — Sungai Sarawak',
        'Water level reached 1.05 m near your saved place. Stay alert and monitor official channels.',
        '/flood-map?node=NODE-001',
        'critical',
      ],
    );

    console.log('Inserted notification id=' + r.rows[0].id + ' at ' + r.rows[0].created_at);
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
