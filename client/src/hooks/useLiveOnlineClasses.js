import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const POLL_MS = 30000;

export function useLiveOnlineClasses(enabled = true) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!enabled) return;
    api.getOnlineClasses()
      .then((rows) => setSessions(Array.isArray(rows) ? rows : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSessions([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, load]);

  const liveSessions = sessions.filter((s) => s.status === 'live' || s.status === 'starting_soon');
  const upcomingSessions = sessions.filter((s) => s.status === 'upcoming');
  const primaryLive = liveSessions[0] || null;

  return {
    sessions,
    liveSessions,
    upcomingSessions,
    primaryLive,
    hasLiveClass: liveSessions.length > 0,
    loading,
    refresh: load,
  };
}
