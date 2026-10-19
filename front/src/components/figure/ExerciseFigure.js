import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, Ellipse, Polyline, Polygon, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import { drawFigure, GROUND, LOOPING } from './figureEngine';

// ─── Mannequin de démonstration ───────────────────────────────────────────────
// Dessine la pose calculée par figureEngine à l'instant t (0 = départ,
// 1 = arrivée). useFigureClock fait vivre t en boucle : départ, pause,
// mouvement, pause, retour, comme le lecteur de photos des exercices de salle.

const PALETTE = {
  near: '#E6E9F0',
  far: '#7C8395',
  torso: '#EEF0F5',
  torsoAccent: '#F6D9CB',
  head: '#EEF0F5',
  accent: Colors.primary,
  accentFar: '#A9522F',
  prop: '#363C4A',
  propEdge: '#5A6173',
  band: '#F2B84B',
  mat: 'rgba(255,255,255,0.045)',
  shadow: 'rgba(0,0,0,0.38)',
};

const HOLD = 520;   // pause sur chaque position (ms)
const MOVE = 1150;  // durée du mouvement (ms)
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * Horloge de l'animation : renvoie t entre 0 et 1.
 * Mouvements circulaires (cercles de bras…) : t tourne en continu.
 */
export function useFigureClock(active, spec) {
  const [t, setT] = useState(0);
  const looping = LOOPING.has(spec?.p?.move);
  const start = useRef(0);
  useEffect(() => {
    if (!active) { setT(0); return undefined; }
    let raf = null;
    let last = 0;
    start.current = Date.now();
    const cycle = 2 * (HOLD + MOVE);
    const tick = () => {
      const now = Date.now();
      // ~40 images par seconde : fluide, sans surcharger les petits téléphones
      if (now - last > 24) {
        last = now;
        const e = now - start.current;
        let v;
        if (looping) v = (e % 2400) / 2400;
        else {
          const k = e % cycle;
          if (k < HOLD) v = 0;
          else if (k < HOLD + MOVE) v = ease((k - HOLD) / MOVE);
          else if (k < 2 * HOLD + MOVE) v = 1;
          else v = 1 - ease((k - 2 * HOLD - MOVE) / MOVE);
        }
        setT(v);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [active, looping]);
  return t;
}

function Shape({ s }) {
  const c = PALETTE[s.c] || s.c;
  switch (s.k) {
    case 'line':
      return <Line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={c} strokeWidth={s.w} strokeLinecap="round" />;
    case 'circle':
      return <Circle cx={s.cx} cy={s.cy} r={s.r} fill={c} />;
    case 'ring':
      return <Circle cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke={c} strokeWidth={2} />;
    case 'ellipse':
      return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={c} />;
    case 'rect':
      return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r || 0} fill={c} />;
    case 'poly': {
      const pts = s.pts.map((p) => `${p.x},${p.y}`).join(' ');
      return s.fill
        ? <Polygon points={pts} fill={c} />
        : <Polyline points={pts} fill="none" stroke={c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />;
    }
    default:
      return null;
  }
}

/**
 * Mannequin à l'instant t.
 * Props : spec ({ gen, p }), t (0..1), style, background (bool)
 */
export default function ExerciseFigure({ spec, t = 0.6, style, background = true }) {
  const drawn = useMemo(() => drawFigure(spec, t), [spec, t]);
  if (!drawn) return null;
  return (
    <View style={[styles.box, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid meet">
        {background ? (
          <>
            <Defs>
              <LinearGradient id="figBg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1B1E28" />
                <Stop offset="1" stopColor="#12141C" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={200} height={140} fill="url(#figBg)" />
            <Rect x={0} y={GROUND + 0.5} width={200} height={140 - GROUND} fill="rgba(255,255,255,0.025)" />
            <Line x1={0} y1={GROUND + 0.5} x2={200} y2={GROUND + 0.5} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          </>
        ) : null}
        {drawn.shapes.map((s, i) => <Shape key={i} s={s} />)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 200 / 140, overflow: 'hidden' },
});
