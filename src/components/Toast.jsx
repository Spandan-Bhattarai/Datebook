// src/components/Toast.jsx
import { useEffect } from 'react';

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const colors = {
    success: '#2ed573',
    error: '#ff4757',
    info: '#7c6fff',
    warn: '#ffa502',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
      background: colors[toast.type] || colors.info,
      color: '#fff', padding: '12px 20px', borderRadius: 12,
      fontWeight: 600, fontSize: 14, boxShadow: '0 8px 30px #0006',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideUp .2s ease',
      maxWidth: 360,
    }}>
      <span>{toast.type === 'error' ? '⚠️' : toast.type === 'warn' ? '⚡' : '✅'}</span>
      {toast.msg}
    </div>
  );
}
