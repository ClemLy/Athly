// ─── Géométrie des cadres de profil ──────────────────────────────────────────
//
// Module pur (aucun import React Native) : décrit chaque cadre comme une pile
// de calques SVG `{ d, fill, stroke, sw, op, rule, cap }` centrés sur (0,0), le
// centre de l'avatar. AvatarFrame se contente de les rendre avec react-native-svg.
//
// Règles de conception :
// - Tout est proportionnel à la taille de l'avatar (S) : un cadre a exactement
//   la même allure en 36 px dans le sélecteur et en 90 px sur le profil.
// - La boîte de mise en page est TOUJOURS l'anneau circulaire (2R × 2R), quelle
//   que soit la forme. Les ornements (couronne, ailes, éclairs…) débordent dans
//   un canevas transparent au lieu de faire rétrécir l'avatar.
// - Les couleurs viennent exclusivement de la palette du cadre ; seuls des
//   reflets blancs / ombres noires translucides donnent le relief « métal ».
// - Le palier de la couleur (frameTier) ajoute du détail sur TOUTES les formes :
//   plus on monte en niveau, plus le cadre est ouvragé.
//
// Les valeurs `fill` de la forme 'url:<nom>' renvoient aux dégradés décrits
// par gradientDefs().

export const BG = '#0D0D15';

// Débord maximal des ornements depuis le centre, en multiples de R (rayon
// extérieur de l'anneau). Mesuré sur le rendu réel (getBBox) puis arrondi
// au-dessus. Sert aux écrans qui doivent réserver de la place autour du cadre.
export const SHAPE_BLEED = {
  circle:     { top: 1.02, bottom: 1.02, side: 1.02 },
  hex:        { top: 1.02, bottom: 1.02, side: 1.12 },
  oct:        { top: 1.02, bottom: 1.02, side: 1.02 },
  shield:     { top: 1.08, bottom: 1.14, side: 1.0 },
  spike:      { top: 1.7,  bottom: 1.7,  side: 1.32 },
  neon:       { top: 1.04, bottom: 1.04, side: 1.04 },
  crown:      { top: 1.68, bottom: 1.02, side: 1.02 },
  wings:      { top: 1.22, bottom: 1.06, side: 1.68 },
  divine:     { top: 1.68, bottom: 1.68, side: 1.68 },
  dragonfang: { top: 1.58, bottom: 1.32, side: 1.34 },
};

// Demi-côté du canevas SVG, en multiples de R : couvre le plus grand débord
// (+ halo lumineux) pour qu'aucun calque ne soit rogné par la bitmap SVG.
export const CANVAS_HALF = 2.1;

export function ringWidth(colorDef, S) {
  return Math.max(2.2, (3 + (colorDef.borderWidth || 2) * 1.1) * (S / 90));
}

// Palier de détail, dérivé du niveau de déblocage de la couleur :
// 0 Acier/Bronze · 1 Argent/Saphir · 2 Warrior/Élite · 3 Maître/Grand Maître
// · 4 Légende/ATHLY GOD/Uniques.
export function frameTier(colorDef) {
  const lvl = colorDef.unlockLevel || 0;
  if (colorDef.special || lvl >= 171) return 4;
  if (lvl >= 111) return 3;
  if (lvl >= 71) return 2;
  if (lvl >= 31) return 1;
  return 0;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const n2 = (v) => Math.round(v * 100) / 100;
const pt = (x, y) => `${n2(x)},${n2(y)}`;
const deg = (d) => (d * Math.PI) / 180;
const polar = (r, a) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Tons extraits de la palette existante (aucune nouvelle couleur).
export function paletteTones(colors) {
  const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b));
  return {
    dark:  sorted[0],
    light: sorted[sorted.length - 1],
    mid:   colors[Math.floor(colors.length / 2)],
  };
}

export function gradientDefs(colors, glowColor = null) {
  const last = colors.length - 1;
  const spread = colors.map((c, i) => ({ o: last ? i / last : 0, c, a: 1 }));
  return [
    // Anneau : la palette complète en diagonale.
    { id: 'metal', x1: 0, y1: 0, x2: 1, y2: 1, stops: spread },
    // Ornements : palette verticale, du ton le plus clair (haut) au plus sombre.
    { id: 'metalV', x1: 0, y1: 0, x2: 0, y2: 1, stops: [...colors]
      .sort((a, b) => luminance(b) - luminance(a))
      .map((c, i, arr) => ({ o: arr.length > 1 ? i / (arr.length - 1) : 0, c, a: 1 })) },
    // Reflet : lumière zénithale qui donne l'aspect métal poli.
    { id: 'sheen', x1: 0, y1: 0, x2: 0, y2: 1, stops: [
      { o: 0,    c: '#FFFFFF', a: 0.45 },
      { o: 0.4,  c: '#FFFFFF', a: 0.06 },
      { o: 0.56, c: '#000000', a: 0 },
      { o: 1,    c: '#000000', a: 0.34 },
    ] },
    // Rayons de lumière (Divin) : pleins près de l'anneau, fondus en bout.
    { id: 'rays', radial: true, stops: [
      { o: 0,    c: [...colors].sort((a, b) => luminance(b) - luminance(a))[0], a: 1 },
      { o: 0.58, c: [...colors].sort((a, b) => luminance(b) - luminance(a))[0], a: 1 },
      { o: 0.78, c: [...colors].sort((a, b) => luminance(b) - luminance(a))[0], a: 0.45 },
      { o: 1,    c: [...colors].sort((a, b) => luminance(b) - luminance(a))[0], a: 0 },
    ] },
    { id: 'aura', radial: true, stops: [
      { o: 0.55, c: '#FFFFFF', a: 0.1 },
      { o: 1,    c: '#FFFFFF', a: 0 },
    ] },
    // Halo : disque radial qui s'estompe en douceur (pas de bande dure).
    ...(glowColor ? [{ id: 'glow', radial: true, stops: [
      { o: 0,    c: glowColor, a: 0.5 },
      { o: 0.6,  c: glowColor, a: 0.5 },
      { o: 0.72, c: glowColor, a: 0.32 },
      { o: 0.86, c: glowColor, a: 0.1 },
      { o: 1,    c: glowColor, a: 0 },
    ] }] : []),
  ];
}

export function circlePath(r, cx = 0, cy = 0) {
  return (
    `M${pt(cx + r, cy)} ` +
    `A${n2(r)},${n2(r)} 0 1 0 ${pt(cx - r, cy)} ` +
    `A${n2(r)},${n2(r)} 0 1 0 ${pt(cx + r, cy)} Z`
  );
}

function roundedPoly(points, rad) {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const l1 = Math.hypot(prev.x - p.x, prev.y - p.y);
    const l2 = Math.hypot(next.x - p.x, next.y - p.y);
    const k1 = Math.min(rad, l1 / 2) / l1;
    const k2 = Math.min(rad, l2 / 2) / l2;
    const a = { x: p.x + (prev.x - p.x) * k1, y: p.y + (prev.y - p.y) * k1 };
    const b = { x: p.x + (next.x - p.x) * k2, y: p.y + (next.y - p.y) * k2 };
    d += `${i === 0 ? 'M' : 'L'}${pt(a.x, a.y)} Q${pt(p.x, p.y)} ${pt(b.x, b.y)} `;
  }
  return d + 'Z';
}

// Polygone régulier arrondi défini par son apothème (distance centre → côté) :
// l'anneau garde ainsi une épaisseur constante sur tous les côtés.
function polygon(sides, apothem, rotDeg, cornerFrac) {
  const circ = apothem / Math.cos(Math.PI / sides);
  const pts = Array.from({ length: sides }, (_, i) => polar(circ, (2 * Math.PI * i) / sides + deg(rotDeg)));
  return roundedPoly(pts, circ * cornerFrac);
}

// Écu à pointe : sommet légèrement bombé, épaules arrondies, flancs galbés.
function shieldPath(s) {
  const P = (x, y) => pt(x * s, y * s);
  return (
    `M${P(0, -1.0)} C${P(0.34, -0.92)} ${P(0.62, -0.9)} ${P(0.86, -0.93)} ` +
    `Q${P(0.99, -0.95)} ${P(0.99, -0.8)} L${P(0.99, -0.14)} ` +
    `C${P(0.99, 0.46)} ${P(0.6, 0.86)} ${P(0, 1.14)} ` +
    `C${P(-0.6, 0.86)} ${P(-0.99, 0.46)} ${P(-0.99, -0.14)} ` +
    `L${P(-0.99, -0.8)} Q${P(-0.99, -0.95)} ${P(-0.86, -0.93)} ` +
    `C${P(-0.62, -0.9)} ${P(-0.34, -0.92)} ${P(0, -1.0)} Z`
  );
}

// Carré très arrondi (tube néon plié).
function squirclePath(h) {
  const pts = [{ x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h }];
  return roundedPoly(pts, h * 0.42);
}

// ─── Échantillonnage de contour ──────────────────────────────────────────────
// Lit les chemins produits par ce module (M, L, Q, C, A demi-cercle, Z en
// absolu) et renvoie une polyligne dense : sert à poser perles, écailles,
// griffes ou segments de néon le long de n'importe quelle forme.

function samplePath(d, perSeg = 14) {
  const tok = d.match(/[MLQCAZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const pts = [];
  let i = 0, cmd = 'M', cur = { x: 0, y: 0 }, start = cur;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/^[MLQCAZ]$/i.test(tok[i])) {
      cmd = tok[i++].toUpperCase();
      if (cmd === 'Z') { cur = start; continue; }
    }
    if (cmd === 'M') {
      cur = { x: num(), y: num() }; start = cur; pts.push(cur); cmd = 'L';
    } else if (cmd === 'L') {
      const e = { x: num(), y: num() };
      for (let k = 1; k <= perSeg; k++) pts.push({ x: cur.x + (e.x - cur.x) * (k / perSeg), y: cur.y + (e.y - cur.y) * (k / perSeg) });
      cur = e;
    } else if (cmd === 'Q') {
      const c = { x: num(), y: num() }, e = { x: num(), y: num() };
      for (let k = 1; k <= perSeg; k++) {
        const t = k / perSeg, m = 1 - t;
        pts.push({ x: m * m * cur.x + 2 * m * t * c.x + t * t * e.x, y: m * m * cur.y + 2 * m * t * c.y + t * t * e.y });
      }
      cur = e;
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() }, c2 = { x: num(), y: num() }, e = { x: num(), y: num() };
      for (let k = 1; k <= perSeg; k++) pts.push(cubicPoint(cur, c1, c2, e, k / perSeg));
      cur = e;
    } else if (cmd === 'A') {
      num(); num(); num(); num();
      const sweep = num();
      const e = { x: num(), y: num() };
      const cx = (cur.x + e.x) / 2, cy = (cur.y + e.y) / 2;
      const rad = Math.hypot(cur.x - cx, cur.y - cy);
      const a0 = Math.atan2(cur.y - cy, cur.x - cx);
      const dir = sweep ? 1 : -1;
      const steps = perSeg * 3;
      for (let k = 1; k <= steps; k++) pts.push(polar(rad, a0 + dir * Math.PI * (k / steps)));
      cur = e;
    } else {
      i++;
    }
  }
  return pts;
}

// `count` points régulièrement espacés (abscisse curviligne) sur le contour,
// en partant du point le plus proche de l'angle `startDeg`.
function evenPoints(d, count, startDeg = -90) {
  const raw = samplePath(d);
  const target = deg(startDeg);
  let best = 0, bestDiff = Infinity;
  raw.forEach((p, i) => {
    const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y, p.x) - target), Math.cos(Math.atan2(p.y, p.x) - target)));
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  const pts = [...raw.slice(best), ...raw.slice(0, best), raw[best]];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const s = (total * k) / count;
    while (j < cum.length - 1 && cum[j] < s) j++;
    const f = (s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    const p = { x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * f, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * f };
    const tx = pts[j].x - pts[j - 1].x, ty = pts[j].y - pts[j - 1].y, tl = Math.hypot(tx, ty) || 1;
    out.push({ ...p, tx: tx / tl, ty: ty / tl });
  }
  return { points: out, length: total };
}

// Distance centre → contour dans la direction `aRad`.
function radiusAt(d, aRad) {
  let best = null, bestDiff = Infinity;
  samplePath(d).forEach((p) => {
    const a = Math.atan2(p.y, p.x);
    const diff = Math.abs(Math.atan2(Math.sin(a - aRad), Math.cos(a - aRad)));
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  });
  return best ? Math.hypot(best.x, best.y) : 0;
}

const polyline = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p.x, p.y)}`).join(' ');

// ─── Primitives décoratives ──────────────────────────────────────────────────

// Lame facettée : triangle aux flancs légèrement concaves + demi-facette
// ombrée qui donne l'arête centrale en relief.
function blade(angle, r0, r1, hw) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const nx = -s, ny = c;
  const bx = c * r0, by = s * r0, tx = c * r1, ty = s * r1;
  const mx = (bx + tx) / 2, my = (by + ty) / 2;
  const L = { x: bx + nx * hw, y: by + ny * hw };
  const Rr = { x: bx - nx * hw, y: by - ny * hw };
  const cL = { x: mx + nx * hw * 0.32, y: my + ny * hw * 0.32 };
  const cR = { x: mx - nx * hw * 0.32, y: my - ny * hw * 0.32 };
  return {
    full:  `M${pt(L.x, L.y)} Q${pt(cL.x, cL.y)} ${pt(tx, ty)} Q${pt(cR.x, cR.y)} ${pt(Rr.x, Rr.y)} Z`,
    shade: `M${pt(bx, by)} L${pt(tx, ty)} Q${pt(cR.x, cR.y)} ${pt(Rr.x, Rr.y)} Z`,
  };
}

function bladeRing(count, startDeg, r0, r1, hw) {
  const full = [], shade = [];
  for (let i = 0; i < count; i++) {
    const b = blade(deg(startDeg + (360 / count) * i), r0, r1, hw);
    full.push(b.full);
    shade.push(b.shade);
  }
  return { full: full.join(' '), shade: shade.join(' ') };
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

// Corne / griffe effilée le long d'une Bézier cubique : base épaisse, pointe
// acérée, épaisseur asymétrique (bord extérieur convexe) pour un vrai volume.
function horn(b, c1, c2, tip, baseW, { steps = 18, ridgeAt = [0.3, 0.48, 0.64, 0.78], innerK = 0.5 } = {}) {
  const pts = Array.from({ length: steps + 1 }, (_, i) => ({ ...cubicPoint(b, c1, c2, tip, i / steps), t: i / steps }));
  const outer = [], inner = [];
  pts.forEach((p, i) => {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = baseW * Math.pow(1 - p.t, 0.55) + baseW * 0.04;
    outer.push({ x: p.x + nx * w, y: p.y + ny * w });
    inner.push({ x: p.x - nx * w * innerK, y: p.y - ny * w * innerK });
  });
  const line = (arr) => arr.map((p) => pt(p.x, p.y)).join(' L');
  const ridges = ridgeAt.map((t) => {
    const i = Math.round(t * steps);
    return `M${pt(outer[i].x, outer[i].y)} L${pt(inner[i].x, inner[i].y)}`;
  }).join(' ');
  const spine = pts.map((p) => pt(p.x, p.y)).join(' L');
  return {
    d: `M${line(outer)} L${line([...inner].reverse())} Z`,
    shade: `M${spine} L${line([...inner].reverse())} Z`,
    ridges,
  };
}

// ─── Calques communs ─────────────────────────────────────────────────────────

// Halo (couleurs lumineuses) ou ombre de contact (métaux simples) qui détache
// le cadre du fond. Le halo de l'anneau est un disque radial (cf. 'glow') ;
// celui des ornements un simple trait diffus qui épouse leur silhouette.
function haloLayers(d, c, k = 1) {
  if (c.glow) return [{ d, fill: 'none', stroke: c.glow, sw: c.ringW * 1.4 * k, op: 0.14 }];
  return [{ d, fill: 'none', stroke: '#000000', sw: c.ringW * 1.3 * k, op: 0.32 }];
}

function ringHalo(shapeFn, c) {
  if (c.glow) return [{ d: circlePath(c.R * 1.62), fill: 'url:glow' }];
  return haloLayers(shapeFn(c.R), c);
}

// Gravure dans l'épaisseur de l'anneau, selon le palier — rien ne dépasse :
// 1 → rainure centrale · 2+ → double rainure + moletage fin · 3+ → filet
// lumineux sur le bord intérieur (voir ringLayers).
function ringDetail(shapeFn, c) {
  const L = [];
  const groove = (k) => [
    { d: shapeFn(c.r + c.ringW * k), fill: 'none', stroke: '#000000', sw: c.hair * 1.1, op: 0.5 },
    { d: shapeFn(c.r + c.ringW * k + c.hair), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.6, op: 0.26 },
  ];
  if (c.tier === 1) L.push(...groove(0.5));
  if (c.tier >= 2) {
    L.push(...groove(0.24), ...groove(0.76));
    // Moletage : fines entailles obliques régulières entre les deux rainures.
    const mid = shapeFn(c.r + c.ringW * 0.5);
    const { length } = evenPoints(mid, 0);
    const n = Math.round(length / (c.ringW * 0.5));
    const half = c.ringW * 0.17;
    const ticks = evenPoints(mid, n, -90).points.map((q) => {
      const dx = q.ty + q.tx * 0.55, dy = -q.tx + q.ty * 0.55;
      const k = half / Math.hypot(dx, dy);
      return `M${pt(q.x - dx * k, q.y - dy * k)} L${pt(q.x + dx * k, q.y + dy * k)}`;
    }).join(' ');
    L.push({ d: ticks, fill: 'none', stroke: '#000000', sw: c.hair * 0.9, op: 0.4 });
  }
  return L;
}

function ringLayers(shapeFn, c) {
  const outer = shapeFn(c.R);
  const inner = shapeFn(c.r);
  const ring = `${outer} ${inner}`;
  return [
    { d: ring, fill: 'url:metal', rule: 'evenodd' },
    { d: ring, fill: 'url:sheen', rule: 'evenodd' },
    // Filet de lumière parallèle au bord extérieur (biseau poli).
    { d: shapeFn(c.R - c.ringW * 0.2), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.8, op: 0.32 },
    ...ringDetail(shapeFn, c),
    { d: outer, fill: 'none', stroke: c.tones.dark, sw: c.hair, op: 0.85 },
    // Biseau intérieur : ombre portée sur le bord interne de l'anneau…
    { d: inner, fill: 'none', stroke: '#000000', sw: c.ringW * 0.36, op: 0.5 },
    { d: inner, fill: BG },
    // …et liseré côté avatar : discret, puis filet lumineux dès le palier 3.
    c.tier >= 3
      ? { d: shapeFn(c.r - c.hair * 1.2), fill: 'none', stroke: c.glow || c.tones.light, sw: c.hair * 1.3, op: 0.8 }
      : { d: shapeFn(c.r - c.hair * 1.1), fill: 'none', stroke: c.tones.light, sw: c.hair * 0.6, op: 0.22 },
  ];
}

// Ornement métal : halo, dégradé vertical, reflet, facettes, contour.
function ornamentLayers(d, c, { shade = null, detail = null, detailOp = 0.55, haloK = 0.9, fill = 'url:metalV' } = {}) {
  const L = [...haloLayers(d, c, haloK), { d, fill }, { d, fill: 'url:sheen' }];
  if (shade) L.push({ d: shade, fill: '#000000', op: 0.28 });
  if (detail) L.push({ d: detail, fill: 'none', stroke: c.tones.light, sw: c.hair * 0.75, op: detailOp });
  L.push({ d, fill: 'none', stroke: c.tones.dark, sw: c.hair, op: 0.9 });
  return L;
}

// ─── Couronne ────────────────────────────────────────────────────────────────

function crownLayers(c) {
  const u = c.R;
  const y0 = -0.74 * u;            // bas du bandeau (enchâssé dans l'anneau)
  const yb = -0.98 * u;            // haut du bandeau
  const bw = 0.7 * u;              // demi-largeur du bandeau
  const tips = [
    { x: -0.84 * u, y: yb - 0.4 * u },
    { x: -0.42 * u, y: yb - 0.54 * u },
    { x: 0,         y: yb - 0.68 * u },
    { x: 0.42 * u,  y: yb - 0.54 * u },
    { x: 0.84 * u,  y: yb - 0.4 * u },
  ];
  const valleys = [-0.62, -0.21, 0.21, 0.62].map((x) => ({ x: x * u, y: yb - 0.1 * u }));

  let body = `M${pt(-bw, yb + 0.04 * u)} L${pt(tips[0].x, tips[0].y)} `;
  for (let i = 0; i < valleys.length; i++) {
    const t = tips[i], v = valleys[i], n = tips[i + 1];
    body += `Q${pt(t.x + (v.x - t.x) * 0.15, v.y)} ${pt(v.x, v.y)} `;
    body += `Q${pt(n.x - (n.x - v.x) * 0.15, v.y)} ${pt(n.x, n.y)} `;
  }
  body += `L${pt(bw, yb + 0.04 * u)} Z`;

  // Facettes : moitié droite de chaque fleuron dans l'ombre.
  const shade = tips.map((t, i) => {
    const right = valleys[i] || { x: bw, y: yb };
    return `M${pt(t.x, t.y)} L${pt(right.x, right.y)} L${pt(right.x, yb + 0.04 * u)} L${pt(t.x, yb + 0.04 * u)} Z`;
  }).join(' ');

  const band =
    `M${pt(-bw, yb)} Q${pt(0, yb - 0.08 * u)} ${pt(bw, yb)} ` +
    `L${pt(bw * 0.9, y0)} Q${pt(0, y0 - 0.08 * u)} ${pt(-bw * 0.9, y0)} Z`;

  const L = [
    ...ornamentLayers(body, c, { shade }),
    ...ornamentLayers(band, c, { haloK: 0.5 }),
  ];
  // Bandeau gravé : deux filets qui suivent sa courbe.
  [0.3, 0.7].forEach((k) => {
    const y = yb + (y0 - yb) * k;
    const line = `M${pt(-bw * 0.9, y)} Q${pt(0, y - 0.08 * u)} ${pt(bw * 0.9, y)}`;
    L.push({ d: line, fill: 'none', stroke: '#000000', sw: c.hair * 1.1, op: 0.45 });
    L.push({ d: line, fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.5, op: 0.3 });
  });
  return L;
}

// ─── Ailes ───────────────────────────────────────────────────────────────────

// Plume en feuille effilée, légèrement incurvée vers le haut.
function feather(base, angleDeg, len, width) {
  const a = deg(angleDeg);
  const ux = Math.cos(a), uy = -Math.sin(a);
  const nx = -uy, ny = ux;
  const P = (along, side) => ({ x: base.x + ux * along + nx * side, y: base.y + uy * along + ny * side });
  const tip = P(len, -width * 0.25);
  const a1 = P(len * 0.3, -width * 0.62), a2 = P(len * 0.78, -width * 0.48);
  const b1 = P(len * 0.78, width * 0.42), b2 = P(len * 0.3, width * 0.6);
  const s0 = P(0, -width * 0.32), s1 = P(0, width * 0.32);
  const q = P(len * 0.4, 0), quillEnd = P(len * 0.82, -width * 0.18);
  return {
    d:
      `M${pt(s0.x, s0.y)} C${pt(a1.x, a1.y)} ${pt(a2.x, a2.y)} ${pt(tip.x, tip.y)} ` +
      `C${pt(b1.x, b1.y)} ${pt(b2.x, b2.y)} ${pt(s1.x, s1.y)} Z`,
    quill: `M${pt(base.x, base.y)} Q${pt(q.x, q.y)} ${pt(quillEnd.x, quillEnd.y)}`,
    shade:
      `M${pt(base.x, base.y)} Q${pt(q.x, q.y)} ${pt(quillEnd.x, quillEnd.y)} ` +
      `L${pt(tip.x, tip.y)} C${pt(b1.x, b1.y)} ${pt(b2.x, b2.y)} ${pt(s1.x, s1.y)} Z`,
  };
}

function wingLayers(c) {
  const u = c.R;
  // Éventail serré depuis l'épaule de l'anneau : les plumes se chevauchent
  // pour former une aile pleine, les plus longues en haut (aile levée).
  const tiers = [
    { feathers: [
      { phi: -14, ang: -22, len: 0.5 },
      { phi: -6,  ang: -4,  len: 0.64 },
      { phi: 2,   ang: 14,  len: 0.78 },
      { phi: 10,  ang: 31,  len: 0.9 },
      { phi: 18,  ang: 47,  len: 0.96 },
      { phi: 26,  ang: 62,  len: 0.9 },
    ], w: 0.27, rootR: 0.88 },
    { feathers: [
      { phi: -4, ang: -6, len: 0.36 },
      { phi: 8,  ang: 16, len: 0.42 },
      { phi: 20, ang: 38, len: 0.44 },
      { phi: 32, ang: 58, len: 0.38 },
    ], w: 0.24, rootR: 0.94 },
  ];
  const L = [];
  tiers.forEach((tier) => {
    const ds = [], quills = [], shades = [];
    [-1, 1].forEach((s) => {
      tier.feathers.forEach((f) => {
        const base = { x: s * u * tier.rootR * Math.cos(deg(f.phi)), y: -u * tier.rootR * Math.sin(deg(f.phi)) };
        const fe = feather(base, s > 0 ? f.ang : 180 - f.ang, f.len * u, tier.w * u);
        ds.push(fe.d); quills.push(fe.quill); shades.push(fe.shade);
      });
    });
    L.push(...ornamentLayers(ds.join(' '), c, { shade: shades.join(' '), detail: quills.join(' '), detailOp: 0.5 }));
  });
  return L;
}

// ─── Divin ───────────────────────────────────────────────────────────────────

function ellipsePath(rx, ry, cx = 0, cy = 0) {
  return (
    `M${pt(cx + rx, cy)} A${n2(rx)},${n2(ry)} 0 1 0 ${pt(cx - rx, cy)} ` +
    `A${n2(rx)},${n2(ry)} 0 1 0 ${pt(cx + rx, cy)} Z`
  );
}

// Gloire : faisceaux de lumière qui S'ÉLARGISSENT en s'éloignant de l'anneau
// (comme de vrais rayons) et se fondent dans le noir (dégradé radial 'rays'),
// avec un filet clair au cœur des faisceaux principaux.
function beam(a, r0, r1, w0, w1) {
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  const P = (r, w) => ({ x: c * r + nx * w, y: s * r + ny * w });
  return `${polyline([P(r0, -w0), P(r1, -w1), P(r1, w1), P(r0, w0)])} Z`;
}

function divineBack(c) {
  const u = c.R;
  const major = [], minor = [], cores = [];
  for (let i = 0; i < 24; i++) {
    const a = deg(-90 + i * 15);
    if (i % 2 === 0) {
      const len = (i % 4 === 0 ? 1.66 : 1.5) * u;
      major.push(beam(a, 0.96 * u, len, 0.025 * u, 0.12 * u));
      cores.push(polyline([polar(1.0 * u, a), polar(len * 0.92, a)]));
    } else {
      minor.push(beam(a, 0.96 * u, 1.3 * u, 0.02 * u, 0.07 * u));
    }
  }
  return [
    { d: circlePath(1.66 * u), fill: 'url:aura' },
    { d: minor.join(' '), fill: 'url:rays', op: 0.55 },
    { d: major.join(' '), fill: 'url:rays', op: 0.85 },
    { d: cores.join(' '), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.7, op: 0.5, cap: 'round' },
    { d: circlePath(1.1 * u), fill: 'none', stroke: c.tones.light, sw: c.hair * 0.8, op: 0.3 },
  ];
}

// Auréole d'ange qui flotte au-dessus de l'avatar.
function divineHalo(c) {
  const u = c.R;
  const cy = -1.24 * u, rx = 0.56 * u, ry = 0.14 * u, t = Math.max(c.ringW * 0.9, 0.07 * u);
  const outer = ellipsePath(rx, ry, 0, cy);
  const inner = ellipsePath(rx - t, ry - t * 0.42, 0, cy);
  const ring = `${outer} ${inner}`;
  const glow = c.glow || c.tones.light;
  return [
    { d: outer, fill: 'none', stroke: glow, sw: t * 2.6, op: 0.18 },
    { d: outer, fill: 'none', stroke: glow, sw: t * 1.3, op: 0.3 },
    { d: ring, fill: 'url:metalV', rule: 'evenodd' },
    { d: ring, fill: c.tones.light, op: 0.35, rule: 'evenodd' },
    { d: ring, fill: 'url:sheen', rule: 'evenodd' },
    { d: ellipsePath(rx - t * 0.5, ry - t * 0.21, 0, cy - t * 0.08), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.8, op: 0.75 },
    { d: outer, fill: 'none', stroke: c.tones.dark, sw: c.hair * 0.8, op: 0.6 },
  ];
}

// ─── Éclairs ─────────────────────────────────────────────────────────────────
// Deux grands éclairs en zigzag qui jaillissent des flancs de l'anneau, un
// plus petit vers le bas, et des arcs électriques crépitant autour.

// Silhouette ⚡ : (s = travers, t = le long de l'éclair, 0 base → 1 pointe).
const BOLT = [
  [-0.1, 0], [0.42, 0], [0.12, 0.42], [0.4, 0.42],
  [-0.3, 1], [-0.02, 0.55], [-0.34, 0.55],
];

function bolt(base, angleDeg, len, width, mirror = false) {
  const a = deg(angleDeg);
  const ux = Math.cos(a), uy = Math.sin(a);       // le long
  const nx = -uy, ny = ux;                         // en travers
  const m = mirror ? -1 : 1;
  const P = ([s, t]) => ({ x: base.x + ux * t * len + nx * s * width * m, y: base.y + uy * t * len + ny * s * width * m });
  const p = BOLT.map(P);
  return {
    d: `${polyline(p)} Z`,
    // Facette ombrée : la moitié « arrière » de chaque segment.
    shade: `${polyline([p[1], p[2], p[3], p[4], p[5]])} Z`,
    // Arête lumineuse qui suit le zigzag.
    edge: polyline([P([0.2, 0.05]), P([-0.12, 0.5]), P([0.2, 0.5]), P([-0.22, 0.9])]),
  };
}

function crackle(r, a0, a1, amp, seed) {
  const steps = Math.max(4, Math.round(Math.abs(a1 - a0) / 7));
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const a = deg(a0 + ((a1 - a0) * i) / steps);
    const jitter = i === 0 || i === steps ? 0 : (((i * 7 + seed) % 5) - 2) / 2;
    return polar(r + amp * jitter, a);
  });
  return polyline(pts);
}

function boltLayers(c) {
  const u = c.R;
  // Base posée sur le bord de l'anneau : tout le zigzag reste visible.
  const bolts = [
    // Deux éclairs opposés en diagonale (rotation 180°) + un éclat secondaire.
    bolt(polar(0.92 * u, deg(-122)), -114, 0.92 * u, 0.62 * u, true),
    bolt(polar(0.92 * u, deg(58)), 66, 0.92 * u, 0.62 * u, true),
    bolt(polar(0.94 * u, deg(-30)), -22, 0.5 * u, 0.36 * u, true),
  ];
  const d = bolts.map((b) => b.d).join(' ');
  const shade = bolts.map((b) => b.shade).join(' ');
  const edge = bolts.map((b) => b.edge).join(' ');
  // Arcs électriques qui crépitent au ras de l'anneau, entre les éclairs.
  const arcs = [
    crackle(1.09 * u, -100, -48, 0.07 * u, 1),
    crackle(1.08 * u, 132, 186, 0.06 * u, 2),
    crackle(1.08 * u, 0, 44, 0.06 * u, 3),
  ].join(' ');
  const spark = c.glow || c.tones.mid;
  return [
    { d: arcs, fill: 'none', stroke: spark, sw: c.ringW * 1.1, op: 0.25, cap: 'round' },
    { d: arcs, fill: 'none', stroke: c.tones.light, sw: c.hair * 1.6, op: 0.95, cap: 'round' },
    { d: arcs, fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.6, op: 0.85, cap: 'round' },
    ...ornamentLayers(d, c, { shade }),
    { d: edge, fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.9, op: 0.6, cap: 'round' },
  ];
}

// ─── Néon ────────────────────────────────────────────────────────────────────
// Pas de métal ici : une plaque sombre, et un vrai tube de verre lumineux
// (cœur blanc, gaine colorée, halo diffus) plié en carré arrondi, coupé en
// deux segments avec électrodes et fixé par des clips — comme une enseigne.

function neonRing(shapeFn, c) {
  const outer = shapeFn(c.R);
  const inner = shapeFn(c.r);
  const mid = shapeFn(c.r + c.ringW * 0.5);
  const { points, length } = evenPoints(mid, 160, -135);
  const gap = (c.ringW * 1.6) / length;            // en fraction du périmètre
  const seg = (f0, f1) => points.slice(Math.round(f0 * 160), Math.round(f1 * 160) + 1);
  const segs = [seg(gap / 2, 0.5 - gap / 2), seg(0.5 + gap / 2, 1 - gap / 2)];
  const tube = segs.map(polyline).join(' ');
  const ends = segs.flatMap((s) => [s[0], s[s.length - 1]]);
  const clipAt = [0.17, 0.33, 0.67, 0.83].map((f) => points[Math.round(f * 160)]);
  const clip = (p) => {
    const hw = c.ringW * 0.26, hh = c.ringW * 0.62;
    const nx = -p.ty, ny = p.tx;
    const q = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => ({ x: p.x + p.tx * a + nx * b, y: p.y + p.ty * a + ny * b }));
    return `${polyline(q)} Z`;
  };
  const glow = c.glow;
  return [
    // Plaque sombre teintée par la palette.
    { d: `${outer} ${inner}`, fill: c.tones.dark, rule: 'evenodd' },
    { d: `${outer} ${inner}`, fill: '#000000', op: 0.55, rule: 'evenodd' },
    { d: outer, fill: 'none', stroke: c.tones.mid, sw: c.hair, op: 0.45 },
    { d: shapeFn(c.R - c.ringW * 0.12), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.6, op: 0.12 },
    // Tube : halo diffus → gaine colorée → verre clair → filament blanc.
    { d: tube, fill: 'none', stroke: glow, sw: c.ringW * 2.6, op: 0.16, cap: 'round' },
    { d: tube, fill: 'none', stroke: glow, sw: c.ringW * 1.4, op: 0.35, cap: 'round' },
    { d: tube, fill: 'none', stroke: c.tones.light, sw: c.ringW * 0.62, op: 1, cap: 'round' },
    { d: tube, fill: 'none', stroke: '#FFFFFF', sw: c.ringW * 0.24, op: 0.92, cap: 'round' },
    // Électrodes aux extrémités et clips de fixation.
    { d: ends.map((p) => circlePath(c.ringW * 0.3, p.x, p.y)).join(' '), fill: '#1A1A22' },
    { d: ends.map((p) => circlePath(c.ringW * 0.3, p.x, p.y)).join(' '), fill: 'none', stroke: c.tones.mid, sw: c.hair * 0.6, op: 0.6 },
    { d: clipAt.map(clip).join(' '), fill: '#1A1A22', op: 0.95 },
    { d: clipAt.map(clip).join(' '), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.5, op: 0.25 },
    // Intérieur.
    { d: inner, fill: 'none', stroke: '#000000', sw: c.ringW * 0.3, op: 0.5 },
    { d: inner, fill: BG },
    { d: shapeFn(c.r - c.hair * 1.1), fill: 'none', stroke: glow, sw: c.hair * 0.8, op: 0.35 },
  ];
}

// ─── Croc de Dragon ──────────────────────────────────────────────────────────
// Écu écaillé, tenu par deux pattes griffues dont les serres se referment
// sur le bord, cornes annelées derrière, et un œil de dragon serti au sommet.

function dragonBack(c) {
  const u = c.R;
  const ds = [], shades = [], ridges = [];
  [-1, 1].forEach((s) => {
    const h = horn(
      { x: -s * 0.12 * u, y: 0.3 * u },
      { x: s * 0.6 * u,   y: -0.2 * u },
      { x: s * 1.55 * u,  y: -0.6 * u },
      { x: s * 1.0 * u,   y: -1.55 * u },
      0.32 * u,
      { ridgeAt: [0.34, 0.44, 0.53, 0.62, 0.7, 0.78, 0.85] },
    );
    ds.push(h.d); shades.push(h.shade); ridges.push(h.ridges);
  });
  return ornamentLayers(ds.join(' '), c, { shade: shades.join(' '), detail: ridges.join(' '), detailOp: 0.6 });
}

// Écailles : petits arcs imbriqués le long de l'anneau.
function dragonScales(shapeFn, c) {
  const mid = shapeFn(c.r + c.ringW * 0.5);
  const { length } = evenPoints(mid, 4);
  const count = Math.round(length / (c.ringW * 0.95));
  const sr = c.ringW * 0.38;
  const d = evenPoints(mid, count, -90).points.map((p) => {
    // Arc ouvert vers l'extérieur de l'anneau.
    const nx = p.ty, ny = -p.tx;                  // normale extérieure (sens horaire)
    const a = { x: p.x - p.tx * sr, y: p.y - p.ty * sr };
    const b = { x: p.x + p.tx * sr, y: p.y + p.ty * sr };
    const ctl = { x: p.x - nx * sr * 1.4, y: p.y - ny * sr * 1.4 };
    return `M${pt(a.x, a.y)} Q${pt(ctl.x, ctl.y)} ${pt(b.x, b.y)}`;
  }).join(' ');
  return [
    { d, fill: 'none', stroke: '#000000', sw: c.hair * 1.1, op: 0.42 },
    { d, fill: 'none', stroke: c.tones.light, sw: c.hair * 0.5, op: 0.28 },
  ];
}

// Épine / croc recourbé, effilé jusqu'à une pointe acérée.
function fang(base, tip, bend, w) {
  const mx = (base.x + tip.x) / 2, my = (base.y + tip.y) / 2;
  const dx = tip.x - base.x, dy = tip.y - base.y, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const c1 = { x: base.x + dx * 0.33 + nx * bend * 0.6, y: base.y + dy * 0.33 + ny * bend * 0.6 };
  const c2 = { x: mx + dx * 0.25 + nx * bend, y: my + dy * 0.25 + ny * bend };
  return horn(base, c1, c2, tip, w, { ridgeAt: [], innerK: 0.85 });
}

// Crête d'épines entre les cornes, la plus haute au centre, légèrement
// rejetées vers l'arrière comme une collerette de dragon.
function dragonCrest(shapeFn, c) {
  const u = c.R;
  const edge = shapeFn(c.R);
  const ds = [], shades = [];
  [[-90, 1.5, 0], [-74, 1.34, 1], [-106, 1.34, -1], [-60, 1.2, 1], [-120, 1.2, -1]].forEach(([a, len, side]) => {
    const ang = deg(a);
    const re = radiusAt(edge, ang);
    const base = polar(re * 0.86, ang);
    const tip = polar(len * u, ang + side * deg(7));
    const f = fang(base, tip, side * 0.06 * u, (side === 0 ? 0.13 : 0.1) * u);
    ds.push(f.d); shades.push(f.shade);
  });
  return ornamentLayers(ds.join(' '), c, { shade: shades.join(' '), haloK: 0.7 });
}

// Bas de l'écu en dents de scie : petites épines qui pointent vers l'extérieur.
function dragonSerration(shapeFn, c) {
  const u = c.R;
  const pts = evenPoints(shapeFn(c.R), 26, -90).points.filter((q) => q.y > 0.25 * u);
  const ds = [], shades = [];
  pts.forEach((q) => {
    const ang = Math.atan2(q.y, q.x);
    const r0 = Math.hypot(q.x, q.y);
    const b = blade(ang, r0 * 0.9, r0 + 0.17 * u, 0.065 * u);
    ds.push(b.full); shades.push(b.shade);
  });
  return ornamentLayers(ds.join(' '), c, { shade: shades.join(' '), haloK: 0.6 });
}

// Gueule : grands crocs ivoire qui se referment autour de l'avatar —
// deux en haut qui plongent, deux en bas qui remontent, plus deux petits.
function dragonFangs(shapeFn, c) {
  const u = c.R;
  const edge = shapeFn(c.R);
  const ds = [], shades = [];
  const add = (a, tipK, turn, w, bend) => {
    const ang = deg(a);
    const re = radiusAt(edge, ang);
    const base = polar(re * 0.98, ang);
    const tip = polar(re * tipK, ang + deg(turn));
    const f = fang(base, tip, bend * u, w * u);
    ds.push(f.d); shades.push(f.shade);
  };
  [-1, 1].forEach((s) => {
    const A = (deg0) => (s > 0 ? deg0 : 180 - deg0);
    add(A(-36), 0.5, s * 18, 0.2, s * 0.07);    // croc supérieur
    add(A(-12), 0.7, s * 10, 0.1, s * 0.035);   // petit croc supérieur
    add(A(42), 0.5, -s * 18, 0.2, -s * 0.07);   // croc inférieur
    add(A(18), 0.7, -s * 10, 0.1, -s * 0.035);  // petit croc inférieur
  });
  const d = ds.join(' ');
  return [
    { d, fill: '#000000', op: 0.45, stroke: '#000000', sw: c.hair * 2.6 },
    { d, fill: c.tones.light },
    { d, fill: '#FFFFFF', op: 0.18 },
    { d: shades.join(' '), fill: c.tones.dark, op: 0.55 },
    { d, fill: 'url:sheen' },
    { d, fill: 'none', stroke: c.tones.dark, sw: c.hair * 0.8, op: 0.95 },
  ];
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

const SHAPES = {
  circle: { fn: (r) => circlePath(r) },
  hex: { fn: (r) => polygon(6, r, 0, 0.16) },
  oct: { fn: (r) => polygon(8, r, 22.5, 0.2) },
  shield: { fn: (r) => shieldPath(r) },
  spike: { fn: (r) => circlePath(r), back: boltLayers },
  neon: { fn: (r) => squirclePath(r), ringOverride: neonRing },
  crown: { fn: (r) => circlePath(r), front: crownLayers },
  wings: { fn: (r) => circlePath(r), back: wingLayers },
  divine: { fn: (r) => circlePath(r), back: divineBack, front: divineHalo },
  dragonfang: {
    fn: (r) => shieldPath(r),
    back: (c) => [
      ...dragonBack(c),
      ...dragonCrest((r) => shieldPath(r), c),
      ...dragonSerration((r) => shieldPath(r), c),
    ],
    ringExtra: dragonScales,
    front: (c) => dragonFangs((r) => shieldPath(r), c),
  },
};

const hexToRgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export function buildFrame(shapeId, colorDef, S) {
  const id = SHAPES[shapeId] ? shapeId : 'circle';
  const shape = SHAPES[id];
  const ringW = ringWidth(colorDef, S);
  const r = S / 2;
  const R = r + ringW;
  const tones = paletteTones(colorDef.colors);
  // Le néon brille toujours, même sur les métaux sans halo (Acier, Bronze).
  const glow = colorDef.glowColor || (id === 'neon' ? hexToRgba(tones.mid, 0.6) : null);
  const c = { S, r, R, ringW, hair: Math.max(0.5, ringW * 0.11), tones, glow, tier: frameTier(colorDef) };

  const ring = shape.ringOverride
    ? shape.ringOverride(shape.fn, c)
    : ringLayers(shape.fn, c);
  if (shape.ringExtra) ring.splice(3, 0, ...shape.ringExtra(shape.fn, c));

  return {
    R, r, ringW, glow, tier: c.tier,
    // Séparé du reste : AvatarFrame peut l'animer (pulsation) indépendamment.
    halo: ringHalo(shape.fn, c),
    layers: [
      ...(shape.back ? shape.back(c) : []),
      ...ring,
      ...(shape.front ? shape.front(c) : []),
    ],
  };
}
