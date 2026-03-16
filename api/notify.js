// api/notify.js  — Vercel Serverless Function (runs daily via cron)
// Add to vercel.json:  "crons": [{ "path": "/api/notify", "schedule": "0 6 * * *" }]
// This checks for events tomorrow and sends email via Resend

export default async function handler(req, res) {
  // Security: only allow Vercel cron or manual trigger with secret
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(400).json({ error: 'RESEND_API_KEY not set' });

  const tursoUrl = process.env.VITE_TURSO_URL;
  const tursoToken = process.env.VITE_TURSO_TOKEN;
  if (!tursoUrl || !tursoToken) return res.status(400).json({ error: 'Turso not configured' });

  // Get tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowMMDD = tomorrowStr.slice(5);
  const currentYear = String(new Date().getFullYear());

  // Fetch tomorrow's events from Turso via HTTP API
  const tursoRes = await fetch(`${tursoUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tursoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        type: 'execute',
        stmt: {
          sql: `SELECT * FROM events
                WHERE notify_email != ''
                AND (
                  (category = 'birthday' AND substr(date, 6, 5) = ? AND CAST(COALESCE(notified, 0) AS TEXT) != ?)
                  OR
                  (category != 'birthday' AND date = ? AND CAST(COALESCE(notified, 0) AS INTEGER) = 0)
                )`,
          args: [
            { type: 'text', value: tomorrowMMDD },
            { type: 'text', value: currentYear },
            { type: 'text', value: tomorrowStr },
          ]
        }
      }, { type: 'close' }]
    })
  });

  const tursoData = await tursoRes.json();
  const rows = tursoData.results?.[0]?.response?.result?.rows || [];

  if (rows.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No events tomorrow' });
  }

  const cols = tursoData.results?.[0]?.response?.result?.cols?.map(c => c.name) || [];

  function rowToObj(row) {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]?.value || ''; });
    return obj;
  }

  const events = rows.map(rowToObj);
  const sentEvents = [];

  for (const event of events) {
    if (!event.notify_email) continue;

    const isbirthday = event.category === 'birthday';
    const subject = isbirthday
      ? `🎂 Tomorrow is ${event.name}'s Birthday!`
      : `📅 Reminder: ${event.name} is tomorrow`;

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0d1a;color:#e8e8f5;padding:32px;border-radius:16px;">
        <h1 style="font-size:28px;margin-bottom:8px;">${isbirthday ? '🎂' : '📅'} ${isbirthday ? `${event.name}'s Birthday` : event.name}</h1>
        <p style="color:#7070a0;font-size:16px;">Tomorrow, ${new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
        ${event.notes ? `<div style="background:#1a1a35;border-radius:10px;padding:16px;margin-top:16px;"><p style="color:#a29bfe;margin:0;">${event.notes}</p></div>` : ''}
        <p style="color:#7070a0;font-size:12px;margin-top:24px;">Sent by Datebook • <a href="#" style="color:#7c6fff;">Manage notifications</a></p>
      </div>
    `;

    // Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Datebook <notifications@yourdomain.com>', // change to your verified domain
        to: [event.notify_email],
        subject,
        html,
      }),
    });

    if (emailRes.ok) sentEvents.push(event);
  }

  // Mark as notified
  if (sentEvents.length > 0) {
    await fetch(`${tursoUrl}/v2/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tursoToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: sentEvents.map((event) => ({
          type: 'execute',
          stmt: {
            sql: 'UPDATE events SET notified=? WHERE id=?',
            args: [
              { type: 'integer', value: event.category === 'birthday' ? currentYear : '1' },
              { type: 'text', value: event.id },
            ]
          }
        })).concat([{ type: 'close' }])
      })
    });
  }

  return res.status(200).json({ sent: sentEvents.length, total: events.length });
}
