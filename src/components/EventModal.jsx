// src/components/EventModal.jsx
import { useState, useEffect } from 'react';
import { CATEGORIES, formatADDate } from '../lib/constants';
import { formatBSDate, formatBSDateEn } from '../lib/nepali';

export default function EventModal({ event, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(event);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(event); }, [event]);

  const cat = CATEGORIES[form.category] || CATEGORIES.event;

  async function handleSave() {
    if (!form.name || !form.date) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ ...modalHeader, borderBottom: `2px solid ${cat.color}33` }}>
          <span style={{ fontSize: 28 }}>{cat.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: cat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {cat.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{form.name}</div>
          </div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={body}>
          {/* Date display */}
          <div style={dateBox}>
            <div style={dateRow}>
              <span style={dateLabel}>🗓 AD</span>
              <span style={dateVal}>{formatADDate(form.date)}</span>
            </div>
            <div style={dateRow}>
              <span style={dateLabel}>📅 BS</span>
              <span style={{ ...dateVal, fontFamily: "'Tiro Devanagari Nepali', serif" }}>
                {formatBSDate(form.date)}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>({formatBSDateEn(form.date)})</span>
              </span>
            </div>
          </div>

          {/* Edit form */}
          <div style={fieldGroup}>
            <label style={lbl}>Name / Title</label>
            <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Event name" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={fieldGroup}>
              <label style={lbl}>Date (AD)</label>
              <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div style={fieldGroup}>
              <label style={lbl}>Category</label>
              <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={lbl}>Notes (optional)</label>
            <textarea rows={3} value={form.notes || ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any extra details..." style={{ resize: 'vertical' }} />
          </div>

          <div style={fieldGroup}>
            <label style={lbl}>📧 Email for notification (1 day before)</label>
            <input type="email" value={form.notify_email || ''} placeholder="you@example.com"
              onChange={(e) => setForm(f => ({ ...f, notify_email: e.target.value }))} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Requires the Vercel cron + Resend setup (see README)
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={footer}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--danger)' }}>Delete this event?</span>
              <button style={{ ...btn, background: 'var(--danger)' }} onClick={() => { onDelete(event.id); onClose(); }}>Yes, delete</button>
              <button style={{ ...btn, background: 'var(--surface2)', color: 'var(--muted)' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : (
            <>
              <button style={{ ...btn, background: '#ff475720', color: 'var(--danger)', border: '1px solid #ff475740' }}
                onClick={() => setConfirmDelete(true)}>🗑 Delete</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...btn, background: 'var(--surface2)', color: 'var(--muted)' }} onClick={onClose}>Cancel</button>
                <button style={{ ...btn, background: cat.color, color: '#fff', opacity: saving ? 0.7 : 1 }}
                  onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '✓ Save Changes'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: '#00000099', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  backdropFilter: 'blur(4px)',
};
const modal = {
  background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 540,
  border: '1px solid var(--border)', overflow: 'hidden',
  boxShadow: '0 24px 80px #0008',
  animation: 'slideUp .2s ease',
};
const modalHeader = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px',
};
const body = { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 };
const footer = {
  padding: '16px 24px', borderTop: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const closeBtn = {
  background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18,
  cursor: 'pointer', padding: 4, borderRadius: 6,
};
const btn = {
  padding: '9px 18px', borderRadius: 9, border: 'none',
  fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 6 };
const fieldGroup = { display: 'flex', flexDirection: 'column' };
const dateBox = {
  background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px',
  display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--border)',
};
const dateRow = { display: 'flex', alignItems: 'center', gap: 12 };
const dateLabel = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', minWidth: 50 };
const dateVal = { fontSize: 14, color: 'var(--text)', fontWeight: 500 };
