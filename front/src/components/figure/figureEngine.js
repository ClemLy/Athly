// ─── Moteur du mannequin de démonstration ─────────────────────────────────────
// Pur JavaScript (aucune dépendance React Native) : pour chaque exercice, un
// générateur calcule la position des articulations à l'instant t (0 = départ,
// 1 = arrivée) en respectant la géométrie du corps : longueurs des membres
// constantes, mains et pieds qui restent posés là où ils doivent l'être, rien
// qui traverse le sol. `drawFigure` en tire une liste de formes (traits,
// cercles, rectangles) que le composant ExerciseFigure dessine en SVG.
//
// Générateurs : movesUpper.js, movesLower.js, movesCore.js, movesMobility.js
// (de profil) et figureFrontal.js (de face). Chacun : (t, p) → { j, props,
// focus, hang?, topView?, loose? }
//  - hang : corps suspendu (cadrage centré, pas d'ombre au sol)
//  - topView : vu d'en haut (pas de cadrage)
//  - loose : segments vus en raccourci (non contrôlés par les tests)

import {
  G, L, P, add, sub, mul, norm, clamp, flat,
} from './figureKit';
import {
  pushup, pike, handstand, row, pull, muscleUp, dip, lever, crow, elbowLever,
} from './movesUpper';
import { squat, nordic, bridge, hinge } from './movesLower';
import {
  prone, plank, sidePlank, quadruped, supine, lsit, rollout, dragon, hangingRaise,
} from './movesCore';
import { standing, lungeStretch, openBook, supineMobility } from './movesMobility';
import { frontal } from './figureFrontal';

export {
  GROUND, L, P, dist, dir, polar, lerp, bend, twoBone, circles,
} from './figureKit';

// ─── Registre ────────────────────────────────────────────────────────────────
export const GENERATORS = {
  pushup, pike, handstand, row, pull, muscleUp, dip, squat, nordic, bridge, hinge, prone,
  plank, sidePlank, quadruped, supine, lsit, lever, crow, elbowLever, rollout, dragon,
  hangingRaise, standing, lungeStretch, openBook, supineMobility,
  frontal: (t, p) => frontal(t, p),
};

// Mouvement continu (en boucle) plutôt que départ → arrivée
export const LOOPING = new Set(['armcircles', 'shouldercircles', 'hipcircles', 'jumprope']);

// Ordre : accessoires, membres éloignés, tronc, membres proches, tête.
// `focus` colore les segments qui travaillent (bras, tronc, jambes, dos).
// ─── Dessin ──────────────────────────────────────────────────────────────────
// Ordre : accessoires, membres éloignés, tronc, membres proches, tête.
// `focus` colore les segments qui travaillent (bras, tronc, jambes, dos).
function drawRaw(spec, t) {
  const gen = GENERATORS[spec?.gen];
  if (!gen) return null;
  const out = gen(clamp(t, 0, 1), spec.p || {});
  if (out.shapes) return out;
  const { j, props = [], focus = [] } = out;
  const hot = (part) => focus.includes(part);
  const line = (a, b, w, c) => ({ k: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, w, c });
  const shapes = [...flat(props)];
  const legs = hot('legs'); const arms = hot('arms');
  shapes.push(line(j.hip, j.kneeF, 11, legs ? 'accentFar' : 'far'));
  shapes.push(line(j.kneeF, j.ankleF, 9.5, legs ? 'accentFar' : 'far'));
  shapes.push(line(j.ankleF, j.toeF, 5.5, 'far'));
  shapes.push(line(j.shoulder, j.elbowF, 8, arms ? 'accentFar' : 'far'));
  shapes.push(line(j.elbowF, j.handF, 7, arms ? 'accentFar' : 'far'));
  const torsoC = hot('torso') || hot('back') ? 'torsoAccent' : 'torso';
  shapes.push({ k: 'poly', pts: [j.hip, j.mid, j.chest], w: 15.5, c: torsoC });
  const neckEnd = add(j.chest, mul(norm(sub(j.head, j.chest)), L.neck));
  shapes.push(line(j.chest, neckEnd, 6.5, 'torso'));
  shapes.push(line(j.hip, j.kneeN, 11.5, legs ? 'accent' : 'near'));
  shapes.push(line(j.kneeN, j.ankleN, 10, legs ? 'accent' : 'near'));
  shapes.push(line(j.ankleN, j.toeN, 6, 'near'));
  shapes.push(line(j.shoulder, j.elbowN, 8.5, arms ? 'accent' : 'near'));
  shapes.push(line(j.elbowN, j.handN, 7.5, arms ? 'accent' : 'near'));
  shapes.push({ k: 'circle', cx: j.head.x, cy: j.head.y, r: L.head, c: 'head' });
  const limbs = [
    [j.shoulder, j.elbowN, L.upperArm, 'bras'], [j.elbowN, j.handN, L.forearm, 'avant-bras'],
    [j.shoulder, j.elbowF, L.upperArm, 'bras loin'], [j.elbowF, j.handF, L.forearm, 'avant-bras loin'],
    [j.hip, j.kneeN, L.thigh, 'cuisse'], [j.kneeN, j.ankleN, L.shin, 'tibia'],
    [j.hip, j.kneeF, L.thigh, 'cuisse loin'], [j.kneeF, j.ankleF, L.shin, 'tibia loin'],
    [j.hip, j.shoulder, L.torso, 'tronc'], [j.ankleN, j.toeN, L.foot, 'pied'], [j.ankleF, j.toeF, L.foot, 'pied loin'],
  ];
  const { head, mid, chest, ...pts } = j;
  return {
    shapes, joints: j, limbs, loose: out.loose, hang: out.hang, topView: out.topView,
    bodyPts: [...Object.values(pts), P(head.x, head.y + L.head)],
  };
}

// Cadrage, calculé une fois pour tout le mouvement (pas de zoom qui varie
// pendant l'animation) :
//  - corps posé au sol : on réduit autour du sol si ça dépasse du cadre ;
//  - corps suspendu : on le centre dans la hauteur, réduit si besoin ;
//  - vue d'en haut : telle quelle.
const FIT_CACHE = new Map();

const TOP = 5;

const BODY_COLORS = new Set(['near', 'far', 'torso', 'torsoAccent', 'head', 'accent', 'accentFar']);

function shapeBounds(s) {
  const r = (s.w || 0) / 2;
  if (s.k === 'line') return [Math.min(s.x1, s.x2) - r, Math.min(s.y1, s.y2) - r, Math.max(s.x1, s.x2) + r, Math.max(s.y1, s.y2) + r];
  if (s.k === 'circle' || s.k === 'ring') return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
  if (s.k === 'ellipse') return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
  if (s.k === 'rect') return [s.x, s.y, s.x + s.w, s.y + s.h];
  if (s.k === 'poly') {
    const xs = s.pts.map((q) => q.x); const ys = s.pts.map((q) => q.y);
    return [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r];
  }
  return null;
}

export function fitFor(spec) {
  const key = JSON.stringify(spec);
  if (FIT_CACHE.has(key)) return FIT_CACHE.get(key);
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  let bMinX = Infinity; let bMaxX = -Infinity;
  let hang = false; let topView = false;
  for (const t of [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]) {
    const raw = drawRaw(spec, t);
    if (!raw) continue;
    hang = hang || !!raw.hang;
    topView = topView || !!raw.topView;
    for (const s of raw.shapes) {
      if (s.c === 'mat' || s.full) continue; // tapis, murs et poteaux : pas cadrés
      const b = shapeBounds(s);
      if (!b) continue;
      minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]); maxX = Math.max(maxX, b[2]); maxY = Math.max(maxY, b[3]);
      if (BODY_COLORS.has(s.c)) { bMinX = Math.min(bMinX, b[0]); bMaxX = Math.max(bMaxX, b[2]); }
    }
  }
  let fit;
  if (topView || !Number.isFinite(minY)) fit = { z: 1, cx: 100, anchor: 'none' };
  else if (!hang) {
    const zy = minY < TOP ? (G - TOP) / (G - minY) : 1;
    const half = Math.max(100 - minX, maxX - 100, 1);
    const cx = (bMinX + bMaxX) / 2;
    const span = (maxX - minX) / 2;
    // Centré sur le corps si le cadre le permet, sinon sur l'ensemble
    const center = span < 92 ? clamp(cx, minX + span - 8, maxX - span + 8) : (minX + maxX) / 2;
    const zx = Math.min(1, 94 / Math.max(span, Math.min(half, span + 10)));
    fit = { z: Math.min(1, zy, zx), anchor: 'ground', cx: Math.abs(center - 100) < 3 ? 100 : center };
  } else {
    const z = Math.min(1, (G - 2 - TOP) / (maxY - minY), 190 / (maxX - minX));
    fit = { z, anchor: 'center', cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
  FIT_CACHE.set(key, fit);
  return fit;
}

/**
 * Formes à dessiner pour la démo `spec` ({ gen, p }) à l'instant t (0..1).
 * @returns {{ shapes: object[], joints: object|null, limbs: Array, scale: number, loose?: string[] } | null}
 */

export function drawFigure(spec, t) {
  const raw = drawRaw(spec, t);
  if (!raw) return null;
  const fit = fitFor(spec);
  const z = fit.z;
  let X; let Y;
  if (fit.anchor === 'ground') {
    X = (x) => 100 + (x - fit.cx) * z; Y = (y) => G + (y - G) * z;
  } else if (fit.anchor === 'center') {
    const mid = (TOP + G - 2) / 2;
    X = (x) => 100 + (x - fit.cx) * z; Y = (y) => mid + (y - fit.cy) * z;
  } else { X = (x) => x; Y = (y) => y; }
  const T = (q) => P(X(q.x), Y(q.y));
  const shapes = raw.shapes.map((sh) => {
    const o = { ...sh };
    if ('x1' in o) { o.x1 = X(o.x1); o.x2 = X(o.x2); o.y1 = Y(o.y1); o.y2 = Y(o.y2); }
    if ('cx' in o) { o.cx = X(o.cx); o.cy = Y(o.cy); }
    if (o.k === 'rect') {
      const bottom = o.y + o.h;
      o.x = X(o.x); o.w *= z;
      o.y = Y(o.y);
      o.h = fit.anchor === 'ground' && bottom >= G - 0.5 ? G - o.y : o.h * z;
    }
    if (o.pts) o.pts = o.pts.map(T);
    if (o.w && o.k !== 'rect') o.w *= z;
    if (o.r && o.k !== 'rect') o.r *= z;
    if (o.rx) o.rx *= z;
    if (o.ry) o.ry *= z;
    delete o.full;
    return o;
  });
  // Ombre au sol sous le corps quand il touche le sol
  const pts = (raw.bodyPts || []).map(T);
  if (!raw.topView && pts.some((q) => q.y > G - 10)) {
    const xs = pts.map((q) => q.x);
    const lo = Math.min(...xs); const hi = Math.max(...xs);
    shapes.unshift({ k: 'ellipse', cx: (lo + hi) / 2, cy: G + 1.5, rx: Math.min(44, (hi - lo) / 2 + 6), ry: 2.6, c: 'shadow' });
  }
  const joints = raw.joints ? Object.fromEntries(Object.entries(raw.joints).map(([k, q]) => [k, T(q)])) : null;
  const limbs = (raw.limbs || []).map(([a, b, len, label]) => [T(a), T(b), len * z, label]);
  return { shapes, joints, limbs, scale: z, loose: raw.loose || [] };
}
