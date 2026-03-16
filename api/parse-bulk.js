// api/parse-bulk.js
// Optional AI-assisted parser for messy bulk-import lines.

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonArray(text) {
  const direct = safeJsonParse(text);
  if (Array.isArray(direct)) return direct;

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = safeJsonParse(fenced[1]);
    if (Array.isArray(parsed)) return parsed;
  }

  const bracketStart = text.indexOf('[');
  const bracketEnd = text.lastIndexOf(']');
  if (bracketStart !== -1 && bracketEnd !== -1 && bracketEnd > bracketStart) {
    const parsed = safeJsonParse(text.slice(bracketStart, bracketEnd + 1));
    if (Array.isArray(parsed)) return parsed;
  }

  return null;
}

function sanitizeDate(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return iso.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free';
  if (!apiKey) {
    return res.status(400).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const lines = Array.isArray(req.body?.lines) ? req.body.lines.filter(Boolean) : [];
  const currentYear = Number(req.body?.currentYear || new Date().getFullYear());
  if (!lines.length) return res.status(200).json({ parsed: [] });

  const prompt = [
    'You parse messy date lines into strict JSON.',
    `Current year: ${currentYear}`,
    'Rules:',
    '- Input lines are usually in "date, name" format but date can be messy/typo-filled.',
    '- Infer intended date and return YYYY-MM-DD.',
    '- If year is missing, use current year.',
    '- Keep exact event name as much as possible.',
    '- Return ONLY a JSON array, no explanation.',
    '- Output item schema: {"line":"...","date":"YYYY-MM-DD","name":"..."}',
    'Lines:',
    ...lines.map((line, i) => `${i + 1}. ${line}`),
  ].join('\n');

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://datebook.local',
        'X-Title': 'Datebook Bulk Parser',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You are a precise date parser that outputs strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const raw = await aiRes.text();
    if (!aiRes.ok) {
      return res.status(aiRes.status).json({ error: 'AI parse failed', details: raw.slice(0, 500) });
    }

    const payload = safeJsonParse(raw);
    const content = payload?.choices?.[0]?.message?.content || '';
    const arr = extractJsonArray(content) || [];

    const parsed = arr
      .map((item) => {
        const date = sanitizeDate(item?.date);
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        const line = typeof item?.line === 'string' ? item.line.trim() : '';
        if (!date || !name) return null;
        return { line, date, name };
      })
      .filter(Boolean);

    return res.status(200).json({ parsed });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e?.message || String(e) });
  }
}
