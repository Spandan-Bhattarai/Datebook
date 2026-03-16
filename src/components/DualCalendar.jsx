// src/components/DualCalendar.jsx
import { useState } from 'react';
import { adToBS, BS_MONTHS, BS_MONTHS_EN, NP_DAYS } from '../lib/nepali';
import { CATEGORIES } from '../lib/constants';

const AD_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const AD_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DualCalendar({ events, onEventClick }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [adDate, setAdDate] = useState({ year: today.getFullYear(), month: today.getMonth() });

  // ---- AD calendar helpers ----
  const adFirstDay = new Date(adDate.year, adDate.month, 1).getDay();
  const adTotalDays = new Date(adDate.year, adDate.month + 1, 0).getDate();

  // ---- BS equivalents for current AD month range ----
  const adMonthStart = new Date(adDate.year, adDate.month, 1);
  const adMonthEnd = new Date(adDate.year, adDate.month + 1, 0);
  const bsStart = adToBS(adMonthStart);
  const bsEnd = adToBS(adMonthEnd);
  const todayBS = adToBS(today);

  // ---- Events lookup by AD date string ----
  const eventsByDate = {};
  events.forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  function adDateStr(day) {
    const m = String(adDate.month + 1).padStart(2,'0');
    const d = String(day).padStart(2,'0');
    return `${adDate.year}-${m}-${d}`;
  }

  function isToday(day) {
    return adDate.year === today.getFullYear() && adDate.month === today.getMonth() && day === today.getDate();
  }

  function prevMonth() {
    setAdDate(({ year, month }) => {
      if (month === 0) return { year: year - 1, month: 11 };
      return { year, month: month - 1 };
    });
  }

  function nextMonth() {
    setAdDate(({ year, month }) => {
      if (month === 11) return { year: year + 1, month: 0 };
      return { year, month: month + 1 };
    });
  }

  function getBSForDay(adDay) {
    const d = new Date(adDate.year, adDate.month, adDay);
    return adToBS(d);
  }

  function bsRangeLabelEn() {
    if (!bsStart || !bsEnd) return '';
    if (bsStart.year === bsEnd.year && bsStart.month === bsEnd.month) {
      return `${BS_MONTHS_EN[bsStart.month]} ${bsStart.year} BS`;
    }
    if (bsStart.year === bsEnd.year) {
      return `${BS_MONTHS_EN[bsStart.month]} - ${BS_MONTHS_EN[bsEnd.month]} ${bsStart.year} BS`;
    }
    return `${BS_MONTHS_EN[bsStart.month]} ${bsStart.year} - ${BS_MONTHS_EN[bsEnd.month]} ${bsEnd.year} BS`;
  }

  function bsRangeLabelNp() {
    if (!bsStart || !bsEnd) return '';
    if (bsStart.year === bsEnd.year && bsStart.month === bsEnd.month) {
      return `${BS_MONTHS[bsStart.month]} ${bsStart.year}`;
    }
    if (bsStart.year === bsEnd.year) {
      return `${BS_MONTHS[bsStart.month]} - ${BS_MONTHS[bsEnd.month]} ${bsStart.year}`;
    }
    return `${BS_MONTHS[bsStart.month]} ${bsStart.year} - ${BS_MONTHS[bsEnd.month]} ${bsEnd.year}`;
  }

  return (
    <div style={wrap}>
      {/* Nav */}
      <div style={navBar}>
        <button style={navBtn} onClick={prevMonth}>◀</button>
        <div style={navCenter}>
          <div style={navTitle}>{AD_MONTHS[adDate.month]} {adDate.year}</div>
          <div style={navSub} className="nepali-font">
            {bsRangeLabelNp()}
          </div>
          <div style={navSubEn}>{bsRangeLabelEn()}</div>
        </div>
        <button style={navBtn} onClick={nextMonth}>▶</button>
        <button style={navBtn} onClick={() => setAdDate({ year: today.getFullYear(), month: today.getMonth() })}>
          Today
        </button>
      </div>

      <div style={dualInfoBar}>
        <div style={dualInfoCard}>
          <div style={dualInfoLabel}>AD Today</div>
          <div style={dualInfoValue}>{AD_MONTHS[today.getMonth()]} {today.getDate()}, {today.getFullYear()}</div>
        </div>
        <div style={dualInfoCard}>
          <div style={dualInfoLabel}>BS Today</div>
          <div style={{ ...dualInfoValue, fontFamily: 'Tiro Devanagari Nepali, serif' }}>
            {todayBS ? `${todayBS.day} ${BS_MONTHS[todayBS.month]} ${todayBS.year}` : '-'}
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div style={grid}>
        {AD_DAYS.map((d, i) => (
          <div key={d} style={{ ...dayHeader, color: i === 0 || i === 6 ? '#ff6b9d' : 'var(--muted)' }}>
            <div>{d}</div>
            <div style={dayHeaderNp} className="nepali-font">{NP_DAYS[i]}</div>
          </div>
        ))}
      </div>

      {/* Cells */}
      <div style={grid}>
        {Array(adFirstDay).fill(null).map((_, i) => <div key={'pre'+i} style={emptyCell} />)}
        {Array(adTotalDays).fill(null).map((_, i) => {
          const day = i + 1;
          const ds = adDateStr(day);
          const dayEvts = eventsByDate[ds] || [];
          const bs = getBSForDay(day);
          const isSun = (adFirstDay + i) % 7 === 0;

          return (
            <div key={day} style={{
              ...cell,
              ...(isToday(day) ? todayCell : {}),
              ...(isSun ? { color: '#ff6b9d' } : {}),
            }}>
              <div style={cellTop}>
                <span style={adNum}>{day}</span>
                <span style={bsNum} className="nepali-font">{bs?.day || ''}</span>
              </div>
              {bs?.day === 1 && (
                <div style={bsMonthTag} className="nepali-font">{BS_MONTHS[bs.month]}</div>
              )}
              <div style={cellEvts}>
                {dayEvts.slice(0, 3).map((e) => {
                  const cat = CATEGORIES[e.category] || CATEGORIES.event;
                  return (
                    <div key={e.id} style={{ ...evtPill, background: cat.color + 'cc' }}
                      onClick={() => onEventClick(e)} title={e.name}>
                      {cat.emoji} {e.name.length > 9 ? e.name.slice(0,9)+'…' : e.name}
                    </div>
                  );
                })}
                {dayEvts.length > 3 && (
                  <div style={moreTag} onClick={() => onEventClick(dayEvts[3])}>+{dayEvts.length-3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const wrap = { display: 'flex', flexDirection: 'column', gap: 0, width: '100%' };
const navBar = {
  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
  padding: '12px 0',
};
const navBtn = {
  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '8px 14px', borderRadius: 9, fontWeight: 600, fontSize: 13,
};
const navCenter = { flex: 1, textAlign: 'center' };
const navTitle = { fontSize: 20, fontWeight: 800, color: 'var(--text)' };
const navSub = { fontSize: 13, color: 'var(--muted)', marginTop: 2 };
const navSubEn = { fontSize: 12, color: 'var(--muted)', marginTop: 2 };
const dualInfoBar = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginBottom: 12,
};
const dualInfoCard = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface2)',
  padding: '10px 12px',
};
const dualInfoLabel = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', fontWeight: 700 };
const dualInfoValue = { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 3 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 };
const dayHeader = { textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '6px 0 4px', letterSpacing: 0.5 };
const dayHeaderNp = { fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.9 };
const cell = {
  minHeight: 80, background: 'var(--surface)', borderRadius: 10, padding: 6,
  border: '1px solid var(--border)', overflow: 'hidden', transition: 'border .15s',
  cursor: 'default',
};
const emptyCell = { minHeight: 80 };
const todayCell = { border: '2px solid var(--accent)', background: 'rgba(124,111,255,0.08)' };
const cellTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 };
const adNum = { fontSize: 14, fontWeight: 700, color: 'var(--text)' };
const bsNum = { fontSize: 11, color: 'var(--muted)', marginTop: 1 };
const bsMonthTag = {
  fontSize: 10,
  color: 'var(--accent)',
  background: 'rgba(124,111,255,0.12)',
  border: '1px solid rgba(124,111,255,0.3)',
  borderRadius: 999,
  display: 'inline-block',
  padding: '1px 6px',
  marginBottom: 4,
};
const cellEvts = { display: 'flex', flexDirection: 'column', gap: 2 };
const evtPill = {
  fontSize: 10, color: '#fff', borderRadius: 4, padding: '2px 5px',
  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
  cursor: 'pointer', transition: 'opacity .1s',
};
const moreTag = { fontSize: 10, color: 'var(--accent)', cursor: 'pointer', paddingLeft: 4, fontWeight: 600 };
