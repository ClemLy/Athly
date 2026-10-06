import { useMemo } from 'react';
import { useWorkoutLogs } from '../context/WorkoutLogsContext';

// Noms des exercices faits récemment (le plus récent en premier, sans
// doublon) : proposés en tête des sélecteurs d'exercices.
export function useRecentExerciseNames(limit = 8) {
  const { sessionLogs } = useWorkoutLogs();
  return useMemo(() => {
    const logs = [...(sessionLogs || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const seen = new Set();
    const out = [];
    for (const log of logs) {
      for (const ex of log.exercises || []) {
        const key = String(ex.name || '').toLowerCase();
        if (!key || seen.has(key)) continue;
        if (!(ex.sets || []).some((s) => s.completed)) continue;
        seen.add(key);
        out.push(ex.name);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }, [sessionLogs, limit]);
}
