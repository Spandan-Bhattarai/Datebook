// src/lib/bulkParser.js

const MONTH_TOKENS = {
  january: 'january', jan: 'january', janurary: 'january', janury: 'january',
  february: 'february', feb: 'february', feburary: 'february', febuary: 'february',
  march: 'march', mar: 'march',
  april: 'april', apr: 'april',
  may: 'may',
  june: 'june', jun: 'june',
  july: 'july', jul: 'july',
  august: 'august', aug: 'august', agust: 'august',
  september: 'september', sep: 'september', sept: 'september', setember: 'september',
  october: 'october', oct: 'october', octuber: 'october',
  november: 'november', nov: 'november',
  december: 'december', dec: 'december', decemeber: 'december',
};

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function normalizeMonthToken(token) {
  const clean = token.toLowerCase();
  if (MONTH_TOKENS[clean]) return MONTH_TOKENS[clean];

  let best = null;
  let bestDist = Infinity;
  for (const month of MONTH_NAMES) {
    const d = editDistance(clean, month);
    if (d < bestDist) {
      bestDist = d;
      best = month;
    }
  }
  return bestDist <= 2 ? best : token;
}

function normalizeDateText(raw) {
  const stripped = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .replace(/[.]+/g, ' ')
    .replace(/\s+/g, ' ');

  return stripped
    .split(' ')
    .map((w) => normalizeMonthToken(w))
    .join(' ')
    .trim();
}

function toISO(y, m, d) {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) return null;

  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function parseDateFlexible(raw, currentYear) {
  const t = normalizeDateText(raw);
  if (!t) return null;

  let m;

  m = t.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) return toISO(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (a > 12) return toISO(y, b, a);
    return toISO(y, a, b);
  }

  m = t.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (m) return toISO(currentYear, Number(m[1]), Number(m[2]));

  m = t.match(/^(\d{1,2})\s+(\d{1,2})$/);
  if (m) return toISO(currentYear, Number(m[1]), Number(m[2]));

  m = t.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (m) {
    const monthName = normalizeMonthToken(m[1]);
    const monthIdx = MONTH_NAMES.indexOf(monthName);
    if (monthIdx !== -1) {
      const day = Number(m[2]);
      const year = m[3] ? Number(m[3]) : currentYear;
      return toISO(year, monthIdx + 1, day);
    }
  }

  m = t.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (m) {
    const monthName = normalizeMonthToken(m[2]);
    const monthIdx = MONTH_NAMES.indexOf(monthName);
    if (monthIdx !== -1) {
      const day = Number(m[1]);
      const year = m[3] ? Number(m[3]) : currentYear;
      return toISO(year, monthIdx + 1, day);
    }
  }

  const hasYear = /\b\d{4}\b/.test(t);
  if (!/\d/.test(t)) return null;
  const candidate = hasYear ? t : `${t} ${currentYear}`;
  const parsed = new Date(Date.parse(candidate));
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = parsed.getMonth() + 1;
    const d = parsed.getDate();
    return toISO(y, mo, d);
  }

  return null;
}

function cleanName(name) {
  return String(name || '')
    .trim()
    .replace(/^[-:|,\s]+/, '')
    .replace(/^(on|for)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSplitLine(line, currentYear) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { raw: '', name: '' };

  // Try date at the beginning: "aug 1 dad birthday"
  for (let i = 1; i <= Math.min(6, words.length - 1); i++) {
    const raw = words.slice(0, i).join(' ');
    const iso = parseDateFlexible(raw, currentYear);
    if (!iso) continue;
    const name = cleanName(words.slice(i).join(' '));
    if (name) return { raw, name };
  }

  // Try date at the end: "dad birthday aug 1"
  for (let i = 1; i <= Math.min(6, words.length - 1); i++) {
    const raw = words.slice(words.length - i).join(' ');
    const iso = parseDateFlexible(raw, currentYear);
    if (!iso) continue;
    const name = cleanName(words.slice(0, words.length - i).join(' '));
    if (name) return { raw, name };
  }

  return { raw: '', name: '' };
}

function splitLine(line, currentYear) {
  const sepMatch = line.match(/[\t|,]/);
  if (sepMatch) {
    const idx = sepMatch.index;
    const raw = line.slice(0, idx).trim();
    const name = cleanName(line.slice(idx + 1));
    return { raw, name };
  }

  const dash = line.match(/^(.+?)\s+-\s+(.+)$/);
  if (dash) return { raw: dash[1].trim(), name: cleanName(dash[2]) };

  return inferSplitLine(line, currentYear);
}

export function parseBulkText(text, category, currentYear = new Date().getFullYear()) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const parsed = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
    const { raw, name } = splitLine(line, currentYear);
    if (!raw || !name) {
      invalidLines.push({ line, index, reason: 'format' });
      return;
    }

    const iso = parseDateFlexible(raw, currentYear);
    if (!iso) {
      invalidLines.push({ line, index, reason: 'date' });
      return;
    }

    parsed.push({
      id: crypto.randomUUID(),
      date: iso,
      name,
      category,
      notes: '',
      notify_email: '',
    });
  });

  return { parsed, invalidLines };
}
