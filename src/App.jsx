// src/App.jsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useEvents } from './lib/useEvents';
import { CATEGORIES, daysUntil, formatADDate, todayISO } from './lib/constants';
import { formatBSDate, formatBSDateEn, adToBS, bsToAD, BS_MONTHS_EN } from './lib/nepali';
import { isAuthConfigured, verifyLogin } from './lib/auth';
import { parseBulkText } from './lib/bulkParser';
import EventModal from './components/EventModal';
import DualCalendar from './components/DualCalendar';
import Toast from './components/Toast';

const VIEWS = ['overview', 'calendar', 'add', 'bulk', 'list', 'past', 'converter', 'age', 'settings'];
const VIEW_ICONS = {
  overview: '🏠', calendar: '🗓️', add: '➕', bulk: '📋', list: '📄',
  past: '🕰️', converter: '🔁', age: '🎂', settings: '⚙️'
};
const VIEW_LABELS = {
  overview: 'Overview', calendar: 'Calendar', add: 'Add Event', bulk: 'Bulk Import',
  list: 'All Events', past: 'Past Events', converter: 'Date Converter', age: 'Age Calculator', settings: 'Settings'
};

function toISOFromDateObject(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function renderDaysLabel(days) {
  if (days === 0) return '🎉 Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return '1d ago';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days}d`;
}

function getNextBirthdayISO(dateStr) {
  const base = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(base.getTime())) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidate = new Date(today.getFullYear(), base.getMonth(), base.getDate());
  candidate.setHours(0, 0, 0, 0);
  if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
  return toISOFromDateObject(candidate);
}

function getEffectiveEventDate(event) {
  if (event.category === 'birthday') return getNextBirthdayISO(event.date);
  return event.date;
}

export default function App() {
  const { events, loading, error, addEvent, editEvent, removeEvent, bulkAdd, isDB } = useEvents();
  const [view, setView] = useState('overview');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [toast, setToast] = useState(null);
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('datebook_auth') === 'ok');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  // Form state
  const [form, setForm] = useState({ date: todayISO(), name: '', category: 'event', notes: '', notify_email: '' });
  const [addDateMode, setAddDateMode] = useState('ad'); // ad | bs
  const initialBS = adToBS(new Date(todayISO() + 'T00:00:00')) || { year: 2082, month: 0, day: 1 };
  const [bsForm, setBsForm] = useState({ year: initialBS.year, month: initialBS.month + 1, day: initialBS.day });
  const [bulkText, setBulkText] = useState('');
  const [bulkCat, setBulkCat] = useState('birthday');
  const [emailSetting, setEmailSetting] = useState(() => localStorage.getItem('datebook_email') || '');

  const [converterTab, setConverterTab] = useState('ad2bs');
  const [adConvertDate, setAdConvertDate] = useState(todayISO());
  const [bsConvert, setBsConvert] = useState({ year: initialBS.year, month: initialBS.month + 1, day: initialBS.day });

  const [ageMode, setAgeMode] = useState('ad');
  const [ageAdDate, setAgeAdDate] = useState(todayISO());
  const [ageBsDate, setAgeBsDate] = useState({ year: initialBS.year, month: initialBS.month + 1, day: initialBS.day });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
    document.body.style.overflow = '';
  }, [isMobile, mobileMenuOpen]);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    const onInstalled = () => {
      setDeferredInstallPrompt(null);
      notify('Datebook installed!');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function notify(msg, type = 'success') {
    setToast({ msg, type });
  }

  function updateBSForm(next) {
    setBsForm(next);
    const adDate = bsToAD(Number(next.year), Number(next.month) - 1, Number(next.day));
    if (adDate && !Number.isNaN(adDate.getTime())) {
      setForm((f) => ({ ...f, date: toISOFromDateObject(adDate) }));
    }
  }

  function getAge(adDateStr) {
    const birth = new Date(adDateStr + 'T00:00:00');
    const now = new Date();
    birth.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    if (Number.isNaN(birth.getTime()) || birth > now) return null;

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
      const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonthDays;
      months -= 1;
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }

    const totalDays = Math.floor((now - birth) / 86400000);
    return { years, months, days, totalDays };
  }

  // ---- Add single event ----
  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name || !form.date) return;
    await addEvent({ ...form, notify_email: emailSetting });
    setForm(f => ({ ...f, name: '', notes: '' }));
    notify('Event added!');
    setView('list');
  }

  // ---- Bulk import ----
  async function handleBulk() {
    const { parsed, invalidLines } = parseBulkText(bulkText, bulkCat);

    let aiParsed = [];
    let aiUnavailable = false;
    if (invalidLines.length > 0) {
      try {
        const res = await fetch('/api/parse-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: invalidLines.map((x) => x.line),
            currentYear: new Date().getFullYear(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          aiParsed = (data?.parsed || []).map((x) => ({
            id: crypto.randomUUID(),
            date: x.date,
            name: x.name,
            category: bulkCat,
            notes: '',
            notify_email: '',
          }));
        } else {
          aiUnavailable = true;
        }
      } catch {
        aiUnavailable = true;
      }
    }

    const combined = [...parsed, ...aiParsed];
    if (!combined.length) {
      if (aiUnavailable) {
        notify('No valid entries. AI fallback unavailable in this runtime; try deploy/Vercel dev. Example: aug 1 dad birthday', 'error');
      } else {
        notify('No valid entries. Try: aug 1 dad birthday OR august 1, dad birthday', 'error');
      }
      return;
    }

    const tagged = combined.map(e => ({ ...e, notify_email: emailSetting }));
    const count = await bulkAdd(tagged);
    setBulkText('');
    const aiMsg = aiParsed.length ? ` (${aiParsed.length} fixed by AI)` : '';
    const skipped = invalidLines.length - aiParsed.length;
    const skipMsg = skipped > 0 ? `, ${skipped} skipped` : '';
    notify(`Added ${count} entries${aiMsg}${skipMsg}!`);
    setView('list');
  }

  // ---- Edit/delete via modal ----
  async function handleSave(event) {
    await editEvent(event);
    notify('Saved!');
  }
  async function handleDelete(id) {
    await removeEvent(id);
    notify('Deleted', 'info');
  }

  const normalizedEvents = useMemo(() => {
    return events.map((e) => {
      const effectiveDate = getEffectiveEventDate(e);
      return {
        ...e,
        effectiveDate,
      };
    });
  }, [events]);

  // ---- Filtered + sorted events ----

  const filtered = useMemo(() => {
    return normalizedEvents
      .filter(e => (filterCat === 'all' || e.category === filterCat) &&
        e.name.toLowerCase().includes(search.toLowerCase()) &&
        daysUntil(e.effectiveDate) >= 0)
      .sort((a, b) => {
        const da = daysUntil(a.effectiveDate), db = daysUntil(b.effectiveDate);
        return sortDir === 'asc' ? da - db : db - da;
      });
  }, [normalizedEvents, filterCat, search, sortDir]);

  const pastEvents = useMemo(() => {
    return [...normalizedEvents]
      .filter((e) => daysUntil(e.effectiveDate) < 0)
      .sort((a, b) => daysUntil(b.effectiveDate) - daysUntil(a.effectiveDate));
  }, [normalizedEvents]);

  const upcoming5 = useMemo(() => {
    return [...normalizedEvents]
      .map(e => ({ ...e, days: daysUntil(e.effectiveDate) }))
      .filter((e) => e.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);
  }, [normalizedEvents]);

  const calendarEvents = useMemo(() => {
    return normalizedEvents.map((e) => ({ ...e, date: e.effectiveDate }));
  }, [normalizedEvents]);

  const adConverted = useMemo(() => {
    const bs = adToBS(new Date(adConvertDate + 'T00:00:00'));
    return bs;
  }, [adConvertDate]);

  const bsConvertedDate = useMemo(() => {
    const d = bsToAD(Number(bsConvert.year), Number(bsConvert.month) - 1, Number(bsConvert.day));
    if (!d || Number.isNaN(d.getTime())) return '';
    return toISOFromDateObject(d);
  }, [bsConvert]);

  const ageFromAD = useMemo(() => getAge(ageAdDate), [ageAdDate]);
  const ageFromBS = useMemo(() => {
    const d = bsToAD(Number(ageBsDate.year), Number(ageBsDate.month) - 1, Number(ageBsDate.day));
    if (!d || Number.isNaN(d.getTime())) return null;
    return getAge(toISOFromDateObject(d));
  }, [ageBsDate]);

  const catCounts = useMemo(() => {
    const counts = {};
    events.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return counts;
  }, [events]);

  // ---- Export / Import ----
  function exportJSON() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'datebook.json' }).click();
  }
  function importJSON(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const existing = new Set(events.map(x => x.id));
        const newOnes = data.filter(x => !existing.has(x.id));
        await bulkAdd(newOnes);
        notify(`Imported ${newOnes.length} new events`);
      } catch { notify('Invalid file', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (!isAuthConfigured()) {
        setAuthError('Login is not configured. Set VITE_AUTH_USERNAME_SALT/HASH and VITE_AUTH_PASSWORD_SALT/HASH.');
        return;
      }

      const ok = await verifyLogin(authForm.username, authForm.password);
      if (!ok) {
        setAuthError('Invalid login credentials.');
        return;
      }
      localStorage.setItem('datebook_auth', 'ok');
      setIsAuthed(true);
    } catch {
      setAuthError('Login failed in this browser.');
    } finally {
      setAuthLoading(false);
      setAuthForm((f) => ({ ...f, password: '' }));
    }
  }

  function logout() {
    localStorage.removeItem('datebook_auth');
    setIsAuthed(false);
    setAuthForm({ username: '', password: '' });
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      notify('Install prompt not available yet', 'warn');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  }

  if (!isAuthed) {
    return (
      <div style={loginRoot}>
        <style>{globalCSS}</style>
        <div style={loginCard}>
          <div style={logo}><span style={{ fontSize: 26 }}>📅</span><span style={{ fontWeight: 900, fontSize: 18 }}>Datebook</span></div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Private Login Portal</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 18, fontSize: 14 }}>Only authenticated users can access your dates.</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Username">
              <input value={authForm.username} onChange={(e) => setAuthForm((f) => ({ ...f, username: e.target.value }))} placeholder="username" required autoComplete="username" />
            </Field>
            <Field label="Password">
              <input type="password" value={authForm.password} onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••••" required autoComplete="current-password" />
            </Field>
            {authError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>⚠️ {authError}</div>}
            <button style={{ ...submitBtn, width: '100%', justifyContent: 'center' }} type="submit" disabled={authLoading}>
              {authLoading ? 'Checking...' : 'Login'}
            </button>
          </form>
          <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 12 }}>Auth settings are loaded from env vars with PBKDF2 hash verification.</p>
        </div>
      </div>
    );
  }

  const rootStyle = { ...root, ...(isMobile ? rootMobile : {}) };
  const sidebarStyle = {
    ...sidebar,
    ...(isMobile ? {
      ...sidebarMobile,
      ...(mobileMenuOpen ? sidebarMobileOpen : sidebarMobileClosed),
    } : {}),
  };
  const navBtnStyle = { ...navBtn, ...(isMobile ? navBtnMobile : {}) };
  const mainAreaStyle = { ...mainArea, ...(isMobile ? mainAreaMobile : {}) };
  const pageStyle = { ...page, ...(isMobile ? pageMobile : {}) };
  const formSplitStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 };
  const listCardStyle = { ...listCard, ...(isMobile ? listCardMobile : {}) };

  return (
    <div style={rootStyle}>
      <style>{globalCSS}</style>

      {isMobile && (
        <div style={mobileTopbar}>
          <button style={mobileMenuBtn} onClick={() => setMobileMenuOpen((v) => !v)}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          <div style={mobileTopbarTitle}>
            <span style={{ fontSize: 20 }}>📅</span>
            <span>Datebook</span>
          </div>
          <div style={mobileTopbarView}>{VIEW_LABELS[view]}</div>
        </div>
      )}

      {isMobile && mobileMenuOpen && <div style={mobileBackdrop} onClick={() => setMobileMenuOpen(false)} />}

      {/* Sidebar */}
      <aside style={sidebarStyle}>
        <div style={logo}>
          <span style={{ fontSize: 26 }}>📅</span>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>Datebook</span>
        </div>

        <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 12, display: isMobile ? 'none' : 'block' }}>
          Menu
        </div>

        {VIEWS.map(v => (
          <button key={v} style={{ ...navBtnStyle, ...(view === v ? navActive : {}) }} onClick={() => {
            setView(v);
            if (isMobile) setMobileMenuOpen(false);
          }}>
            <span style={{ fontSize: 16 }}>{VIEW_ICONS[v]}</span>
            {VIEW_LABELS[v]}
          </button>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: isDB ? 'var(--success)' : 'var(--warn)', fontWeight: 600, paddingLeft: isMobile ? 0 : 12 }}>
            {isDB ? '🟢 Turso connected' : '🟡 Local storage mode'}
          </div>
          <button style={{ ...sideBtn, ...(isMobile ? sideBtnMobile : {}) }} onClick={exportJSON}>⬇️ Export JSON</button>
          <label style={{ ...sideBtn, ...(isMobile ? sideBtnMobile : {}) }}>
            ⬆️ Import JSON
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} />
          </label>
          {deferredInstallPrompt && <button style={{ ...sideBtn, ...(isMobile ? sideBtnMobile : {}) }} onClick={installApp}>📲 Install App</button>}
          <button style={{ ...sideBtn, ...(isMobile ? sideBtnMobile : {}) }} onClick={logout}>🔒 Logout</button>
        </div>
      </aside>

      {/* Main */}
      <main style={mainAreaStyle}>

        {loading && (
          <div style={centerMsg}><div style={spinner} />Loading events...</div>
        )}

        {error && !loading && (
          <div style={{ background: '#ff475720', border: '1px solid #ff475740', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: 'var(--danger)', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {view === 'overview' && !loading && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Good {getTimeOfDay()}, here's your calendar 👋</h1>

            {/* Stats */}
            <div style={statsGrid}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <div key={k} style={{ ...statCard, borderColor: v.color + '55', background: v.bg }}
                  onClick={() => { setFilterCat(k); setView('list'); }}>
                  <span style={{ fontSize: 22 }}>{v.emoji}</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: v.color }}>{catCounts[k] || 0}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{v.label}</span>
                </div>
              ))}
            </div>

            {/* Upcoming */}
            <h2 style={sectionTitle}>⚡ Next Up</h2>
            {upcoming5.length === 0 && <p style={emptyMsg}>No events yet. Add some!</p>}
            <div style={cardStack}>
              {upcoming5.map(e => {
                const cat = CATEGORIES[e.category] || CATEGORIES.event;
                return (
                  <div key={e.id} style={{ ...eventCard, borderLeft: `4px solid ${cat.color}`, background: cat.bg }}
                    onClick={() => setSelectedEvent(e)}>
                    <span style={{ fontSize: 26 }}>{cat.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={evtName}>{e.category === 'birthday' ? `Happy Birthday, ${e.name}! 🎉` : e.name}</div>
                      <div style={evtDate}>{formatADDate(e.effectiveDate || e.date)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }} className="nepali-font">
                        {formatBSDate(e.effectiveDate || e.date)}
                        <span style={{ marginLeft: 8, fontFamily: 'Outfit, sans-serif' }}>({formatBSDateEn(e.effectiveDate || e.date)})</span>
                      </div>
                    </div>
                    <div style={{ ...daysChip, color: cat.color, borderColor: cat.color + '44', background: cat.bg }}>
                      {e.days === 0 ? '🎉 Today!' : e.days === 1 ? 'Tomorrow' : `${e.days}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CALENDAR ── */}
        {view === 'calendar' && !loading && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Calendar</h1>
            <DualCalendar events={calendarEvents} onEventClick={setSelectedEvent} />
          </div>
        )}

        {/* ── ADD EVENT ── */}
        {view === 'add' && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Add Event</h1>
            <form onSubmit={handleAdd} style={formWrap}>
              <Field label="Name / Title">
                <input placeholder="e.g. FIFA World Cup Final" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </Field>
              <div style={tabRow}>
                <button type="button" style={{ ...tabBtn, ...(addDateMode === 'ad' ? tabBtnActive : {}) }} onClick={() => setAddDateMode('ad')}>AD Date</button>
                <button type="button" style={{ ...tabBtn, ...(addDateMode === 'bs' ? tabBtnActive : {}) }} onClick={() => setAddDateMode('bs')}>BS Date</button>
              </div>

              {addDateMode === 'ad' ? (
              <div style={formSplitStyle}>
                <Field label="Date (AD)">
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              ) : (
                <>
                  <div style={formSplitStyle}>
                    <Field label="BS Year">
                      <input type="number" value={bsForm.year}
                        onChange={e => updateBSForm({ ...bsForm, year: e.target.value })} min={2000} max={2200} required />
                    </Field>
                    <Field label="BS Month">
                      <select value={bsForm.month} onChange={e => updateBSForm({ ...bsForm, month: e.target.value })}>
                        {BS_MONTHS_EN.map((m, i) => <option key={m} value={i + 1}>{i + 1}. {m}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={formSplitStyle}>
                    <Field label="BS Day">
                      <input type="number" value={bsForm.day}
                        onChange={e => updateBSForm({ ...bsForm, day: e.target.value })} min={1} max={32} required />
                    </Field>
                    <Field label="Converted AD Date">
                      <input type="date" value={form.date} readOnly />
                    </Field>
                  </div>
                  <div style={formSplitStyle}>
                    <Field label="Category">
                      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        {Object.entries(CATEGORIES).map(([k, v]) => (
                          <option key={k} value={k}>{v.emoji} {v.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </>
              )}
              {form.date && (
                <div style={bsPreview} className="nepali-font">
                  📅 BS: {formatBSDate(form.date)}
                  <span style={{ fontFamily: 'Outfit', color: 'var(--muted)', marginLeft: 8 }}>
                    ({formatBSDateEn(form.date)})
                  </span>
                </div>
              )}
              <Field label="Notes (optional)">
                <textarea rows={3} placeholder="Any extra details..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </Field>
              <button style={submitBtn} type="submit">Add Event ✨</button>
            </form>
          </div>
        )}

        {/* ── BULK IMPORT ── */}
        {view === 'bulk' && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Bulk Import</h1>
            <div style={hintBox}>
              <strong>Format:</strong> one event per line as <code>date, name</code><br />
              Examples:<br />
              <code>March 15, John Smith</code><br />
              <code>2025-12-18, Doomsday movie release</code><br />
              <code>June 20 2025, FIFA World Cup Final</code>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={fldLabel}>Category for all entries</div>
              <div style={catGrid}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <button key={k} type="button"
                    style={{ ...catChip, background: bulkCat === k ? v.color : v.bg, color: bulkCat === k ? '#fff' : v.color, borderColor: v.color }}
                    onClick={() => setBulkCat(k)}>{v.emoji} {v.label}</button>
                ))}
              </div>
            </div>
            <textarea rows={14} style={{ width: '100%', maxWidth: 620, marginBottom: 16 }}
              placeholder={"March 15, John Smith\nApril 22, Sarah Connor\nDecember 18, FIFA World Cup Final\n2025-06-06, Ramayana Movie"}
              value={bulkText} onChange={e => setBulkText(e.target.value)} />
            <br />
            <button style={submitBtn} onClick={handleBulk}>Import All ✨</button>
          </div>
        )}

        {/* ── LIST ── */}
        {view === 'list' && !loading && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>All Events ({events.length})</h1>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="all">All Categories</option>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
              <button style={{ ...sideBtn, padding: '8px 14px' }}
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                {sortDir === 'asc' ? '↑ Soonest first' : '↓ Latest first'}
              </button>
            </div>
            {filtered.length === 0 && <p style={emptyMsg}>No events found.</p>}
            <div style={listGrid}>
              {filtered.map(e => {
                const cat = CATEGORIES[e.category] || CATEGORIES.event;
                const days = daysUntil(e.effectiveDate || e.date);
                return (
                  <div key={e.id} style={{ ...listCardStyle, borderLeft: `3px solid ${cat.color}` }}
                    onClick={() => setSelectedEvent(e)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                      <div>
                        <div style={evtName}>{e.category === 'birthday' ? `🎂 ${e.name}` : e.name}</div>
                        <div style={evtDate}>{formatADDate(e.effectiveDate || e.date)}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }} className="nepali-font">
                          {formatBSDate(e.effectiveDate || e.date)}
                        </div>
                      </div>
                    </div>
                    <div style={{ ...daysChip, color: cat.color, borderColor: cat.color + '44', background: cat.bg, flexShrink: 0 }}>
                      {renderDaysLabel(days)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PAST ── */}
        {view === 'past' && !loading && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Past Events ({pastEvents.length})</h1>
            {pastEvents.length === 0 && <p style={emptyMsg}>No completed/past events yet.</p>}
            <div style={listGrid}>
              {pastEvents.map((e) => {
                const cat = CATEGORIES[e.category] || CATEGORIES.event;
                const days = daysUntil(e.effectiveDate || e.date);
                return (
                  <div key={e.id} style={{ ...listCardStyle, borderLeft: `3px solid ${cat.color}`, opacity: 0.86 }} onClick={() => setSelectedEvent(e)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                      <div>
                        <div style={evtName}>{e.name}</div>
                        <div style={evtDate}>{formatADDate(e.effectiveDate || e.date)}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }} className="nepali-font">{formatBSDate(e.effectiveDate || e.date)}</div>
                      </div>
                    </div>
                    <div style={{ ...daysChip, color: 'var(--muted)', borderColor: 'var(--border)', background: 'var(--surface2)' }}>
                      {renderDaysLabel(days)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONVERTER ── */}
        {view === 'converter' && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Date Converter</h1>
            <div style={tabRow}>
              <button type="button" style={{ ...tabBtn, ...(converterTab === 'ad2bs' ? tabBtnActive : {}) }} onClick={() => setConverterTab('ad2bs')}>AD → BS</button>
              <button type="button" style={{ ...tabBtn, ...(converterTab === 'bs2ad' ? tabBtnActive : {}) }} onClick={() => setConverterTab('bs2ad')}>BS → AD</button>
            </div>

            {converterTab === 'ad2bs' && (
              <div style={settingCard}>
                <Field label="AD Date">
                  <input type="date" value={adConvertDate} onChange={(e) => setAdConvertDate(e.target.value)} />
                </Field>
                <div style={hintBox}>
                  <strong>BS Result:</strong><br />
                  {adConverted ? `${adConverted.day} ${BS_MONTHS_EN[adConverted.month]} ${adConverted.year} BS` : 'Invalid AD date'}
                </div>
              </div>
            )}

            {converterTab === 'bs2ad' && (
              <div style={settingCard}>
                <div style={formSplitStyle}>
                  <Field label="BS Year">
                    <input type="number" value={bsConvert.year} onChange={(e) => setBsConvert({ ...bsConvert, year: e.target.value })} min={2000} max={2200} />
                  </Field>
                  <Field label="BS Month">
                    <select value={bsConvert.month} onChange={(e) => setBsConvert({ ...bsConvert, month: e.target.value })}>
                      {BS_MONTHS_EN.map((m, i) => <option key={m} value={i + 1}>{i + 1}. {m}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={formSplitStyle}>
                  <Field label="BS Day">
                    <input type="number" value={bsConvert.day} onChange={(e) => setBsConvert({ ...bsConvert, day: e.target.value })} min={1} max={32} />
                  </Field>
                  <Field label="AD Result">
                    <input type="text" value={bsConvertedDate ? formatADDate(bsConvertedDate) : 'Invalid BS date'} readOnly />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AGE ── */}
        {view === 'age' && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Age Calculator</h1>
            <div style={tabRow}>
              <button type="button" style={{ ...tabBtn, ...(ageMode === 'ad' ? tabBtnActive : {}) }} onClick={() => setAgeMode('ad')}>Birthdate in AD</button>
              <button type="button" style={{ ...tabBtn, ...(ageMode === 'bs' ? tabBtnActive : {}) }} onClick={() => setAgeMode('bs')}>Birthdate in BS</button>
            </div>

            {ageMode === 'ad' ? (
              <div style={settingCard}>
                <Field label="Birthdate (AD)">
                  <input type="date" value={ageAdDate} onChange={(e) => setAgeAdDate(e.target.value)} />
                </Field>
                {ageFromAD ? (
                  <div style={metricGrid}>
                    <div style={metricCard}><div style={metricNum}>{ageFromAD.years}</div><div style={metricLbl}>Years</div></div>
                    <div style={metricCard}><div style={metricNum}>{ageFromAD.months}</div><div style={metricLbl}>Months</div></div>
                    <div style={metricCard}><div style={metricNum}>{ageFromAD.days}</div><div style={metricLbl}>Days</div></div>
                    <div style={metricCard}><div style={metricNum}>{ageFromAD.totalDays}</div><div style={metricLbl}>Total Days</div></div>
                  </div>
                ) : <p style={emptyMsg}>Enter a valid birthdate not in the future.</p>}
              </div>
            ) : (
              <div style={settingCard}>
                <div style={formSplitStyle}>
                  <Field label="BS Year"><input type="number" value={ageBsDate.year} onChange={(e) => setAgeBsDate({ ...ageBsDate, year: e.target.value })} min={2000} max={2200} /></Field>
                  <Field label="BS Month">
                    <select value={ageBsDate.month} onChange={(e) => setAgeBsDate({ ...ageBsDate, month: e.target.value })}>
                      {BS_MONTHS_EN.map((m, i) => <option key={m} value={i + 1}>{i + 1}. {m}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={formSplitStyle}>
                  <Field label="BS Day"><input type="number" value={ageBsDate.day} onChange={(e) => setAgeBsDate({ ...ageBsDate, day: e.target.value })} min={1} max={32} /></Field>
                  <Field label="Converted AD Birthdate"><input type="text" value={(() => {
                    const d = bsToAD(Number(ageBsDate.year), Number(ageBsDate.month) - 1, Number(ageBsDate.day));
                    return d && !Number.isNaN(d.getTime()) ? formatADDate(toISOFromDateObject(d)) : 'Invalid BS date';
                  })()} readOnly /></Field>
                </div>
                {ageFromBS ? (
                  <div style={metricGrid}>
                    <div style={metricCard}><div style={metricNum}>{ageFromBS.years}</div><div style={metricLbl}>Years</div></div>
                    <div style={metricCard}><div style={metricNum}>{ageFromBS.months}</div><div style={metricLbl}>Months</div></div>
                    <div style={metricCard}><div style={metricNum}>{ageFromBS.days}</div><div style={metricLbl}>Days</div></div>
                    <div style={metricCard}><div style={metricNum}>{ageFromBS.totalDays}</div><div style={metricLbl}>Total Days</div></div>
                  </div>
                ) : <p style={emptyMsg}>Enter a valid BS birthdate.</p>}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {view === 'settings' && (
          <div style={pageStyle}>
            <h1 style={pageTitle}>Settings</h1>

            <div style={settingCard}>
              <h3 style={settingTitle}>📧 Email Notifications</h3>
              <p style={settingDesc}>
                Get an email 1 day before each event. Powered by <a href="https://resend.com" target="_blank" style={{ color: 'var(--accent)' }}>Resend</a> (free: 3,000 emails/month).
                <br />Set up: create a free Resend account → get API key → add <code>RESEND_API_KEY</code> to Vercel env → deploy the cron job (see README).
              </p>
              <Field label="Your email for notifications">
                <input type="email" placeholder="you@example.com" value={emailSetting}
                  onChange={e => setEmailSetting(e.target.value)} style={{ maxWidth: 340 }} />
              </Field>
              <button style={{ ...submitBtn, marginTop: 12 }} onClick={() => {
                localStorage.setItem('datebook_email', emailSetting);
                notify('Email saved!');
              }}>Save Email</button>
            </div>

            <div style={settingCard}>
              <h3 style={settingTitle}>🗄️ Database</h3>
              <p style={settingDesc}>
                Currently using: <strong style={{ color: isDB ? 'var(--success)' : 'var(--warn)' }}>{isDB ? 'Turso (cloud)' : 'localStorage (local)'}</strong>
                <br />To connect Turso, add <code>VITE_TURSO_URL</code> and <code>VITE_TURSO_TOKEN</code> to your <code>.env</code> file.
              </p>
            </div>

            <div style={settingCard}>
              <h3 style={settingTitle}>📦 Data</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                <button style={{ ...submitBtn, background: 'var(--surface2)', color: 'var(--text)', boxShadow: 'none', border: '1px solid var(--border)' }} onClick={exportJSON}>
                  ⬇️ Export JSON
                </button>
                <label style={{ ...submitBtn, background: 'var(--surface2)', color: 'var(--text)', boxShadow: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  ⬆️ Import JSON
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} />
                </label>
              </div>
            </div>

            <div style={settingCard}>
              <h3 style={settingTitle}>📲 Progressive Web App</h3>
              <p style={settingDesc}>Datebook is installable on mobile/desktop as a PWA. Use the install prompt from browser UI or the button below when available.</p>
              <button style={submitBtn} onClick={installApp} disabled={!deferredInstallPrompt}>
                {deferredInstallPrompt ? 'Install Datebook' : 'Install Prompt Not Available'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Event Edit Modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={fldLabel}>{label}</label>
      {children}
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// ---- Styles ----
const root = { display: 'flex', minHeight: '100vh' };
const rootMobile = { flexDirection: 'column' };
const sidebar = {
  width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
  display: 'flex', flexDirection: 'column', padding: '24px 14px', gap: 4,
  position: 'sticky', top: 0, height: '100vh', flexShrink: 0,
};
const sidebarMobile = {
  width: 'min(82vw, 320px)',
  maxWidth: 320,
  height: '100vh',
  position: 'fixed',
  left: 0,
  top: 0,
  zIndex: 1200,
  background: 'var(--surface)',
  borderRight: '1px solid var(--border)',
  borderBottom: 'none',
  padding: '18px 12px',
  overflowY: 'auto',
  whiteSpace: 'normal',
  transition: 'transform .22s ease, opacity .18s ease',
  boxShadow: '18px 0 44px rgba(0,0,0,0.45)',
};
const sidebarMobileOpen = { transform: 'translateX(0)', opacity: 1 };
const sidebarMobileClosed = { transform: 'translateX(-106%)', opacity: 0 };
const logo = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28,
  padding: '0 8px', color: 'var(--text)',
};
const navBtn = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
  borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--muted)',
  fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%',
};
const navBtnMobile = {
  display: 'flex',
  width: '100%',
  whiteSpace: 'normal',
  border: 'none',
  marginRight: 0,
};
const navActive = { background: 'rgba(124,111,255,0.15)', color: 'var(--accent)' };
const sideBtn = {
  padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
  textAlign: 'left', display: 'block', width: '100%',
};
const sideBtnMobile = { width: '100%', whiteSpace: 'normal', padding: '9px 12px', fontSize: 12 };
const mainArea = { flex: 1, padding: '40px 48px', overflowY: 'auto' };
const mainAreaMobile = { padding: '84px 12px 16px' };
const mobileTopbar = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 64,
  zIndex: 1150,
  display: 'grid',
  gridTemplateColumns: '44px 1fr auto',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  background: 'rgba(13,13,26,0.92)',
  borderBottom: '1px solid var(--border)',
  backdropFilter: 'blur(8px)',
};
const mobileMenuBtn = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 700,
};
const mobileTopbarTitle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 800,
  fontSize: 17,
  color: 'var(--text)',
};
const mobileTopbarView = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: 'var(--muted)',
};
const mobileBackdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(2px)',
};
const page = { maxWidth: 900, margin: '0 auto' };
const pageMobile = { maxWidth: '100%' };
const pageTitle = { fontSize: 26, fontWeight: 900, color: 'var(--text)', marginBottom: 28, letterSpacing: -0.5 };
const sectionTitle = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '28px 0 14px', textTransform: 'uppercase', letterSpacing: 1 };
const tabRow = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 };
const tabBtn = {
  padding: '8px 14px',
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 700,
};
const tabBtnActive = { color: '#fff', background: 'var(--accent)', borderColor: 'var(--accent)' };
const statsGrid = { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 };
const statCard = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  padding: '16px 20px', borderRadius: 14, border: '1.5px solid', minWidth: 90,
  cursor: 'pointer', transition: 'transform .15s',
};
const cardStack = { display: 'flex', flexDirection: 'column', gap: 10 };
const eventCard = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
  borderRadius: 14, cursor: 'pointer', transition: 'opacity .15s',
};
const evtName = { fontWeight: 700, fontSize: 15, color: 'var(--text)' };
const evtDate = { fontSize: 12, color: 'var(--muted)', marginTop: 2 };
const daysChip = {
  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
  border: '1.5px solid',
};
const formWrap = { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 };
const fldLabel = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 };
const submitBtn = {
  padding: '12px 28px', borderRadius: 11, background: 'var(--accent)', color: '#fff',
  fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(124,111,255,0.35)', alignSelf: 'flex-start',
};
const bsPreview = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9,
  padding: '10px 14px', fontSize: 14, color: 'var(--text)',
};
const hintBox = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--muted)', lineHeight: 1.8,
};
const catGrid = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 };
const catChip = {
  padding: '7px 14px', borderRadius: 20, border: '1.5px solid', fontSize: 12,
  cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600, transition: 'all .15s',
};
const listGrid = { display: 'flex', flexDirection: 'column', gap: 8 };
const listCard = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 18px', borderRadius: 12, background: 'var(--surface)',
  border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color .15s',
};
const listCardMobile = { padding: '10px 12px' };
const emptyMsg = { color: 'var(--muted)', fontStyle: 'italic', marginTop: 20 };
const settingCard = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: '22px 24px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12,
};
const settingTitle = { fontSize: 16, fontWeight: 700, color: 'var(--text)' };
const settingDesc = { fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 };
const metricGrid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 6 };
const metricCard = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '12px 10px',
  textAlign: 'center',
};
const metricNum = { fontSize: 22, fontWeight: 900, color: 'var(--accent)' };
const metricLbl = { fontSize: 11, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 };
const centerMsg = {
  display: 'flex', alignItems: 'center', gap: 14, color: 'var(--muted)',
  fontSize: 15, padding: '60px 0',
};
const spinner = {
  width: 20, height: 20, border: '2px solid var(--border)',
  borderTopColor: 'var(--accent)', borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
};
const loginRoot = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'radial-gradient(circle at 20% 20%, #18183b, #0d0d1a 60%)',
};
const loginCard = {
  width: '100%',
  maxWidth: 430,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: 22,
  boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
};

const globalCSS = `
@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
button:hover { opacity: 0.88; }
a { color: var(--accent); }
code { background: var(--surface2); padding: 2px 6px; border-radius: 5px; font-size: 12px; }
`;
