// src/lib/db.js
// Turso HTTP pipeline client wrapper

let _client = null;

function toHttpUrl(url) {
  return String(url || '').replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
}

function toSqlArgs(args) {
  return (args || []).map((arg) => {
    if (arg === null || arg === undefined) return { type: 'null' };
    if (typeof arg === 'number') return { type: Number.isInteger(arg) ? 'integer' : 'float', value: String(arg) };
    if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
    return { type: 'text', value: String(arg) };
  });
}

function fromSqlValue(cell) {
  if (!cell) return null;
  if (cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  if (cell.type === 'float') return Number(cell.value);
  return cell.value;
}

function createHttpClient(url, authToken) {
  const baseUrl = toHttpUrl(url);

  return {
    async execute(input) {
      const stmt = typeof input === 'string'
        ? { sql: input }
        : { sql: input.sql, args: toSqlArgs(input.args) };

      const res = await fetch(`${baseUrl}/v2/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ type: 'execute', stmt }, { type: 'close' }],
        }),
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Invalid Turso response: ${text}`);
      }

      if (!res.ok) {
        throw new Error(`Turso HTTP ${res.status}: ${text}`);
      }

      const result = json?.results?.[0]?.response?.result;
      const cols = (result?.cols || []).map((c) => c.name);
      const rawRows = result?.rows || [];
      const rows = rawRows.map((row) => {
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = fromSqlValue(row[i]);
        });
        return obj;
      });

      return {
        rows,
        affectedRowCount: result?.affected_row_count || 0,
      };
    },
    async close() {},
  };
}

export function getClient() {
  if (_client) return _client;

  const url = import.meta.env.VITE_TURSO_URL;
  const authToken = import.meta.env.VITE_TURSO_TOKEN;

  if (!url || !authToken) {
    console.warn('Turso env vars missing – falling back to localStorage');
    return null;
  }

  return null;
}

export async function initDB() {
  const url = import.meta.env.VITE_TURSO_URL;
  const authToken = import.meta.env.VITE_TURSO_TOKEN;

  if (!url || !authToken) return null;

  try {
    _client = createHttpClient(url, authToken);

    await _client.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'event',
        notes TEXT DEFAULT '',
        notify_email TEXT DEFAULT '',
        notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('✅ Turso connected');
    return _client;
  } catch (e) {
    console.error('Turso init failed:', e);
    return null;
  }
}

// ---- CRUD helpers ----

export async function fetchAllEvents(client) {
  const res = await client.execute('SELECT * FROM events ORDER BY date ASC');
  return res.rows.map(rowToEvent);
}

export async function insertEvent(client, event) {
  await client.execute({
    sql: `INSERT INTO events (id, name, date, category, notes, notify_email)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [event.id, event.name, event.date, event.category, event.notes || '', event.notify_email || ''],
  });
}

export async function updateEvent(client, event) {
  await client.execute({
    sql: `UPDATE events SET name=?, date=?, category=?, notes=?, notify_email=?, updated_at=datetime('now')
          WHERE id=?`,
    args: [event.name, event.date, event.category, event.notes || '', event.notify_email || '', event.id],
  });
}

export async function deleteEventDB(client, id) {
  await client.execute({ sql: 'DELETE FROM events WHERE id=?', args: [id] });
}

export async function bulkInsertEvents(client, events) {
  for (const e of events) {
    await insertEvent(client, e);
  }
}

function rowToEvent(row) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    category: row.category,
    notes: row.notes || '',
    notify_email: row.notify_email || '',
    notified: !!row.notified,
  };
}
