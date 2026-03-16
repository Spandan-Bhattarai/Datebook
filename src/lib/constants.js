// src/lib/constants.js

export const CATEGORIES = {
  birthday:  { label: 'Birthday',  emoji: '🎂', color: '#ff6b9d', bg: 'rgba(255,107,157,0.12)' },
  event:     { label: 'Event',     emoji: '🎉', color: '#7c6fff', bg: 'rgba(124,111,255,0.12)' },
  movie:     { label: 'Movie',     emoji: '🎬', color: '#ff9f43', bg: 'rgba(255,159,67,0.12)'  },
  sports:    { label: 'Sports',    emoji: '⚽', color: '#00c896', bg: 'rgba(0,200,150,0.12)'   },
  reminder:  { label: 'Reminder',  emoji: '🔔', color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' },
  holiday:   { label: 'Holiday',   emoji: '🌟', color: '#fdcb6e', bg: 'rgba(253,203,110,0.12)' },
  custom:    { label: 'Custom',    emoji: '📌', color: '#74b9ff', bg: 'rgba(116,185,255,0.12)' },
};

export function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  // For birthdays/recurring, use this year or next
  const thisYear = new Date(target);
  thisYear.setFullYear(today.getFullYear());
  if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
  return Math.round((thisYear - today) / 86400000);
}

export function formatADDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}
