// ─── Mouvements du haut du corps ──────────────────────────────────────────────
// Pompes, poussée verticale et poirier, tirages, tractions, muscle-up, dips,
// leviers, planche, corbeau. Chaque générateur : (t, p) → { j, props, focus… }
// (voir figureEngine.js).

import {
  G, L, ARM, LEG, P, add, sub, mul, norm, rad, dir, polar, angleOf, lerp, lerpP, smooth, lerpA,
  bend, circles, onLevel, flatFoot, onToes, body, prop, spline, splineN,
} from './figureKit';
import { frontal } from './figureFrontal';

// Corps gainé en appui sur les mains, pivot aux pieds ou aux genoux : pompes
// (mur, table, chaise, genoux, sol, pieds surélevés, pseudo planche…). La
// mise en place se déduit de l'angle de départ des bras : épaule, puis pieds
// posés au sol à la bonne distance.
export function pushup(t, p = {}) {
  if (p.archer) return frontal(t, { pose: 'archerPushup' });
  const depth = p.depth ?? 0.58;
  const wall = p.support === 'wall';
  const knees = !!p.knees;
  const feetH = p.feetH ?? 0;
  const handH = wall ? 0 : (p.handH ?? 0);
  const hand = wall ? P(152, G - 70) : P(128, G - 1.5 - handH);
  const bodyLen = knees ? L.thigh + L.torso : LEG + L.torso;
  const pivotY = knees ? G - 4 : wall ? G - 4 : G - 6 - feetH;
  let armA = p.armA;
  if (armA == null) {
    if (wall) armA = 0; // inutilisé : voir pivot
    else if (handH > 12) {
      // Bras à peu près perpendiculaires au corps sur un appui surélevé
      let best = 110; let err = Infinity;
      for (let th = 5; th <= 80; th += 0.5) {
        const a = 90 + th * 0.75;
        const e = Math.abs(hand.y - ARM * 0.99 * Math.sin(rad(a)) + bodyLen * Math.sin(rad(th)) - pivotY);
        if (e < err) { err = e; best = a; }
      }
      armA = best;
    } else armA = 92;
  }
  const reach = ARM * lerp(0.99, 1 - depth, t);
  // Au mur : pieds placés pour que la poitrine arrive presque au mur en bas
  const pivot = wall
    ? onLevel(hand, bodyLen + ARM * (1 - depth) + 2, pivotY, -1)
    : onLevel(polar(hand, armA, ARM * 0.99), bodyLen, pivotY, -1);
  const shoulder = circles(pivot, bodyLen, hand, reach, 'up');
  const hip = lerpP(pivot, shoulder, (knees ? L.thigh : LEG) / bodyLen);
  let ankle; let toe; let kneeAt;
  if (knees) {
    kneeAt = pivot;
    ankle = P(pivot.x - L.shin * 0.97, G - 6);
    toe = P(ankle.x - 7.6, G - 2.5);
  } else if (wall) {
    ankle = pivot; toe = P(pivot.x + 8.3, G - 1.5);
  } else {
    ankle = pivot; toe = P(pivot.x + 6, G - feetH - 1);
  }
  const j = body({
    hip, shoulder, handN: hand, ankleN: ankle, toeN: toe, kneeNAt: kneeAt, kneeFAt: kneeAt,
    knee: P(0, 1), neck: angleOf(hip, shoulder) - 8,
  });
  if (p.oneArm) {
    // Main libre posée dans le bas du dos
    const spine = sub(shoulder, hip);
    j.handF = add(lerpP(hip, shoulder, 0.25), mul(norm(P(spine.y, -spine.x)), 6));
    j.elbowF = bend(shoulder, j.handF, L.upperArm, L.forearm, P(0, -1));
  }
  const props = [];
  if (wall) props.push(prop.wall(hand.x + 2));
  if (p.support === 'table') props.push(...prop.table(hand.x - 12, handH + 1.5));
  if (p.support === 'chair') props.push(...prop.chair(hand.x - 10, handH + 1.5));
  if (p.support === 'parallettes') props.push(...prop.parallettes(hand.x - 11));
  if (feetH) props.push(prop.box(pivot.x - 22, 34, feetH));
  return { j, props, focus: ['arms'] };
}

// Hanches hautes, tête vers le sol : pike push-up, pompes en équilibre.
// Le ventre est tourné vers les jambes (à gauche) ; la tête descend devant
// les mains, sommet du crâne en premier.
export function pike(t, p = {}) {
  const feetH = p.feetH ?? 0;
  const props = [];
  if (p.vertical) {
    const hand = P(100, G - 1.5);
    const reach = ARM * lerp(0.99, 0.58, t);
    const shoulder = P(hand.x + lerp(0, 5, t), hand.y - Math.sqrt(Math.max(1, reach ** 2 - lerp(0, 5, t) ** 2)));
    const hipX = hand.x + 1.5;
    const hip = P(hipX, shoulder.y - Math.sqrt(L.torso ** 2 - (hipX - shoulder.x) ** 2));
    const legA = p.wall ? 86 : 90;
    const ankle = polar(hip, legA, LEG - 0.5);
    const j = body({
      hip, shoulder, handN: hand, ankleN: ankle, toeN: legA + 4, neck: 270,
    });
    // Le mur touche les talons (position la plus haute du corps)
    if (p.wall) props.push(prop.wall(hip.x + Math.cos(rad(legA)) * LEG + 5));
    return { j, props, focus: ['arms'] };
  }
  const handH = p.handH ?? 0;
  const hand = P(126, G - 1.5 - handH);
  const reach = ARM * lerp(0.99, 0.6, t);
  // Mains sur une table : bras dans le prolongement du buste, presque à
  // l'horizontale, jambes verticales ; le front descend vers le bord de la table.
  const armA = handH ? 166 : 100;
  const shoulder = polar(hand, armA, reach);
  const feet = onToes(handH ? polar(hand, armA, ARM * 0.99).x - L.torso : feetH ? 54 : 70, G - feetH);
  const hip = circles(shoulder, L.torso, feet.ankle, LEG - 0.6, 'up');
  const j = body({
    hip, shoulder, handN: hand, ankleN: feet.ankle, toeN: feet.toe,
    neck: angleOf(hip, shoulder),
  });
  if (feetH) props.push(prop.box(feet.ankle.x - 20, 30, feetH));
  if (p.support === 'table') props.push(...prop.table(hand.x - 3, handH + 1.5));
  return { j, props, focus: ['arms'] };
}

// Équilibre sur les mains : poirier (dos au mur, face au mur, libre), groupé,
// montée. Monté en partant face à droite : une fois à l'envers, le dos est
// tourné vers la droite et le ventre vers la gauche.
export function handstand(t, p = {}) {
  const s = smooth(t);
  const hand = P(104, G - 1.5);
  const shoulder = P(hand.x, hand.y - ARM * 0.99);
  const backWall = p.wall && !p.wallFacing;
  const legA = backWall ? 85 : 90;
  let hip = polar(shoulder, 90, L.torso);
  let ankleN = polar(hip, legA, LEG - 0.5);
  let ankleF = ankleN;
  let kneeNAt; let kneeFAt; let toeN = legA + 2; let toeF;
  if (p.tuck) {
    // Genoux ramenés vers la poitrine, talons vers les fesses
    hip = polar(shoulder, 96, L.torso);
    kneeNAt = polar(hip, 235, L.thigh);
    ankleN = polar(kneeNAt, 95, L.shin);
    kneeFAt = kneeNAt; ankleF = ankleN; toeN = 95;
  }
  if (p.entry) {
    // Départ : un pied au sol en arrière, l'autre jambe déjà lancée
    const foot0 = onToes(52);
    const hip0 = circles(shoulder, L.torso, foot0.ankle, LEG - 0.6, 'up');
    const hipA = lerpA(angleOf(shoulder, hip0), 90, s);
    hip = polar(shoulder, hipA, L.torso);
    const legN0 = angleOf(hip0, foot0.ankle);
    ankleN = polar(hip, lerpA(legN0, legA, s), LEG - 0.6);
    ankleF = polar(hip, lerpA(legN0 - 80, legA, smooth(Math.min(1, t * 1.25))), LEG - 0.6);
    toeN = lerp(angleOf(foot0.ankle, foot0.toe), legA + 2, s);
    toeF = lerpA(legN0 - 80, legA + 2, s);
  }
  if (p.walk) {
    // Wall walk : départ en pompe, pieds contre le mur derrière soi ; les
    // pieds montent le long du mur pendant que les mains reculent vers lui,
    // jusqu'au poirier ventre face au mur.
    const wallX = 40;
    const sh = hand.y - ARM * 0.99;
    const len = LEG + L.torso;
    const ankleY = lerp(G - 6, sh - len + 0.5, s);
    const ankle = P(wallX + 7 + 9, ankleY);
    const handX = ankle.x + Math.sqrt(Math.max(0, len ** 2 - (sh - ankleY) ** 2));
    const handW = P(handX, hand.y);
    const shoulderW = P(handX, sh);
    const hipW = lerpP(ankle, shoulderW, LEG / len);
    const j = body({
      hip: hipW, shoulder: shoulderW, handN: handW, ankleN: ankle, toeN: lerp(200, 182, s), neck: angleOf(hipW, shoulderW),
    });
    return { j, props: [prop.wall(wallX)], focus: ['arms'] };
  }
  const j = body({
    hip, shoulder, handN: hand, ankleN, ankleF, kneeNAt, kneeFAt, toeN, toeF, neck: 270,
  });
  const props = [];
  if (backWall) props.push(prop.wall(hip.x + Math.cos(rad(legA)) * LEG + 5));
  if (p.wall && p.wallFacing) props.push(prop.wall(hand.x - 21));
  return { j, props, focus: ['arms'] };
}

// Tirage horizontal sous une barre, des anneaux ou une table
export function row(t, p = {}) {
  const barY = p.barY ?? G - 56;
  const hand = P(128, barY);
  const knees = !!p.knees;
  const feetH = p.feetH ?? 0;
  const s0 = polar(hand, 290, ARM * 0.99);
  const reach = ARM * lerp(0.99, 0.42, t);
  let shoulder; let hip; let ankle; let toe; let kneeAt;
  if (knees) {
    // Pieds à plat, tibias verticaux : le corps pivote autour des genoux
    const len = L.thigh + L.torso;
    kneeAt = onLevel(s0, len, G - 4 - L.shin, -1);
    shoulder = circles(kneeAt, len, hand, reach, 'down');
    hip = lerpP(kneeAt, shoulder, L.thigh / len);
    ({ ankle, toe } = flatFoot(kneeAt.x));
  } else {
    // Corps gainé, appui sur les talons
    const len = LEG + L.torso;
    const pivot = onLevel(s0, len, G - 4 - feetH, -1);
    shoulder = circles(pivot, len, hand, reach, 'down');
    hip = lerpP(pivot, shoulder, LEG / len);
    ankle = pivot;
    toe = polar(ankle, 72, L.foot);
  }
  const j = body({
    hip, shoulder, handN: hand, ankleN: ankle, toeN: toe, kneeNAt: kneeAt, kneeFAt: kneeAt,
    mirror: true, neck: angleOf(hip, shoulder) + 4,
  });
  const props = [];
  if (p.support === 'table') props.push(...prop.table(hand.x - 8, G - barY + 2, 56));
  else if (p.rings) props.push(...prop.rings(hand.x, hand.y));
  else props.push(...prop.bar(hand.x, hand.y));
  if (feetH) props.push(prop.box(ankle.x - 18, 32, feetH));
  return { j, props, focus: ['arms', 'back'] };
}

// Jambes en suspension (genoux fléchis par défaut, comme sous une barre de porte)
function hangLegs(hip, legs) {
  if (legs === 'straight') return { ankle: polar(hip, 266, LEG - 0.5) };
  if (legs === 'l') return { ankle: polar(hip, 0, LEG - 0.5), toe: 10 };
  if (legs === 'tuck') { const k = polar(hip, 20, L.thigh); return { ankle: polar(k, 262, L.shin), kneeAt: k, toe: 300 }; }
  const k = polar(hip, 284, L.thigh);
  return { ankle: polar(k, 238, L.shin), kneeAt: k, toe: 262 };
}

// Suspension et tractions : la barre passe devant le visage, le menton au-dessus
export function pull(t, p = {}) {
  const bar = P(110, 14);
  const k = (p.start ?? 0) + (p.amp ?? 1) * t;
  const reach = ARM * lerp(0.98, 0.32, k);
  const sx = bar.x - lerp(1, 10, k);
  const shoulder = P(sx, bar.y + Math.sqrt(Math.max(1, reach ** 2 - (bar.x - sx) ** 2)));
  const hip = polar(shoulder, 266, L.torso);
  const { ankle, kneeAt, toe = 268 } = hangLegs(hip, p.legs);
  const j = body({
    hip, shoulder, handN: bar, ankleN: ankle, kneeNAt: kneeAt, kneeFAt: kneeAt,
    toeN: toe, neck: 96,
  });
  if (p.oneArm) {
    j.handF = polar(shoulder, 264, ARM * 0.96);
    j.elbowF = bend(shoulder, j.handF, L.upperArm, L.forearm, P(1, 0));
  }
  const props = [...(p.rings ? prop.rings(bar.x, bar.y) : prop.bar(bar.x, bar.y))];
  if (p.band) props.push(prop.band(bar, kneeAt || ankle));
  return { j, props, focus: ['arms', 'back'], hang: true };
}

// Muscle-up : traction, passage de la poitrine au-dessus de la barre, appui
export function muscleUp(t, p = {}) {
  const bar = P(108, 50);
  // Les épaules contournent la barre (jamais à travers) : tirage, passage
  // de la poitrine devant la barre, puis au-dessus, et poussée bras tendus.
  const shoulder = spline([
    P(bar.x - 3, bar.y + ARM * 0.97),
    P(bar.x - 11, bar.y + ARM * 0.52),
    polar(bar, 215, 12.5),
    polar(bar, 160, 11.5),
    polar(bar, 112, 12),
    polar(bar, 82, 21),
    P(bar.x + 3, bar.y - ARM * 0.96),
  ], t);
  const hipA = splineN([264, 246, 236, 236, 246, 258, 268], t);
  const hip = polar(shoulder, hipA, L.torso);
  const kneeAt = polar(hip, hipA + 14, L.thigh);
  const ankle = polar(kneeAt, hipA - 16, L.shin);
  const j = body({ hip, shoulder, handN: bar, ankleN: ankle, kneeNAt: kneeAt, kneeFAt: kneeAt, toeN: hipA - 10, neck: 92 });
  return { j, props: p.rings ? prop.rings(bar.x, bar.y) : prop.bar(bar.x, bar.y), focus: ['arms', 'back'], hang: true };
}

// Dips : barres parallèles, anneaux, ou chaise derrière soi (jambes devant)
export function dip(t, p = {}) {
  const k = t * (p.amp ?? 1);
  if (p.support === 'chair') {
    const s = smooth(k);
    const hipY = lerp(G - 32, G - 17, s);
    let hipX = 90;
    let ankle; let toe;
    if (p.straight) {
      // Talons fixes, jambes tendues : le bassin recule un peu en descendant
      const len = LEG - 0.6;
      const heelX = hipX + Math.sqrt(len ** 2 - (G - 4 - (G - 32)) ** 2);
      ankle = P(heelX, G - 4);
      hipX = heelX - Math.sqrt(len ** 2 - (G - 4 - hipY) ** 2);
      toe = polar(ankle, 72, L.foot);
    } else ({ ankle, toe } = flatFoot(hipX + 34));
    const hip = P(hipX, hipY);
    const shoulder = polar(hip, 92, L.torso);
    const hand = P(88, G - 31);
    const j = body({ hip, shoulder, handN: hand, ankleN: ankle, toeN: toe, neck: 88 });
    return { j, props: prop.chair(hand.x - 24, 30), focus: ['arms'] };
  }
  const hand = P(102, G - 64);
  // Bas du mouvement : avant-bras vertical, bras à l'horizontale vers l'arrière
  const shoulder = lerpP(P(hand.x + 1, hand.y - ARM * 0.98), P(hand.x + 12, hand.y - 15), smooth(k));
  const hip = polar(shoulder, lerp(266, 250, smooth(k)), L.torso);
  const kneeAt = polar(hip, 266, L.thigh);
  const ankle = polar(kneeAt, 205, L.shin);
  const j = body({
    hip, shoulder, handN: hand, ankleN: ankle, kneeNAt: kneeAt, kneeFAt: kneeAt, elbow: P(-1, 0), toeN: 240, neck: 84,
  });
  const props = p.rings ? prop.rings(hand.x, hand.y) : prop.pbar(76, 130, hand.y);
  return { j, props, focus: ['arms'] };
}

// Leviers et planches : corps à l'horizontale
//  - front lever : sous la barre, ventre vers le ciel, bras tendus vers la barre
//  - back lever : sous la barre, ventre vers le sol, bras tendus derrière soi
//  - planche : en appui sur les mains, épaules en avant des mains
export function lever(t, p = {}) {
  const kind = p.kind || 'front';
  const form = p.form || 'full';
  const s = smooth(t);
  const props = [];
  let hand; let shoulder; let bodyA; let neck; let belly;
  if (kind === 'planche') {
    // Parallettes hautes : les genoux restent loin du sol en planche groupée
    hand = P(112, G - (p.parallettes ? 19.5 : 1.5));
    if (p.parallettes) props.push(...prop.parallettes(hand.x - 11, 22, 18));
    shoulder = polar(hand, 70, ARM * 0.99);
    bodyA = lerp(188, 181, s);
    neck = -8; belly = -1;
  } else if (kind === 'front') {
    hand = P(124, 30);
    props.push(...prop.bar(hand.x, hand.y));
    shoulder = polar(hand, 262, ARM * 0.99);
    bodyA = lerp(222, 181, s);
    neck = 14; belly = 1;
  } else {
    hand = P(108, 30);
    props.push(...prop.bar(hand.x, hand.y));
    // Bras tendus derrière soi : la barre est au-dessus du milieu du dos
    shoulder = polar(hand, 312, ARM * 0.99);
    bodyA = lerp(214, 181, s);
    neck = -10; belly = -1;
  }
  const hip = polar(shoulder, bodyA, L.torso);
  const toward = bodyA + 180; // de la hanche vers les épaules
  // Jambes groupées : cuisses vers la poitrine, talons vers les fesses
  const tuckLeg = () => {
    const k = polar(hip, toward + belly * 35, L.thigh);
    return [k, polar(k, toward + 180 + belly * 13, L.shin)];
  };
  const straight = polar(hip, bodyA, LEG - 0.6);
  let kneeNAt; let ankleN = straight; let kneeFAt; let ankleF = straight;
  let toeN = bodyA; let toeF;
  if (form === 'tuck') {
    [kneeNAt, ankleN] = tuckLeg(); kneeFAt = kneeNAt; ankleF = ankleN; toeN = toward + 180 + belly * 13;
  } else if (form === 'adv') {
    // Cuisses à 90° du tronc, tibias dans l'alignement du corps
    kneeNAt = polar(hip, toward + belly * 90, L.thigh);
    ankleN = polar(kneeNAt, bodyA, L.shin); kneeFAt = kneeNAt; ankleF = ankleN;
  } else if (form === 'one') {
    [kneeFAt, ankleF] = tuckLeg(); toeF = toward + 180 + belly * 13;
  } else if (form === 'straddle') {
    ankleF = polar(hip, bodyA - belly * 7, LEG - 0.6);
  }
  const j = body({
    hip, shoulder, handN: hand, ankleN, ankleF, kneeNAt, kneeFAt, mirror: belly > 0, knee: P(0, belly),
    toeN, toeF, neck,
  });
  return { j, props, focus: ['torso', 'arms', 'back'], hang: kind !== 'planche' };
}

// Corbeau : genoux posés à l'arrière des bras, pieds qui décollent
export function crow(t) {
  const s = smooth(t);
  const hand = P(116, G - 1.5);
  const elbow = polar(hand, 96, L.forearm);
  // Genou contre l'arrière du bras, juste au-dessus du coude
  const kneeOn = (upA) => add(polar(elbow, upA, 7), mul(dir(upA + 90), 8));
  const upA = lerp(66, 48, s);
  const shoulder = polar(elbow, upA, L.upperArm);
  const knee = kneeOn(upA);
  const hip = circles(shoulder, L.torso, knee, L.thigh, 'up');
  // Départ pointes de pieds au sol, arrivée talons vers les fesses
  const knee0 = kneeOn(66);
  const ankleA0 = angleOf(knee0, onLevel(knee0, L.shin, G - 6, -1));
  const ankle = polar(knee, lerp(ankleA0, 158, s), L.shin);
  const j = body({
    hip, shoulder, handN: hand, elbowNAt: elbow, elbowFAt: elbow, ankleN: ankle, kneeNAt: knee, kneeFAt: knee,
    toeN: lerp(-32, 170, s), neck: angleOf(hip, shoulder) + 22,
  });
  return { j, props: [prop.mat(50, 168)], focus: ['arms', 'torso'] };
}

// Coude levier : coudes plantés sous le ventre, corps à l'horizontale
export function elbowLever(t) {
  const s = smooth(t);
  const hand = P(108, G - 1.5);
  const elbow = polar(hand, 92, L.forearm);
  const shoulder = polar(elbow, 14, L.upperArm);
  const bodyA = lerp(194, 181, s);
  const hip = polar(shoulder, bodyA, L.torso);
  const ankle = polar(hip, bodyA, LEG - 0.6);
  const j = body({
    hip, shoulder, handN: hand, elbowNAt: elbow, elbowFAt: elbow, ankleN: ankle, toeN: bodyA, neck: 4,
  });
  return { j, props: [prop.mat(30, 168)], focus: ['torso', 'arms'] };
}
