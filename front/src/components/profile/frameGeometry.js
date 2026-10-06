// ─── Géométrie des cadres de profil ──────────────────────────────────────────
//
// Module pur (aucun import React Native) : décrit chaque cadre comme une pile
// de calques SVG `{ d, fill, stroke, sw, op, rule }` centrés sur (0,0), le
// centre de l'avatar. AvatarFrame se contente de les rendre avec react-native-svg.
//
// Règles de conception :
// - Tout est proportionnel à la taille de l'avatar (S) : un cadre a exactement
//   la même allure en 36 px dans le sélecteur et en 90 px sur le profil.
// - La boîte de mise en page est TOUJOURS l'anneau circulaire (2R × 2R), quelle
//   que soit la forme. Les ornements (couronne, ailes, rayons…) débordent dans
//   un canevas transparent au lieu de faire rétrécir l'avatar.
// - Les couleurs viennent exclusivement de la palette du cadre ; seuls des
//   reflets blancs / ombres noires translucides donnent le relief « métal ».
//
// Les valeurs `fill` de la forme 'url:<nom>' renvoient aux dégradés décrits
// par gradientDefs().

export const BG = '#0D0D15';

// Débord maximal des ornements depuis le centre, en multiples de R (rayon
// extérieur de l'anneau). Mesuré sur le rendu réel (getBBox) puis arrondi
// au-dessus. Sert aux écrans qui doivent réserver de la place autour du cadre.
export const SHAPE_BLEED = {
  circle:     { top: 1.02, bottom: 1.02, side: 1.0 },
  hex:        { top: 1.0,  bottom: 1.0,  side: 1.11 },
  oct:        { top: 1.04, bottom: 1.04, side: 1.01 },
  shield:     { top: 1.08, bottom: 1.14, side: 1.0 },
  spike:      { top: 1.45, bottom: 1.45, side: 1.26 },
  neon:       { top: 1.13, bottom: 1.13, side: 1.13 },
  crown:      { top: 1.78, bottom: 1.02, side: 1.0 },
  wings:      { top: 1.22, bottom: 1.02, side: 1.68 },
  divine:     { top: 1.44, bottom: 1.44, side: 1.44 },
  dragonfang: { top: 1.53, bottom: 1.14, side: 1.29 },
};

// Demi-côté du canevas SVG, en multiples de R : couvre le plus grand débord
// (+ halo lumineux) pour qu'aucun calque ne soit rogné par la bitmap SVG.
export const CANVAS_HALF = 2.1;

export function ringWidth(colorDef, S) {
  return Math.max(1.6, (colorDef.borderWidth || 2) * 1.15 * (S / 90));
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const n2 = (v) => Math.round(v * 100) / 100;
const pt = (x, y) => `${n2(x)},${n2(y)}`;
const deg = (d) => (d * Math.PI) / 180;

function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
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
    // Anneau : la palette complète en diagonale, comme auparavant.
    { id: 'metal', x1: 0, y1: 0, x2: 1, y2: 1, stops: spread },
    // Ornements : palette verticale, du ton le plus clair (haut) au plus sombre.
    { id: 'metalV', x1: 0, y1: 0, x2: 0, y2: 1, stops: [...colors]
      .sort((a, b) => luminance(b) - luminance(a))
      .map((c, i, arr) => ({ o: arr.length > 1 ? i / (arr.length - 1) : 0, c, a: 1 })) },
    // Reflet : lumière zénithale qui donne l'aspect métal poli.
    { id: 'sheen', x1: 0, y1: 0, x2: 0, y2: 1, stops: [
      { o: 0,    c: '#FFFFFF', a: 0.42 },
      { o: 0.42, c: '#FFFFFF', a: 0.06 },
      { o: 0.58, c: '#000000', a: 0 },
      { o: 1,    c: '#000000', a: 0.30 },
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
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides + deg(rotDeg);
    return { x: circ * Math.cos(a), y: circ * Math.sin(a) };
  });
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

// Carré à pans coupés (Néon).
function chamferPath(h) {
  const c = h * 0.3;
  const pts = [
    { x: -h + c, y: -h }, { x: h - c, y: -h }, { x: h, y: -h + c }, { x: h, y: h - c },
    { x: h - c, y: h }, { x: -h + c, y: h }, { x: -h, y: h - c }, { x: -h, y: -h + c },
  ];
  return roundedPoly(pts, h * 0.06);
}

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

function diamond(x, y, h, w = h * 0.68) {
  return `M${pt(x, y - h)} L${pt(x + w, y)} L${pt(x, y + h)} L${pt(x - w, y)} Z`;
}

// Gemme taillée : corps clair + facette gauche lumineuse + facette basse ombrée.
function gem(x, y, h, c) {
  const w = h * 0.68;
  return [
    { d: diamond(x, y, h * 1.25, w * 1.25), fill: '#000000', op: 0.35 },
    { d: diamond(x, y, h, w), fill: 'url:metal' },
    { d: `M${pt(x, y - h)} L${pt(x - w, y)} L${pt(x, y)} Z`, fill: '#FFFFFF', op: 0.55 },
    { d: `M${pt(x - w, y)} L${pt(x, y + h)} L${pt(x + w, y)} L${pt(x, y)} Z`, fill: '#000000', op: 0.25 },
    { d: diamond(x, y, h, w), fill: 'none', stroke: c.tones.dark, sw: c.hair * 0.7, op: 0.9 },
  ];
}

// Rivet / perle : sphère métal + point de lumière décentré.
function stud(x, y, rad, c) {
  return [
    { d: circlePath(rad * 1.3, x, y), fill: '#000000', op: 0.35 },
    { d: circlePath(rad, x, y), fill: 'url:metal' },
    { d: circlePath(rad, x, y), fill: 'url:sheen' },
    { d: circlePath(rad, x, y), fill: 'none', stroke: c.tones.dark, sw: c.hair * 0.6, op: 0.85 },
    { d: circlePath(rad * 0.32, x - rad * 0.32, y - rad * 0.36), fill: '#FFFFFF', op: 0.75 },
  ];
}

// ─── Calques communs ─────────────────────────────────────────────────────────

// Halo (couleurs lumineuses) ou ombre de contact (métaux simples) qui détache
// le cadre du fond. Le halo de l'anneau est un disque radial (cf. 'glow') ;
// celui des ornements un simple trait diffus qui épouse leur silhouette.
function haloLayers(d, c, k = 1) {
  if (c.glow) return [{ d, fill: 'none', stroke: c.glow, sw: c.ringW * 1.6 * k, op: 0.14 }];
  return [{ d, fill: 'none', stroke: '#000000', sw: c.ringW * 1.6 * k, op: 0.32 }];
}

function ringHalo(shapeFn, c) {
  if (c.glow) return [{ d: circlePath(c.R * 1.62), fill: 'url:glow' }];
  return haloLayers(shapeFn(c.R), c);
}

function ringLayers(shapeFn, c) {
  const outer = shapeFn(c.R);
  const inner = shapeFn(c.r);
  const ring = `${outer} ${inner}`;
  const L = [
    { d: ring, fill: 'url:metal', rule: 'evenodd' },
    { d: ring, fill: 'url:sheen', rule: 'evenodd' },
  ];
  // Filet de lumière parallèle au bord extérieur (biseau poli).
  if (c.ringW >= 2.4) {
    L.push({ d: shapeFn(c.R - c.ringW * 0.26), fill: 'none', stroke: '#FFFFFF', sw: c.hair * 0.8, op: 0.3 });
  }
  L.push({ d: outer, fill: 'none', stroke: c.tones.dark, sw: c.hair, op: 0.85 });
  // Biseau intérieur : ombre portée sur le bord interne de l'anneau…
  L.push({ d: inner, fill: 'none', stroke: '#000000', sw: c.ringW * 0.42, op: 0.5 });
  L.push({ d: inner, fill: BG });
  // …et liseré clair très discret côté avatar.
  L.push({ d: shapeFn(c.r - c.hair * 1.1), fill: 'none', stroke: c.tones.light, sw: c.hair * 0.6, op: 0.22 });
  return L;
}

// Ornement métal : halo, dégradé vertical, reflet, facettes, contour.
function ornamentLayers(d, c, { shade = null, detail = null, detailOp = 0.55, haloK = 0.9 } = {}) {
  const L = [...haloLayers(d, c, haloK), { d, fill: 'url:metalV' }, { d, fill: 'url:sheen' }];
  if (shade) L.push({ d: shade, fill: '#000000', op: 0.26 });
  if (detail) L.push({ d: detail, fill: 'none', stroke: c.tones.light, sw: c.hair * 0.75, op: detailOp });
  L.push({ d, fill: 'none', stroke: c.tones.dark, sw: c.hair, op: 0.9 });
  return L;
}

// ─── Formes spécifiques ──────────────────────────────────────────────────────

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
  tips.forEach((t, i) => L.push(...stud(t.x, t.y, (i === 2 ? 0.09 : 0.07) * u, c)));
  L.push(...gem(0, (yb + y0) / 2 - 0.035 * u, 0.12 * u, c));
  L.push(...stud(-0.38 * u, (yb + y0) / 2 - 0.02 * u, 0.055 * u, c));
  L.push(...stud(0.38 * u, (yb + y0) / 2 - 0.02 * u, 0.055 * u, c));
  return L;
}

// Plume en feuille effilée, légèrement incurvée vers le haut.
function feather(base, angleDeg, len, width) {
  const a = deg(angleDeg);
  const ux = Math.cos(a), uy = -Math.sin(a);
  const nx = -uy, ny = ux;                         // normale (côté « bas »)
  const P = (along, side) => ({ x: base.x + ux * along + nx * side, y: base.y + uy * along + ny * side });
  const tip = P(len, -width * 0.25);
  const a1 = P(len * 0.3, -width * 0.62), a2 = P(len * 0.78, -width * 0.48);
  const b1 = P(len * 0.78, width * 0.42), b2 = P(len * 0.3, width * 0.6);
  const s0 = P(0, -width * 0.32), s1 = P(0, width * 0.32);
  const quillEnd = P(len * 0.82, -width * 0.18);
  return {
    d:
      `M${pt(s0.x, s0.y)} C${pt(a1.x, a1.y)} ${pt(a2.x, a2.y)} ${pt(tip.x, tip.y)} ` +
      `C${pt(b1.x, b1.y)} ${pt(b2.x, b2.y)} ${pt(s1.x, s1.y)} Z`,
    quill: `M${pt(base.x, base.y)} Q${pt(P(len * 0.4, 0).x, P(len * 0.4, 0).y)} ${pt(quillEnd.x, quillEnd.y)}`,
    shade:
      `M${pt(base.x, base.y)} Q${pt(P(len * 0.4, 0).x, P(len * 0.4, 0).y)} ${pt(quillEnd.x, quillEnd.y)} ` +
      `L${pt(tip.x, tip.y)} C${pt(b1.x, b1.y)} ${pt(b2.x, b2.y)} ${pt(s1.x, s1.y)} Z`,
  };
}

function wingLayers(c) {
  const u = c.R;
  // Éventail serré depuis l'épaule de l'anneau : les plumes se chevauchent
  // pour former une aile pleine, les plus longues en haut (aile levée).
  const tiers = [
    // Rémiges primaires (arrière).
    { feathers: [
      { phi: -14, ang: -22, len: 0.5 },
      { phi: -6,  ang: -4,  len: 0.64 },
      { phi: 2,   ang: 14,  len: 0.78 },
      { phi: 10,  ang: 31,  len: 0.9 },
      { phi: 18,  ang: 47,  len: 0.96 },
      { phi: 26,  ang: 62,  len: 0.9 },
    ], w: 0.27, rootR: 0.88 },
    // Couvertures (avant), courtes et larges.
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
        const ang = s > 0 ? f.ang : 180 - f.ang;
        const fe = feather(base, ang, f.len * u, tier.w * u);
        ds.push(fe.d); quills.push(fe.quill); shades.push(fe.shade);
      });
    });
    L.push(...ornamentLayers(ds.join(' '), c, { shade: shades.join(' '), detail: quills.join(' '), detailOp: 0.5 }));
  });
  return L;
}

function divineBack(c) {
  const u = c.R;
  const long = bladeRing(8, -90, 0.9 * u, 1.44 * u, 0.13 * u);
  const short = bladeRing(8, -67.5, 0.9 * u, 1.2 * u, 0.08 * u);
  return [
    { d: circlePath(1.13 * u), fill: 'none', stroke: c.tones.light, sw: c.hair, op: 0.4 },
    ...ornamentLayers(short.full, c, { shade: short.shade, haloK: 0.6 }),
    ...ornamentLayers(long.full, c, { shade: long.shade }),
  ];
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

// Corne draconique : base épaisse (cachée derrière l'écu), balayage vers
// l'extérieur puis crochet de pointe. Effilement non linéaire et épaisseur
// asymétrique (bord extérieur convexe) pour un vrai volume de corne.
function horn(b, c1, c2, tip, baseW, steps = 18) {
  const pts = Array.from({ length: steps + 1 }, (_, i) => ({ ...cubicPoint(b, c1, c2, tip, i / steps), t: i / steps }));
  const outer = [], inner = [];
  pts.forEach((p, i) => {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = baseW * Math.pow(1 - p.t, 0.55) + baseW * 0.04;
    outer.push({ x: p.x + nx * w, y: p.y + ny * w });
    inner.push({ x: p.x - nx * w * 0.5, y: p.y - ny * w * 0.5 });
  });
  const line = (arr) => arr.map((p) => pt(p.x, p.y)).join(' L');
  const ridges = [0.3, 0.48, 0.64, 0.78].map((t) => {
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

function dragonBack(c) {
  const u = c.R;
  const ds = [], shades = [], ridges = [];
  [-1, 1].forEach((s) => {
    const h = horn(
      { x: -s * 0.16 * u, y: 0.34 * u },
      { x: s * 0.55 * u,  y: -0.15 * u },
      { x: s * 1.5 * u,   y: -0.62 * u },
      { x: s * 1.02 * u,  y: -1.52 * u },
      0.3 * u,
    );
    ds.push(h.d); shades.push(h.shade); ridges.push(h.ridges);
  });
  return ornamentLayers(ds.join(' '), c, { shade: shades.join(' '), detail: ridges.join(' '), detailOp: 0.6 });
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

const SHAPES = {
  circle: { fn: (r) => circlePath(r) },
  hex: {
    fn: (r) => polygon(6, r, 0, 0.16),
    front: (c) => (c.ringW < 2.4 ? [] : Array.from({ length: 6 }, (_, i) => {
      const a = deg(60 * i);
      const d = ((c.R + c.r) / 2 / Math.cos(Math.PI / 6)) * 0.94;
      return stud(d * Math.cos(a), d * Math.sin(a), Math.min(c.ringW * 0.34, c.S * 0.03), c);
    }).flat()),
  },
  oct: {
    fn: (r) => polygon(8, r, 22.5, 0.2),
    front: (c) => (c.ringW < 2.4 ? [] : [0, 90, 180, 270].flatMap((a) => {
      const m = (c.R + c.r) / 2;
      return gem(m * Math.cos(deg(a)), m * Math.sin(deg(a)), c.ringW * 0.62, c);
    })),
  },
  shield: {
    fn: (r) => shieldPath(r),
    front: (c) => gem(0, -(c.R + c.r) / 2, Math.max(c.ringW * 0.75, c.S * 0.045), c),
  },
  spike: {
    fn: (r) => polygon(6, r, 30, 0.14),
    back: (c) => {
      const short = bladeRing(6, -60, 0.8 * c.R, 1.24 * c.R, 0.12 * c.R);
      const long = bladeRing(6, -90, 0.8 * c.R, 1.45 * c.R, 0.18 * c.R);
      return [
        ...ornamentLayers(short.full, c, { shade: short.shade, haloK: 0.6 }),
        ...ornamentLayers(long.full, c, { shade: long.shade }),
      ];
    },
  },
  neon: {
    fn: (r) => chamferPath(r),
    back: (c) => {
      const tube = chamferPath(c.R + c.ringW * 0.9 + c.S * 0.012);
      const col = c.glow ? c.tones.light : c.tones.mid;
      return [
        ...(c.glow ? [{ d: tube, fill: 'none', stroke: c.glow, sw: c.ringW * 1.8, op: 0.35 }] : []),
        { d: tube, fill: 'none', stroke: col, sw: c.hair * 1.5, op: 0.95 },
      ];
    },
    front: (c) => {
      const m = (c.R + c.r) / 2;
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy]) =>
        stud(sx * m * 0.79, sy * m * 0.79, Math.min(c.ringW * 0.32, c.S * 0.028), c));
    },
  },
  crown: { fn: (r) => circlePath(r), front: crownLayers },
  wings: { fn: (r) => circlePath(r), back: wingLayers },
  divine: {
    fn: (r) => circlePath(r),
    back: divineBack,
    front: (c) => gem(0, -(c.R + c.r) / 2, Math.max(c.ringW * 0.85, c.S * 0.06), c),
  },
  dragonfang: {
    fn: (r) => shieldPath(r),
    back: dragonBack,
    front: (c) => gem(0, -(c.R + c.r) / 2, Math.max(c.ringW * 0.8, c.S * 0.05), c),
  },
};

export function buildFrame(shapeId, colorDef, S) {
  const shape = SHAPES[shapeId] || SHAPES.circle;
  const ringW = ringWidth(colorDef, S);
  const r = S / 2;
  const R = r + ringW;
  const c = {
    S, r, R, ringW,
    hair: Math.max(0.5, ringW * 0.13),
    tones: paletteTones(colorDef.colors),
    glow: colorDef.glowColor || null,
  };
  const layers = [
    ...ringHalo(shape.fn, c),
    ...(shape.back ? shape.back(c) : []),
    ...ringLayers(shape.fn, c),
    ...(shape.front ? shape.front(c) : []),
  ];
  return { R, r, ringW, layers };
}
