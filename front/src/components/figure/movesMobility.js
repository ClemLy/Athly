// ─── Debout et mobilité ───────────────────────────────────────────────────────
// Échauffements debout, élastiques, étirements au sol.

import {
  G, L, ARM, LEG, LIE, P, add, mul, norm, polar, angleOf, lerp, lerpP, smooth, lerpA, bend,
  circles, reachAlong, topHip, flatFoot, body, prop,
} from './figureKit';
import { frontal } from './figureFrontal';

// Debout : marche sur place, menton, balancés, élastiques, étirements…
export function standing(t, p = {}) {
  const move = p.move || 'march';
  if (move === 'armcircles') return frontal(t, { pose: 'armCircles' });
  if (move === 'shouldercircles') return frontal(t, { pose: 'shrug' });
  if (move === 'wallslide') return frontal(t, { pose: 'wallYW' });
  if (move === 'hipcircles') return frontal(t, { pose: 'hipCircles' });
  const s = smooth(t);
  const foot = flatFoot(100);
  let hip = P(99, topHip(99, [foot.ankle]));
  let shoulder = polar(hip, 90, L.torso);
  let handN = polar(shoulder, 266, ARM * 0.97);
  let handF;
  let ankleN = foot.ankle; let ankleF = foot.ankle; let toeN = foot.toe; let toeF = foot.toe;
  let kneeNAt; let elbow = 'cw'; let elbowF; let kneeF;
  let neck = 90; let head;
  const props = [];
  if (move === 'march') {
    kneeNAt = polar(hip, lerpA(270, 342, s), L.thigh);
    ankleN = polar(kneeNAt, lerpA(270, 262, s), L.shin);
    toeN = lerp(0, -12, s);
    handN = polar(shoulder, lerp(266, 238, s), ARM * 0.92);
    handF = polar(shoulder, lerp(266, 300, s), ARM * 0.92);
  }
  if (move === 'chintuck') head = add(polar(shoulder, 90, L.neck + L.head), P(lerp(1.5, -3.5, s), lerp(0, 0.6, s)));
  if (move === 'legswing') {
    // Main éloignée posée sur un appui à côté de soi, jambe proche qui balance
    props.push(prop.pole(shoulder.x + 24));
    handF = P(shoulder.x + 22, shoulder.y + 10);
    ankleN = polar(hip, lerp(244, 314, s), LEG - 0.8);
    toeN = angleOf(hip, ankleN) + 90;
  }
  if (['pallof', 'facepull', 'pulldown', 'bandrow'].includes(move)) {
    const anchor = { pallof: P(52, G - 70), facepull: P(178, G - 92), pulldown: P(118, 6), bandrow: P(178, G - 64) }[move];
    props.push(prop.anchor(anchor));
    if (move === 'pallof') handN = polar(shoulder, lerp(300, 352, s), lerp(16, ARM * 0.97, s));
    if (move === 'facepull') { handN = polar(shoulder, lerp(20, 48, s), lerp(ARM * 0.97, 16, s)); elbow = P(-1, -0.4); }
    if (move === 'pulldown') handN = polar(shoulder, lerp(82, 112, s), lerp(ARM * 0.97, 16, s));
    if (move === 'bandrow') handN = polar(shoulder, lerp(338, 296, s), lerp(ARM * 0.97, 15, s));
    props.push(prop.band(anchor, handN));
  }
  if (move === 'press') {
    handN = lerpP(add(shoulder, P(9, -14)), polar(shoulder, 92, ARM * 0.97), s);
    props.push(prop.dumbbell(handN));
  }
  if (move === 'carry') {
    // Marche : un pas, puis l'autre
    const k = lerp(-1, 1, s);
    ankleN = polar(hip, 270 + 13 * k, LEG - 1.4);
    ankleF = polar(hip, 270 - 13 * k, LEG - 1.4);
    toeN = 4 * k; toeF = -4 * k;
    handN = polar(shoulder, 268, ARM * 0.97);
    props.push(prop.dumbbell(handN));
  }
  if (move === 'calfstretch') {
    props.push(prop.wall(150));
    const front = flatFoot(124); const back = flatFoot(76);
    ankleN = front.ankle; toeN = front.toe; ankleF = back.ankle; toeF = back.toe;
    hip = circles(back.ankle, LEG - 0.6, front.ankle, LEG - 7, 'up');
    shoulder = polar(hip, 64, L.torso);
    handN = P(149, shoulder.y + 4);
  }
  if (move === 'hamstring') {
    // Jambe avant tendue talon au sol, buste penché, mains qui glissent le long de la jambe
    const front = { ankle: P(128, G - 4) };
    const back = flatFoot(98);
    ankleN = front.ankle; toeN = 74; ankleF = back.ankle; toeF = back.toe;
    hip = circles(front.ankle, LEG - 0.6, back.ankle, LEG - 6, 'up');
    shoulder = polar(hip, lerp(84, 30, s), L.torso);
    handN = reachAlong(shoulder, hip, front.ankle, ARM * 0.96);
    handN = lerpP(add(hip, P(8, -4)), handN, s);
  }
  if (move === 'pecstretch') {
    props.push(prop.wall(127));
    shoulder = polar(hip, lerp(90, 84, s), L.torso);
    handN = P(126, shoulder.y - 8);
  }
  if (move === 'dislocate') {
    handN = polar(shoulder, lerp(-12, 192, s), ARM * 0.98);
    props.push(prop.stick(handN));
  }
  if (move === 'jumprope') {
    const up = 3 * Math.abs(Math.sin(2 * Math.PI * t));
    hip = P(hip.x, hip.y - up);
    shoulder = polar(hip, 90, L.torso);
    ankleN = P(foot.ankle.x, foot.ankle.y - up - 1.5); ankleF = ankleN;
    toeN = P(foot.ankle.x + 6.5, G - 1 - up); toeF = toeN;
    handN = polar(shoulder, 290, ARM * 0.82);
  }
  const j = body({
    hip, shoulder, handN, handF, ankleN, ankleF, toeN, toeF, kneeNAt, elbow, elbowF, kneeF, neck, head,
  });
    return { j, props, focus: p.focus || ['torso'] };
}

// Fente avec un genou au sol : fléchisseurs de hanche, « plus bel étirement »
export function lungeStretch(t, p = {}) {
  const s = smooth(t);
  const backKnee = P(70, G - 5);
  const backAnkle = P(backKnee.x - L.shin * 0.97, G - 6);
  const front = flatFoot(112);
  const hip = polar(backKnee, lerp(84, 64, s), L.thigh);
  const shoulder = polar(hip, p.rotate ? 80 : 88, L.torso);
  let handN = add(hip, P(9, -2));
  if (p.rotate) handN = polar(shoulder, lerpA(300, 94, s), ARM * 0.96);
  const j = body({
    hip, shoulder, handN, handF: add(hip, P(9, -2)), ankleN: front.ankle, toeN: front.toe, ankleF: backAnkle,
    toeF: P(backAnkle.x - 7.6, G - 2.5), kneeFAt: backKnee, neck: 88,
  });
  return { j, props: [prop.mat(30, 170)], focus: ['legs'] };
}

// Allongé sur le côté, vu d'en haut : livre ouvert (le bras du dessus passe
// de devant à derrière en tournant le haut du dos)
export function openBook(t) {
  const s = smooth(t);
  const hip = P(80, 66);
  const shoulder = P(hip.x + L.torso, 66);
  const handF = P(shoulder.x + 4, shoulder.y + ARM * 0.96);
  // Bras vu en raccourci quand il passe à la verticale
  const proj = Math.cos(Math.PI * s);
  const handN = P(shoulder.x + 2, shoulder.y + ARM * 0.96 * proj);
  const kneeAt = polar(hip, -42, L.thigh);
  const ankle = polar(kneeAt, 228, L.shin);
  const j = body({
    hip, shoulder, handN, handF, ankleN: ankle, kneeNAt: kneeAt, kneeFAt: kneeAt,
    elbowNAt: lerpP(shoulder, handN, 0.51), elbowFAt: lerpP(shoulder, handF, 0.51), toeN: 228, neck: lerp(-10, 20, s),
  });
  return {
    j, props: [{ k: 'rect', x: 34, y: 40, w: 136, h: 64, r: 8, c: 'mat' }], focus: ['back'], topView: true,
    loose: ['bras', 'avant-bras', 'bras loin', 'avant-bras loin', 'tibia', 'cuisse', 'cuisse loin', 'tibia loin'],
  };
}

// Allongé sur le dos : étirement des fessiers (cheville sur le genou opposé),
// ou rotations des genoux (vu d'en haut)
export function supineMobility(t, p = {}) {
  if (p.move !== 'figure4') return frontal(t, { pose: 'kneeRotation' });
  const s = smooth(t);
  const shoulder = P(56, LIE);
  const hip = polar(shoulder, 0, L.torso);
  // Jambe d'appui : pied posé, puis cuisse ramenée vers la poitrine
  const foot0 = flatFoot(hip.x + 36);
  const knee0 = bend(hip, foot0.ankle, L.thigh, L.shin, P(0, -1));
  const kneeN = polar(hip, lerpA(angleOf(hip, knee0), 106, s), L.thigh);
  const ankleN = polar(kneeN, lerpA(angleOf(knee0, foot0.ankle), 18, s), L.shin);
  // Cheville de l'autre jambe posée sur la cuisse, près du genou
  const ankleF = add(lerpP(hip, kneeN, 0.8), mul(norm(P(-(kneeN.y - hip.y), kneeN.x - hip.x)), -4));
  const handN = reachAlong(shoulder, kneeN, hip, ARM * 0.96);
  const j = body({
    hip, shoulder, handN, ankleN, ankleF, kneeNAt: kneeN,
    elbow: P(0, -1), toeN: lerp(angleOf(foot0.ankle, foot0.toe), 40, s), toeF: 60, neck: 180,
  });
  return { j, props: [prop.mat(16, 172)], focus: ['legs'], loose: ['cuisse loin', 'tibia loin'] };
}
