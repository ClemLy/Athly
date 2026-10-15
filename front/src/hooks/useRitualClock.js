import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// ─── Chrono de rituel ─────────────────────────────────────────────────────────
// Basé sur l'horloge réelle (Date.now) plutôt que sur des décréments : le temps
// passé téléphone verrouillé ou app en arrière-plan est bien compté.
//
// status : 'idle' | 'running' | 'paused' | 'done'

const TICK_MS = 250;

export function useRitualClock(durationSeconds, { autoStart = false } = {}) {
  const totalMs = Math.max(1, durationSeconds) * 1000;
  const [status, setStatus] = useState(autoStart ? 'running' : 'idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const accRef = useRef(0);
  const startedAtRef = useRef(autoStart ? Date.now() : null);

  const read = useCallback(
    () => accRef.current + (startedAtRef.current ? Date.now() - startedAtRef.current : 0),
    [],
  );

  const sync = useCallback(() => {
    const ms = Math.min(totalMs, read());
    setElapsedMs(ms);
    if (ms >= totalMs) {
      accRef.current = totalMs;
      startedAtRef.current = null;
      setStatus('done');
    }
  }, [read, totalMs]);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const id = setInterval(sync, TICK_MS);
    // Retour au premier plan : mise à jour immédiate, sans attendre le tick.
    const sub = AppState.addEventListener?.('change', (s) => { if (s === 'active') sync(); });
    return () => { clearInterval(id); sub?.remove?.(); };
  }, [status, sync]);

  const start = useCallback(() => {
    accRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setStatus('running');
  }, []);

  const pause = useCallback(() => {
    accRef.current = Math.min(totalMs, read());
    startedAtRef.current = null;
    setElapsedMs(accRef.current);
    setStatus('paused');
  }, [read, totalMs]);

  const resume = useCallback(() => {
    startedAtRef.current = Date.now();
    setStatus('running');
  }, []);

  const elapsed = elapsedMs / 1000;
  return {
    status,
    elapsed,
    remaining: Math.max(0, durationSeconds - elapsed),
    progress: Math.min(1, elapsedMs / totalMs),
    start,
    pause,
    resume,
  };
}
