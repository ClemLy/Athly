// ─── Mouvements du bas du corps ───────────────────────────────────────────────
// Squats et variantes, fentes, nordic curl, ponts fessiers, charnière de hanche.

import {
  G, L, ARM, LEG, LIE, P, add, mul, dir, polar, angleOf, lerp, lerpP, smooth, lerpA, bend,
  topHip, flatFoot, onToes, body, prop,
} from './figureKit';
import { frontal } from './figureFrontal';

// Bassin le plus bas possible avec le genou arrière juste au-dessus du sol
function lowestHip(x, top, ankleBack, pref) {
  let lo = top; let hi = G - 10;
  for (let i = 0; i < 26; i += 1) {
    const y = (lo + hi) / 2;
    const knee = bend(P(x, y), ankleBack, L.thigh, L.shin, pref);
    if (knee.y > G - 7) hi = y; else lo = y;
  }
  return lo;
}

// Squats, fentes et variantes : pieds ancrés au sol
export function squat(t, p = {}) {
  const v = p.variant || 'squat';
  const s = smooth(t);
  const props = [];
  if (v === 'split' || v === 'lunge' || v === 'bulgarian') {
    const bulg = v === 'bulgarian';
    const front = flatFoot(bulg ? 120 : 122);
    const back = bulg ? { ankle: P(52, G - 34), toe: P(44, G - 31) } : onToes(64);
    if (bulg) props.push(...prop.chair(28, 30));
    const x0 = bulg ? 92 : 95;
    const y0 = topHip(x0, [front.ankle, back.ankle]);
    const y1 = lowestHip(x0 - 3, y0, back.ankle, P(0.2, 1));
    const hip = P(lerp(x0, x0 - 3, s), lerp(y0, y1, s));
    const shoulder = polar(hip, bulg ? 84 : 88, L.torso);
    const hand = polar(shoulder, p.dumbbells ? 268 : 264, ARM * 0.97);
    if (p.dumbbells) props.push(prop.dumbbell(hand));
    const j = body({
      hip, shoulder, handN: hand, ankleN: front.ankle, ankleF: back.ankle, toeN: front.toe, toeF: back.toe,
      elbow: P(-1, 0), knee: P(1, -0.2), kneeF: P(0.2, 1), neck: 90,
    });
    return { j, props, focus: ['legs'] };
  }
  if (v === 'pistol') {
    const stand = flatFoot(100);
    const hip0 = P(99, topHip(99, [stand.ankle]));
    const hip = lerpP(hip0, P(84, G - 23), s);
    const shoulder = polar(hip, lerp(88, 62, s), L.torso);
    const free = polar(hip, lerp(-38, -4, s), LEG - 0.6);
    let hand = polar(shoulder, lerpA(300, 0, s), ARM * 0.96);
    if (p.assisted) {
      props.push(prop.pole(130));
      hand = P(127, G - 64);
    }
    const j = body({
      hip, shoulder, handN: hand, ankleN: stand.ankle, toeN: stand.toe, ankleF: free, toeF: lerp(40, 80, s),
      kneeF: P(0, -1), neck: angleOf(hip, shoulder) + 4,
    });
    return { j, props, focus: ['legs'] };
  }
  if (v === 'shrimp') {
    // Jambe arrière repliée, genou qui descend vers le sol ; bras devant
    const stand = flatFoot(100);
    const hip0 = P(99, topHip(99, [stand.ankle]) + 1);
    const backAnkle = (h) => add(h, P(-16, 14));
    let y1 = hip0.y;
    for (let y = hip0.y; y < G - 20; y += 0.25) {
      const h = P(90, y);
      if (bend(h, backAnkle(h), L.thigh, L.shin, P(0, 1)).y > G - 7) break;
      y1 = y;
    }
    const hip = lerpP(hip0, P(90, y1), s);
    const shoulder = polar(hip, lerp(86, 60, s), L.torso);
    const ankleF = backAnkle(hip);
    const hand = polar(shoulder, lerpA(290, 0, s), ARM * 0.96);
    const j = body({
      hip, shoulder, handN: hand, ankleN: stand.ankle, toeN: stand.toe, ankleF, toeF: 200,
      kneeF: P(0, 1), neck: angleOf(hip, shoulder) + 4,
    });
    return { j, props, focus: ['legs'] };
  }
  if (v === 'calf') {
    const base = p.step ? 10 : 0;
    const toe = P(108.3, G - 1.5 - base);
    const ankle = polar(toe, lerp(p.step ? 198 : 163, 128, s), L.foot);
    const hip = P(ankle.x - 1, ankle.y - (LEG - 0.6));
    const shoulder = polar(hip, 90, L.torso);
    if (p.step) props.push(prop.box(toe.x - 5, 26, base));
    const j = body({ hip, shoulder, handN: polar(shoulder, 266, ARM * 0.98), ankleN: ankle, toeN: toe, elbow: P(-1, 0), neck: 90 });
    return { j, props, focus: ['legs'] };
  }
  if (v === 'wallsit') {
    const foot = flatFoot(108);
    const knee = P(foot.ankle.x, foot.ankle.y - L.shin);
    const hip = P(knee.x - L.thigh, knee.y);
    const shoulder = polar(hip, 90, L.torso);
    props.push(prop.wall(hip.x - 15));
    const j = body({
      hip, shoulder, handN: add(hip, P(15, -3)), ankleN: foot.ankle, toeN: foot.toe, kneeNAt: knee, kneeFAt: knee, neck: 90,
    });
    return { j, props, focus: ['legs'] };
  }
  if (v === 'sissy') {
    // Talons levés, genoux qui avancent, corps droit des genoux à la tête
    const toe = P(110, G - 1.5);
    const ankle = polar(toe, lerp(150, 122, s), L.foot);
    const knee = polar(ankle, lerp(93, 32, s), L.shin);
    const hip = polar(knee, lerp(91, 142, s), L.thigh);
    const shoulder = polar(hip, lerp(91, 136, s), L.torso);
    const j = body({
      hip, shoulder, handN: polar(shoulder, lerp(270, 330, s), ARM * 0.96), ankleN: ankle, toeN: toe,
      kneeNAt: knee, kneeFAt: knee, neck: angleOf(hip, shoulder),
    });
    return { j, props, focus: ['legs'] };
  }
  if (v === 'cossack') return frontal(t, { pose: 'cossack' });
  if (v === 'stepup') {
    props.push(prop.box(110, 36, 26));
    const lead = flatFoot(116, G - 26);
    const trail0 = flatFoot(80);
    const hipEnd = P(lead.ankle.x - 1, lead.ankle.y - (LEG - 0.8));
    const hipStart = P(96, topHip(96, [lead.ankle, trail0.ankle]));
    const hip = lerpP(hipStart, hipEnd, s);
    const trailAnkle = add(lerpP(trail0.ankle, P(hipEnd.x - 8, lead.ankle.y - 12), s), P(0, -6 * Math.sin(Math.PI * s)));
    const shoulder = polar(hip, 86, L.torso);
    const j = body({
      hip, shoulder, handN: polar(shoulder, 266, ARM * 0.97), ankleN: lead.ankle, toeN: lead.toe,
      ankleF: trailAnkle, toeF: lerp(17, -30, s), elbow: P(-1, 0), knee: P(1, 0), kneeF: P(1, 0), neck: 90,
    });
    return { j, props, focus: ['legs'] };
  }
  // Squat classique (chaise optionnelle derrière soi)
  const foot = flatFoot(100);
  const hip0 = P(99, topHip(99, [foot.ankle]));
  const hip1 = p.chair ? P(72, G - 38) : P(76, G - 27);
  const hip = lerpP(hip0, hip1, s);
  const shoulder = polar(hip, lerp(90, p.chair ? 62 : 56, s), L.torso);
  if (p.chair) props.push(...prop.chair(44, 33));
  const j = body({
    hip, shoulder, handN: polar(shoulder, lerpA(268, 0, smooth(Math.min(1, t * 1.3))), ARM * 0.97),
    ankleN: foot.ankle, toeN: foot.toe, neck: angleOf(hip, shoulder) + 6,
  });
  return { j, props, focus: ['legs'] };
}

// Nordic curl : corps qui bascule depuis les genoux, chevilles bloquées
export function nordic(t, p = {}) {
  const s = smooth(t);
  const knee = P(78, G - 5);
  const ankle = P(knee.x - L.shin * 0.98, G - 6);
  const a = lerp(88, p.full ? 22 : 40, s);
  const hip = polar(knee, a, L.thigh);
  const shoulder = polar(hip, a, L.torso);
  const hand = polar(shoulder, a - 72, ARM * 0.72);
  const j = body({
    hip, shoulder, handN: hand, ankleN: ankle, kneeNAt: knee, kneeFAt: knee, toeN: P(ankle.x - 8, G - 2.5), elbow: P(0, 1), neck: a,
  });
  return { j, props: [prop.mat(34, 168), prop.anchor(P(ankle.x - 2, ankle.y - 6))], focus: ['legs'] };
}

// Allongé sur le dos : pont fessier, hip thrust, leg curl glissé
export function bridge(t, p = {}) {
  const s = smooth(t);
  const props = [prop.mat(16, 172)];
  if (p.thrust) {
    props.push(...prop.chair(28, 32));
    const shoulder = P(56, G - 38);
    const hip = polar(shoulder, lerp(-50, -2, s), L.torso);
    const foot = flatFoot(118);
    const free = p.single ? polar(hip, lerp(12, 2, s), LEG - 0.6) : null;
    const j = body({
      hip, shoulder, handN: P(36, G - 33), ankleN: foot.ankle, toeN: foot.toe,
      ankleF: free || foot.ankle, toeF: free ? 30 : foot.toe, elbow: P(0, -1), knee: P(0, -1), neck: 178,
    });
    return { j, props, focus: ['legs'] };
  }
  const shoulder = P(56, LIE);
  let foot = flatFoot(110);
  let lift = lerp(4, 34, s);
  let toe = foot.toe;
  if (p.slider) {
    // Talons sur une serviette : le bassin reste haut, les talons glissent
    lift = 30;
    foot = { ankle: P(lerp(132, 106, s), G - 4.5) };
    toe = polar(foot.ankle, 70, L.foot);
    props.push(prop.towel(foot.ankle.x - 7));
  }
  const hip = polar(shoulder, lift, L.torso);
  const free = p.single ? polar(hip, angleOf(shoulder, hip) + 2, LEG - 0.6) : null;
  const j = body({
    hip, shoulder, handN: P(shoulder.x + ARM * 0.97, G - 3.5), ankleN: foot.ankle, toeN: toe,
    ankleF: free || foot.ankle, toeF: free ? angleOf(shoulder, hip) + 60 : toe, elbow: P(0, -1), knee: P(0, -1), neck: 180,
  });
  return { j, props, focus: ['legs'] };
}

// Charnière de hanche : good morning (mains derrière la tête), soulevé de
// terre sur une jambe (jambe libre dans le prolongement du dos)
export function hinge(t, p = {}) {
  const s = smooth(t);
  const foot = flatFoot(100);
  const single = !!p.single;
  const hip = P(lerp(99, single ? 97 : 91, s), topHip(99, [foot.ankle]) + lerp(0, single ? 2 : 3, s));
  const a = lerp(90, single ? 8 : 24, s);
  const shoulder = polar(hip, a, L.torso);
  let hand; let elbow; let ankleF; let toeF;
  if (single) {
    hand = polar(shoulder, 268, ARM * 0.97);
    elbow = P(1, 0);
    ankleF = polar(hip, lerpA(268, a + 180, s), LEG - 0.6);
    toeF = lerpA(0, a + 270, s);
  } else {
    hand = add(polar(shoulder, a, L.neck + L.head), mul(dir(a + 90), 3));
    elbow = dir(a - 90);
  }
  const j = body({
    hip, shoulder, handN: hand, ankleN: foot.ankle, toeN: foot.toe, ankleF: ankleF || foot.ankle, toeF: toeF ?? foot.toe,
    elbow, knee: P(1, 0), kneeF: single ? P(0, 1) : P(1, 0), neck: a - 6,
  });
  const props = single && p.dumbbell ? [prop.dumbbell(hand)] : [];
  return { j, props, focus: ['legs', 'back'] };
}
