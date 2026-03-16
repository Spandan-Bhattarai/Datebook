// src/lib/useEvents.js
import { useState, useEffect, useCallback } from 'react';
import { initDB, fetchAllEvents, insertEvent, updateEvent, deleteEventDB, bulkInsertEvents } from './db';

const LS_KEY = 'datebook_events_v2';

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(events) {
  localStorage.setItem(LS_KEY, JSON.stringify(events));
}

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const client = await initDB();
        if (client) {
          setDb(client);
          const rows = await fetchAllEvents(client);
          setEvents(rows);
          lsSave(rows); // keep local mirror
        } else {
          setEvents(lsLoad());
        }
      } catch (e) {
        console.error(e);
        setError('DB connection failed – using local storage');
        setEvents(lsLoad());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback((evts) => {
    setEvents(evts);
    lsSave(evts);
  }, []);

  const addEvent = useCallback(async (event) => {
    const newEvt = { ...event, id: event.id || crypto.randomUUID() };
    if (db) await insertEvent(db, newEvt);
    persist((prev) => [...prev, newEvt]);
    return newEvt;
  }, [db, persist]);

  const editEvent = useCallback(async (event) => {
    if (db) await updateEvent(db, event);
    persist((prev) => prev.map((e) => e.id === event.id ? event : e));
  }, [db, persist]);

  const removeEvent = useCallback(async (id) => {
    if (db) await deleteEventDB(db, id);
    persist((prev) => prev.filter((e) => e.id !== id));
  }, [db, persist]);

  const bulkAdd = useCallback(async (eventsArr) => {
    const tagged = eventsArr.map((e) => ({ ...e, id: e.id || crypto.randomUUID() }));
    if (db) await bulkInsertEvents(db, tagged);
    persist((prev) => [...prev, ...tagged]);
    return tagged.length;
  }, [db, persist]);

  return { events, loading, error, addEvent, editEvent, removeEvent, bulkAdd, isDB: !!db };
}
