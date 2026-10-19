// ─── Gainage et tronc ─────────────────────────────────────────────────────────
// Allongé (dos, ventre), planches, quatre pattes, L-sit, roulette, dragon flag,
// relevés en suspension.

import {
  G, L, ARM, LEG, LIE, P, add, dist, deg, polar, angleOf, lerp, lerpP, clamp, smooth, lerpA,
  bend, circles, onLevel, flatFoot, body, prop,
} from './figureKit';
import { frontal } from './figureFrontal';

// Allongé sur le ventre : superman (de profil), Y-T-W (vu d'en haut)
export function prone(t, p = {}) {
  if (p.arms === 'ytw') return frontal(t, { pose: 'proneYTW' });
  const s = smooth(t);
  const hip = P(100, LIE);
  const shoulder = polar(hip, 180 - lerp(0, 10, s), L.torso);
  const ankle = polar(hip, lerp(0, 8, s), LEG - 0.6);
  const hand = polar(shoulder, 180 - lerp(3, 18, s), ARM * 0.98);
  const j = body({ hip, shoulder, handN: hand, ankleN: ankle, toeN: lerp(-10, -2, s), elbow: P(0, -1), knee: P(0, -1), neck: 180 - lerp(4, 16, s) });
  return { j, props: [prop.mat(24, 178)], focus: ['back'] };
}

// Gainages (planches) statiques ou dynamiques
export function plank(t, p = {}) {
  const form = p.form || 'hands';
  const s = smooth(t);
  const props = [prop.mat(24, 176)];
  const breath = 0.4 * Math.sin(Math.PI * t);
  if (form === 'elbows' || form === 'knees' || form === 'saw') {
    const elbow = P(130, G - 4);
    const shoulder = form === 'saw' ? polar(elbow, lerp(72, 112, s), L.upperArm) : P(elbow.x, elbow.y - L.upperArm - breath);
    const hand = P(elbow.x + L.forearm, G - 3.5);
    let hip; let ankle; let toe; let kneeAt;
    if (form === 'knees') {
      kneeAt = onLevel(shoulder, L.thigh + L.torso, G - 5, -1);
      hip = lerpP(kneeAt, shoulder, L.thigh / (L.thigh + L.torso));
      ankle = P(kneeAt.x - L.shin * 0.97, G - 6);
      toe = P(ankle.x - 7.6, G - 2.5);
    } else {
      ankle = onLevel(shoulder, LEG + L.torso, G - 6, -1);
      toe = P(ankle.x + 6, G - 1);
      hip = lerpP(ankle, shoulder, LEG / (LEG + L.torso));
      if (form === 'saw') props.push(prop.towel(ankle.x - 4, 16));
    }
    const j = body({
      hip, shoulder, handN: hand, ankleN: ankle, toeN: toe, kneeNAt: kneeAt, kneeFAt: kneeAt,
      elbowNAt: elbow, elbowFAt: elbow, knee: P(0, 1), neck: angleOf(hip, shoulder) - 6,
    });
    return { j, props, focus: ['torso'] };
  }
  const hand = P(130, G - 1.5);
  let shoulder = P(hand.x, hand.y - ARM * 0.985 + breath);
  let handN = hand;
  if (p.updown) {
    // Passage bras tendus ↔ avant-bras (les deux bras, vus de profil)
    shoulder = P(hand.x, lerp(hand.y - ARM * 0.985, G - 4 - L.upperArm, s));
    handN = lerpP(hand, P(hand.x + L.forearm, G - 3.5), s);
  }
  const pivot = onLevel(shoulder, LEG + L.torso, G - 6, -1);
  let hip = lerpP(pivot, shoulder, LEG / (LEG + L.torso));
  let ankleN = pivot; let toeN = P(pivot.x + 6, G - 1); let kneeNAt; let pivotF = pivot;
  if (p.climb) {
    // Genou ramené sous la poitrine : le bassin monte un peu, la cuisse
    // passe sous le corps, le pied reste décollé du sol
    const axis = angleOf(shoulder, hip);
    hip = polar(shoulder, axis - 15 * Math.sin(Math.PI * Math.min(1, s * 0.75)), L.torso);
    const back = (angleOf(hip, pivot) + 360) % 360;
    kneeNAt = polar(hip, lerp(back, 318, s), L.thigh);
    const shinA = lerp(back, 165, Math.min(1, s * 2.6));
    ankleN = polar(kneeNAt, shinA, L.shin);
    toeN = lerp(back + 123, 290, smooth(clamp((s - 0.1) / 0.6, 0, 1)));
    // Pied d'appui : avance un peu sur la pointe quand le bassin monte
    pivotF = onLevel(hip, LEG - 0.4, G - 6, -1);
  }
  // Omoplates qui se rapprochent : le haut du dos descend entre les bras tendus
  const chest = p.scap ? add(shoulder, P(0, lerp(0, 3.5, s))) : undefined;
  const j = body({
    hip, shoulder, chest, handN, ankleN, ankleF: pivotF, toeN, toeF: P(pivotF.x + 6, G - 1), kneeNAt,
    kneeF: P(0, 1), neck: angleOf(hip, shoulder) - 6,
  });
  if (p.taps) {
    const touch = add(shoulder, P(3, 3));
    j.handN = lerpP(hand, touch, s);
    j.elbowN = bend(shoulder, j.handN, L.upperArm, L.forearm, 'cw');
  }
  return { j, props, focus: ['torso'] };
}

// Gainage latéral, vu de face : corps en diagonale sur un avant-bras
export function sidePlank(t, p = {}) {
  const s = smooth(t);
  const elbow = P(134, G - 4);
  const shoulder = P(elbow.x, elbow.y - L.upperArm);
  let hip; let ankle; let toe; let kneeAt;
  if (p.knees) {
    kneeAt = onLevel(shoulder, L.thigh + L.torso, G - 5, -1);
    hip = lerpP(kneeAt, shoulder, L.thigh / (L.thigh + L.torso));
    ankle = P(kneeAt.x - L.shin * 0.97, G - 6);
    toe = 180;
  } else {
    ankle = onLevel(shoulder, LEG + L.torso, G - 5, -1);
    toe = P(ankle.x - 3, G - 1);
    hip = lerpP(ankle, shoulder, LEG / (LEG + L.torso));
  }
  const axis = angleOf(hip, shoulder);
  // Jambe du dessus écartée vers le haut
  const ankleF = p.legLift ? polar(hip, axis + 180 - lerp(3, 30, s), LEG - 0.6) : ankle;
  const j = body({
    hip, shoulder, handN: P(elbow.x + 10, G - 3.5), elbowNAt: elbow,
    handF: polar(shoulder, 90, ARM * 0.98), elbowF: P(1, 0),
    ankleN: ankle, ankleF, toeN: toe, toeF: p.legLift ? axis + 180 : undefined, kneeNAt: kneeAt, kneeFAt: kneeAt,
    knee: P(0, 1), neck: axis,
  });
  return { j, props: [prop.mat(24, 176)], focus: ['torso'], loose: ['avant-bras', 'pied', 'pied loin'] };
}

// À quatre pattes : bird dog, chat-vache, fil de l'aiguille, enfant, poignets
export function quadruped(t, p = {}) {
  const move = p.move;
  const s = smooth(t);
  const hand = P(128, G - 1.5);
  const shoulder0 = P(hand.x, hand.y - ARM * 0.98);
  const knee = P(96, G - 5);
  const hip0 = P(knee.x, knee.y - L.thigh);
  const ankle = P(knee.x - L.shin * 0.97, G - 6);
  const toe = P(ankle.x - 7.6, G - 2.5);
  // Tronc : de la hanche vers l'épaule, longueur fixe
  const shoulderFor = (hip) => circles(hip, L.torso, hand, ARM * 0.98, 'up');
  const shoulder = shoulderFor(hip0);
  const axis0 = angleOf(hip0, shoulder);
  const base = {
    hip: hip0, shoulder, handN: hand, ankleN: ankle, toeN: toe, kneeNAt: knee, kneeFAt: knee,
    neck: axis0 - 12,
  };
  const props = [prop.mat(24, 176)];
  if (move === 'catcow') {
    // Dos rond tête basse, puis dos creux regard devant
    return { j: body({ ...base, curve: lerp(-7, 6, s), neck: lerp(-60, 30, s) }), props, focus: ['back'] };
  }
  if (move === 'birddog') {
    // Bras opposé à la jambe : bras éloigné devant, jambe proche derrière
    const handF = polar(shoulder, lerpA(268, 2, s), ARM * 0.98);
    const ext = polar(hip0, 180, LEG - 0.6);
    const ankleN = add(lerpP(ankle, ext, s), P(0, -4 * Math.sin(Math.PI * s)));
    const j = body({
      ...base, handF, handN: hand, ankleN, ankleF: ankle, kneeNAt: undefined, elbow: 'cw', toeN: lerp(180, 200, s), toeF: toe,
    });
    j.kneeF = knee;
    return { j, props, focus: ['torso', 'back'] };
  }
  if (move === 'thread') {
    // Le bras passe sous le corps, puis s'ouvre vers le plafond
    const a = t < 0.5 ? lerp(268, 205, smooth(t * 2)) : lerp(205, 92, smooth((t - 0.5) * 2));
    const len = ARM * (t < 0.5 ? lerp(0.98, 0.72, smooth(t * 2)) : lerp(0.72, 0.98, smooth((t - 0.5) * 2)));
    const j = body({ ...base, handN: polar(shoulder, a, len), handF: hand, elbow: 'cw' });
    return { j, props, focus: ['back'] };
  }
  if (move === 'child') {
    // Fesses vers les talons, bras allongés devant, front au sol
    const hip = polar(knee, lerp(90, 150, s), L.thigh);
    const axisEnd = -10;
    const shoulder1 = polar(polar(knee, 150, L.thigh), axisEnd, L.torso);
    const sh = polar(hip, lerpA(axis0, axisEnd, s), L.torso);
    const handEnd = P(shoulder1.x + ARM * 0.995, G - 3);
    // Les mains glissent au sol vers l'avant, bras jamais plus longs que nature
    let handN = lerpP(hand, handEnd, s);
    const dy = handN.y - sh.y;
    if (dist(sh, handN) > ARM * 0.99) handN = P(sh.x + Math.sqrt(Math.max(0, (ARM * 0.99) ** 2 - dy * dy)), handN.y);
    const neckEnd = -deg(Math.asin(clamp((G - 8.5 - shoulder1.y) / (L.neck + L.head), -1, 1)));
    const j = body({ ...base, hip, shoulder: sh, handN, elbow: 'ccw', neck: lerpA(axis0 - 12, neckEnd, s) });
    return { j, props, focus: ['back'] };
  }
  if (move === 'rock') {
    // Poignets : bascule avant / arrière au-dessus des mains posées
    const sh = polar(hand, lerp(104, 76, s), ARM * 0.97);
    const hip = circles(knee, L.thigh, sh, L.torso, 'up');
    return { j: body({ ...base, hip, shoulder: sh, neck: angleOf(hip, sh) - 12 }), props, focus: ['arms'] };
  }
  return { j: body(base), props, focus: ['back'] };
}

// Allongé sur le dos : hollow, dead bug, relevés de jambes, crunch inversé, V-up
export function supine(t, p = {}) {
  const move = p.move || 'hollow';
  const s = smooth(t);
  const hip0 = P(100, LIE);
  const props = [prop.mat(24, 176)];
  if (move === 'deadbug') {
    // Position de table : bras vers le plafond, cuisses verticales, tibias à l'horizontale.
    // Le bras proche et la jambe opposée s'allongent.
    const shoulder = polar(hip0, 180, L.torso);
    const handF = polar(shoulder, 90, ARM * 0.98);
    const handN = polar(shoulder, lerp(90, 170, s), ARM * 0.98);
    const kneeN = polar(hip0, 90, L.thigh);
    const ankleN = polar(kneeN, 0, L.shin);
    const kneeF = polar(hip0, lerp(90, 12, s), L.thigh);
    const ankleF = polar(kneeF, lerp(0, 12, s), L.shin);
    const j = body({
      hip: hip0, shoulder, handN, handF, ankleN, ankleF, kneeNAt: kneeN, kneeFAt: kneeF,
      toeN: 80, toeF: lerp(80, 30, s), neck: 180,
    });
    return { j, props, focus: ['torso'] };
  }
  let shA = 180; let armA = 178; let thighA = 6; let shinA = null; let lift = 0;
  if (move === 'hollow') { shA = 166; armA = 166; thighA = 14; }
  if (move === 'hollowTuck') { shA = 166; armA = 12; thighA = 64; shinA = 2; }
  if (move === 'rock') { const r = lerp(-8, 8, s); shA = 165 + r; armA = 165 + r; thighA = 15 + r; }
  if (move === 'legraise') { thighA = lerp(5, 88, s); }
  if (move === 'reverse') { thighA = lerp(90, 128, s); shinA = thighA - 90; lift = lerp(0, 6, s); }
  if (move === 'vup') { shA = lerp(178, 124, s); armA = lerp(178, 50, s); thighA = lerp(5, 64, s); }
  const hip = P(hip0.x, hip0.y - lift);
  const shoulder = polar(hip, shA, L.torso);
  const hand = polar(shoulder, armA, ARM * 0.98);
  let kneeAt; let ankle;
  if (shinA != null) {
    kneeAt = polar(hip, thighA, L.thigh);
    ankle = polar(kneeAt, shinA, L.shin);
  } else ankle = polar(hip, thighA, LEG - 0.6);
  const j = body({
    hip, shoulder, handN: hand, ankleN: ankle, kneeNAt: kneeAt, kneeFAt: kneeAt,
    toeN: (shinA ?? thighA) + 10, neck: shA + 4,
  });
  return { j, props, focus: ['torso'] };
}

// Assis en appui sur les mains : L-sit, V-sit, préparation entre deux chaises
export function lsit(t, p = {}) {
  const support = p.support || 'floor';
  const form = p.form || 'l';
  const s = smooth(t);
  const handY = support === 'parallettes' ? G - 10.5 : support === 'chairs' ? G - 33 : G - 1.5;
  const hand = P(98, handY);
  const shoulder = P(hand.x, hand.y - ARM * 0.99);
  const hip = P(97, shoulder.y + L.torso);
  const props = [];
  if (support === 'parallettes') props.push(...prop.parallettes(87));
  if (support === 'chairs') props.push(...prop.chair(84, 33));
  if (support === 'floor') props.push(prop.mat(46, 166));
  // Départ : talons posés au sol
  const restA = -deg(Math.asin(clamp((G - 5 - hip.y) / (LEG - 0.6), 0, 1)));
  const tuck = () => { const k = polar(hip, 40, L.thigh); return [k, polar(k, 205, L.shin)]; };
  let ankleN; let ankleF; let kneeNAt; let kneeFAt; let toeN = 6; let toeF;
  if (form === 'tuck') {
    const [k, a] = tuck(); kneeNAt = k; ankleN = a; kneeFAt = k; ankleF = a; toeN = 300;
  } else if (form === 'one') {
    ankleN = polar(hip, lerp(restA, 0, s), LEG - 0.6);
    [kneeFAt, ankleF] = tuck(); toeF = 300;
  } else if (form === 'v') {
    ankleN = polar(hip, lerp(restA, 40, s), LEG - 0.6); toeN = lerp(restA, 40, s);
  } else if (form === 'prep') {
    const f = flatFoot(hip.x + 42); ankleN = f.ankle; toeN = f.toe;
  } else {
    ankleN = polar(hip, lerp(restA, 1, s), LEG - 0.6); toeN = lerp(restA, 1, s) + 4;
  }
  const j = body({
    hip, shoulder, handN: hand, ankleN, ankleF: ankleF || ankleN, kneeNAt, kneeFAt,
    elbow: P(-1, 0), knee: P(0, -1), toeN, toeF, neck: 90,
  });
  return { j, props, focus: ['torso', 'arms'] };
}

// Roulette abdominale (à genoux)
export function rollout(t) {
  const knee = P(78, G - 5);
  const ankle = P(knee.x - L.shin * 0.97, G - 6);
  const wheel = P(lerp(112, 150, smooth(t)), G - 5);
  const shoulder = circles(knee, L.thigh + L.torso, wheel, ARM * 0.98, 'up');
  const hip = lerpP(knee, shoulder, L.thigh / (L.thigh + L.torso));
  const j = body({
    hip, shoulder, handN: wheel, ankleN: ankle, kneeNAt: knee, kneeFAt: knee, toeN: P(ankle.x - 7.6, G - 2.5),
    neck: angleOf(hip, shoulder) - 10,
  });
  return { j, props: [prop.mat(34, 168), { k: 'circle', cx: wheel.x, cy: wheel.y, r: 4.8, c: 'prop' }], focus: ['torso'] };
}

// Dragon flag : allongé sur un banc, corps gainé soulevé depuis les épaules
export function dragon(t) {
  const shoulder = P(64, G - 34);
  const a = lerp(70, 14, smooth(t));
  const hip = polar(shoulder, a, L.torso);
  const ankle = polar(hip, a, LEG - 0.6);
  const j = body({
    hip, shoulder, handN: P(34, G - 27.5), ankleN: ankle, toeN: a, elbow: P(0, -1), neck: 182,
  });
  return { j, props: [prop.box(24, 64, 26)], focus: ['torso'] };
}

// Relevés en suspension : genoux, jambes tendues, pieds à la barre
export function hangingRaise(t, p = {}) {
  const form = p.form || 'knees';
  const s = smooth(t);
  const bar = P(110, 14);
  const shoulder = P(bar.x - 2, bar.y + Math.sqrt((ARM * 0.98) ** 2 - 4));
  let hipA = 266;
  let kneeAt; let ankle;
  if (form === 'toes') {
    // Le bassin passe devant, les pieds montent jusqu'à la barre
    hipA = lerpA(266, 322, s);
  } else if (form === 'legs') hipA = lerpA(266, 276, s);
  const hip = polar(shoulder, hipA, L.torso);
  if (form === 'knees') {
    kneeAt = polar(hip, lerpA(274, 28, s), L.thigh);
    ankle = polar(kneeAt, lerpA(266, 272, s), L.shin);
  } else if (form === 'toes') ankle = polar(hip, lerpA(268, 104, s), LEG - 0.6);
  else ankle = polar(hip, lerpA(268, 4, s), LEG - 0.6);
  const j = body({
    hip, shoulder, handN: bar, ankleN: ankle, kneeNAt: kneeAt, kneeFAt: kneeAt,
    toeN: angleOf(kneeAt || hip, ankle), neck: 94,
  });
  return { j, props: prop.bar(bar.x, bar.y), focus: ['torso'], hang: true };
}
