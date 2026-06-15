import { useState, useEffect, useRef, useCallback } from 'react';

// Timer d'effort : démarre à l'ouverture (autoStart par défaut), tick à 1s,
// se met automatiquement en pause quand on quitte l'écran (gérer côté écran via reset/pause).
//
// Retourne :
//   seconds (number) : durée écoulée
//   formatted (string) : "M:SS"
//   running (bool)
//   start, pause, toggle, reset (functions)
//
function format(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function useEffortTimer({ autoStart = true } = {}) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const toggle = useCallback(() => setRunning((r) => !r), []);
  const reset = useCallback(() => {
    setSeconds(0);
    setRunning(autoStart);
  }, [autoStart]);

  return {
    seconds,
    formatted: format(seconds),
    running,
    start,
    pause,
    toggle,
    reset,
  };
}

export { format as formatDuration };
