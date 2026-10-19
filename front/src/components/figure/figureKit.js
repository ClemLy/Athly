// ─── Boîte à outils du mannequin ──────────────────────────────────────────────
// Repère, longueurs du corps, calcul des articulations, assemblage d'un corps
// vu de profil et accessoires. Utilisé par les générateurs de mouvements
// (moves*.js, figureFrontal.js) et par figureEngine.js.
//
// Repère : scène de 200 × 140, sol à y = GROUND, le corps regarde vers la
// droite (+x). Angles en degrés : 0 = droite, 90 = haut.
//
// Coudes et genoux : on donne la DIRECTION vers laquelle ils plient (vers les
// hanches, vers l'avant…) plutôt qu'un sens de rotation : la même règle reste
// juste quelle que soit l'orientation du membre.

export const GROUND = 122;
export const G = GROUND;

// Longueurs des segments (taille debout ≈ 105)
export const L = {
  head: 7.6, neck: 6.5, torso: 33, upperArm: 18, forearm: 17, thigh: 26, shin: 25, foot: 8.5,
};

export const ARM = L.upperArm + L.forearm;
export const LEG = L.thigh + L.shin;
export const LIE = G - 8; // hauteur des épaules et du bassin allongé au sol

// ─── Vecteurs ────────────────────────────────────────────────────────────────
export const P = (x, y) => ({ x, y });
export const add = (a, b) => P(a.x + b.x, a.y + b.y);
export const sub = (a, b) => P(a.x - b.x, a.y - b.y);
export const mul = (a, k) => P(a.x * k, a.y * k);
const dot = (a, b) => a.x * b.x + a.y * b.y;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a) => { const d = Math.hypot(a.x, a.y) || 1; return P(a.x / d, a.y / d); };
export const rad = (deg) => (deg * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const dir = (a) => P(Math.cos(rad(a)), -Math.sin(rad(a)));
export const polar = (p, a, len) => add(p, mul(dir(a), len));
export const angleOf = (a, b) => deg(Math.atan2(-(b.y - a.y), b.x - a.x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpP = (a, b, t) => P(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const smooth = (t) => t * t * (3 - 2 * t);

// Angle interpolé par le plus court chemin
export const lerpA = (a, b, t) => a + (((((b - a) % 360) + 540) % 360) - 180) * t;

// Les deux positions possibles de l'articulation du milieu d'une chaîne à deux
// segments (coude, genou). Cible hors d'atteinte : membre tendu vers elle.
function joints2(a, c, l1, l2) {
  const d = clamp(dist(a, c), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.001);
  const u = norm(sub(c, a));
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const rot = (s) => P(u.x * Math.cos(A * s) - u.y * Math.sin(A * s), u.x * Math.sin(A * s) + u.y * Math.cos(A * s));
  return [add(a, mul(rot(1), l1)), add(a, mul(rot(-1), l1))];
}

// Articulation qui plie vers `pref` : un vecteur, un angle en degrés, ou un
// côté de la droite a → c ('cw' : à droite en suivant a → c, 'ccw' : à gauche).
// Corps tourné vers la droite : coudes 'cw', genoux 'ccw' (l'avant-bras et le
// tibia se replient du bon côté quelle que soit l'orientation du membre).
export function bend(a, c, l1, l2, pref) {
  const u = sub(c, a);
  let v = pref;
  if (pref === 'cw') v = P(-u.y, u.x);
  else if (pref === 'ccw') v = P(u.y, -u.x);
  else if (typeof pref === 'number') v = dir(pref);
  const [s1, s2] = joints2(a, c, l1, l2);
  return dot(sub(s1, a), v) >= dot(sub(s2, a), v) ? s1 : s2;
}

// Variante à sens explicite (+1 / -1)
export function twoBone(a, c, l1, l2, side = 1) {
  const [s1, s2] = joints2(a, c, l1, l2);
  return side >= 0 ? s1 : s2;
}

// Intersection de deux cercles ; pick choisit la solution.
export function circles(c0, r0, c1, r1, pick = 'up') {
  const d = clamp(dist(c0, c1), Math.abs(r0 - r1) + 0.01, r0 + r1 - 0.001);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const u = norm(sub(c1, c0));
  const m = add(c0, mul(u, a));
  const s1 = P(m.x - u.y * h, m.y + u.x * h);
  const s2 = P(m.x + u.y * h, m.y - u.x * h);
  if (pick === 'up') return s1.y < s2.y ? s1 : s2;
  if (pick === 'down') return s1.y > s2.y ? s1 : s2;
  if (pick === 'right') return s1.x > s2.x ? s1 : s2;
  return s1.x < s2.x ? s1 : s2;
}

// Point à la hauteur y, à distance len de p (côté gauche par défaut)
export const onLevel = (p, len, y, side = -1) => P(p.x + side * Math.sqrt(Math.max(1, len * len - (y - p.y) ** 2)), y);

// Point le plus loin possible sur le segment a → b à portée (len) de `from` :
// une main qui glisse le long de la jambe aussi loin que le bras le permet.
export function reachAlong(from, a, b, len) {
  if (dist(from, b) <= len) return b;
  let lo = 0; let hi = 1;
  if (dist(from, a) > len) return add(from, mul(norm(sub(a, from)), len));
  for (let i = 0; i < 24; i += 1) {
    const m = (lo + hi) / 2;
    if (dist(from, lerpP(a, b, m)) <= len) lo = m; else hi = m;
  }
  return lerpP(a, b, lo);
}

// Hauteur de bassin la plus haute avec tous les pieds posés (jambes presque tendues)
export const topHip = (x, ankles) => Math.max(...ankles.map((a) => a.y - Math.sqrt(Math.max(1, (LEG - 0.8) ** 2 - (x - a.x) ** 2))));

// Pieds : posé à plat, ou sur la pointe (cheville au-dessus des orteils)
export const flatFoot = (x, y = G) => ({ ankle: P(x, y - 4), toe: P(x + 8.3, y - 1.5) });
export const onToes = (x, y = G) => ({ ankle: P(x, y - 6), toe: P(x + 6, y - 1) });

// Entrées : bassin, épaule, mains et chevilles (proche / loin), directions de
// pliage des coudes et genoux (elbow, knee…), ou articulations imposées
// (elbowNAt, kneeNAt…), pointes de pied (point ou angle).
// mirror : corps vu de l'autre côté (allongé tête à droite ventre en l'air,
// ou tête à gauche ventre au sol) : coudes et genoux plient dans l'autre sens.
export function body(o) {
  const { hip, shoulder, handN, ankleN, curve = 0 } = o;
  const handF = o.handF || handN;
  const ankleF = o.ankleF || ankleN;
  const spine = norm(sub(shoulder, hip));
  const mid = add(lerpP(hip, shoulder, 0.5), mul(P(-spine.y, spine.x), curve));
  const head = o.head || polar(shoulder, o.neck != null ? o.neck : angleOf(hip, shoulder), L.neck + L.head);
  const ePN = o.elbow ?? (o.mirror ? 'ccw' : 'cw');
  const kPN = o.knee ?? (o.mirror ? 'cw' : 'ccw');
  const toeN = o.toeN && typeof o.toeN === 'object' ? o.toeN : polar(ankleN, o.toeN ?? 0, L.foot);
  let toeF;
  if (o.toeF && typeof o.toeF === 'object') toeF = o.toeF;
  else if (o.toeF != null) toeF = polar(ankleF, o.toeF, L.foot);
  else toeF = add(ankleF, sub(toeN, ankleN));
  return {
    hip, shoulder, mid, head,
    chest: o.chest || shoulder,
    elbowN: o.elbowNAt || bend(shoulder, handN, L.upperArm, L.forearm, ePN),
    elbowF: o.elbowFAt || bend(shoulder, handF, L.upperArm, L.forearm, o.elbowF ?? ePN),
    handN, handF,
    kneeN: o.kneeNAt || bend(hip, ankleN, L.thigh, L.shin, kPN),
    kneeF: o.kneeFAt || bend(hip, ankleF, L.thigh, L.shin, o.kneeF ?? kPN),
    ankleN, ankleF, toeN, toeF,
  };
}

export const prop = {
  wall: (x) => ({ k: 'rect', x, y: 6, w: 7, h: G - 6, c: 'prop', full: true }),
  box: (x, w, h) => ({ k: 'rect', x, y: G - h, w, h, r: 2, c: 'prop' }),
  chair: (x, h = 30, w = 26) => [
    { k: 'rect', x, y: G - h, w, h: 4, r: 1.5, c: 'prop' },
    { k: 'line', x1: x + 3, y1: G - h, x2: x + 3, y2: G, w: 2.5, c: 'prop' },
    { k: 'line', x1: x + w - 3, y1: G - h, x2: x + w - 3, y2: G, w: 2.5, c: 'prop' },
  ],
  table: (x, h = 52, w = 46) => [
    { k: 'rect', x, y: G - h, w, h: 4, r: 1.5, c: 'prop' },
    { k: 'line', x1: x + 4, y1: G - h, x2: x + 4, y2: G, w: 2.5, c: 'prop' },
    { k: 'line', x1: x + w - 4, y1: G - h, x2: x + w - 4, y2: G, w: 2.5, c: 'prop' },
  ],
  bar: (x, y) => [
    { k: 'line', x1: x - 10, y1: y, x2: x + 10, y2: y, w: 1.4, c: 'propEdge' },
    { k: 'circle', cx: x, cy: y, r: 3.4, c: 'prop' },
  ],
  pbar: (x1, x2, y) => [
    { k: 'line', x1, y1: y, x2, y2: y, w: 4, c: 'prop' },
    { k: 'line', x1: x1 + 4, y1: y, x2: x1 + 4, y2: G, w: 2.5, c: 'prop' },
    { k: 'line', x1: x2 - 4, y1: y, x2: x2 - 4, y2: G, w: 2.5, c: 'prop' },
  ],
  parallettes: (x, w = 22, h = 9) => [
    { k: 'line', x1: x, y1: G - h, x2: x + w, y2: G - h, w: 3.5, c: 'prop' },
    { k: 'line', x1: x + 3, y1: G - h, x2: x + 1, y2: G, w: 2, c: 'prop' },
    { k: 'line', x1: x + w - 3, y1: G - h, x2: x + w - 1, y2: G, w: 2, c: 'prop' },
  ],
  rings: (x, y) => [
    { k: 'line', x1: x, y1: y - 30, x2: x, y2: y - 3.5, w: 1.4, c: 'propEdge' },
    { k: 'ring', cx: x, cy: y, r: 3.6, c: 'prop' },
  ],
  pole: (x) => ({ k: 'rect', x: x - 2.5, y: 4, w: 5, h: G - 4, c: 'prop', full: true }),
  band: (a, b) => ({ k: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 1.6, c: 'band' }),
  anchor: (q) => ({ k: 'circle', cx: q.x, cy: q.y, r: 2.2, c: 'propEdge' }),
  dumbbell: (q) => ({ k: 'rect', x: q.x - 5, y: q.y - 2.5, w: 10, h: 5, r: 2, c: 'prop' }),
  towel: (x, w = 14) => ({ k: 'rect', x, y: G - 2, w, h: 2.5, r: 1, c: 'band' }),
  mat: (x1, x2) => ({ k: 'rect', x: x1, y: G - 1.5, w: x2 - x1, h: 2.5, r: 1.2, c: 'mat' }),
  stick: (q) => ({ k: 'circle', cx: q.x, cy: q.y, r: 2.4, c: 'band' }),
};

// Spline de Catmull-Rom : trajectoire fluide passant par des points clés
export function spline(pts, t) {
  const n = pts.length - 1;
  const s = clamp(t, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(s));
  const u = s - i;
  const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(n, i + 2)];
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return P(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y));
}

export const splineN = (vals, t) => spline(vals.map((v) => P(v, 0)), t).x;
export const flat = (arr) => arr.flat(2).filter(Boolean);
