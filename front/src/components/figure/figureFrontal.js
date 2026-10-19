// ─── Mannequin vu de face (ou d'en haut) ──────────────────────────────────────
// Squelette symétrique : les épaules et le bassin ont une largeur. Sert aux
// mouvements qui se lisent mal de profil (jumping jacks, drapeau humain,
// pompes archer, Y-T-W…).

import {
  G, L, ARM, LEG, P, add, mul, rad, dir, polar, lerp, lerpP, smooth, bend, prop, flat,
} from './figureKit';

// Squelette symétrique : épaules et hanches ont une largeur.
const W = 11; // demi-largeur des épaules

const HW = 7; // demi-largeur du bassin

export function frontal(t, p = {}) {
  const pose = p.pose;
  const s = smooth(t);
  const props = [];
  const lim = (root, a, l1, b, l2) => { const m = polar(root, a, l1); return [m, polar(m, b, l2)]; };
  const standY = G - 4 - LEG + 0.6;
  const feetDown = (pelvis, spread = 1) => {
    const hpL = add(pelvis, P(-HW, 0)); const hpR = add(pelvis, P(HW, 0));
    const fL = P(100 - HW - spread, G - 3); const fR = P(100 + HW + spread, G - 3);
    return { hpL, hpR, legL: [bend(hpL, fL, L.thigh, L.shin, P(-1, 0)), fL], legR: [bend(hpR, fR, L.thigh, L.shin, P(1, 0)), fR] };
  };

  if (pose === 'jack') {
    const k = s;
    const hop = 2.5 * Math.sin(Math.PI * k);
    const spreadA = lerp(1.5, 16, k);
    const pelvis = P(100, G - 3 - (LEG - 0.5) * Math.cos(rad(spreadA)) - hop);
    const sh = polar(pelvis, 90, L.torso);
    const shL = add(sh, P(-W, 0)); const shR = add(sh, P(W, 0));
    const aL = lerp(262, 128, k); const aR = lerp(278, 52, k);
    const armL = lim(shL, aL, L.upperArm, aL - 6 * (1 - k), L.forearm);
    const armR = lim(shR, aR, L.upperArm, aR + 6 * (1 - k), L.forearm);
    const hpL = add(pelvis, P(-HW, 0)); const hpR = add(pelvis, P(HW, 0));
    const legL = lim(hpL, 270 - spreadA, L.thigh, 270 - spreadA, L.shin - 0.5);
    const legR = lim(hpR, 270 + spreadA, L.thigh, 270 + spreadA, L.shin - 0.5);
    return finishFrontal({ sh, shL, shR, hpL, hpR, armL, armR, legL, legR, props, focus: ['legs'] });
  }

  if (pose === 'archerPushup') {
    // Vu de face : un bras plie, l'autre reste tendu sur le côté
    const handL = P(68, G - 1.5); const handR = P(128, G - 1.5);
    const top = G - 1.5 - Math.sqrt(ARM ** 2 * 0.97 - ((100 - W) - handL.x) ** 2);
    const cx = lerp(100, 86, s);
    const sh = P(cx, lerp(top, G - 15, s));
    const shL = add(sh, P(-W, 0)); const shR = add(sh, P(W, 0));
    const armL = [bend(shL, handL, L.upperArm, L.forearm, P(-0.6, -1)), handL];
    const armR = [bend(shR, handR, L.upperArm, L.forearm, P(0.3, -1)), handR];
    // Bassin et jambes en arrière-plan (corps vu dans l'axe)
    const pelvis = add(sh, P(0, -3));
    const hpL = add(pelvis, P(-HW * 0.8, 0)); const hpR = add(pelvis, P(HW * 0.8, 0));
    const legL = [lerpP(hpL, P(96, G - 3), 0.5), P(96, G - 3)];
    const legR = [lerpP(hpR, P(104, G - 3), 0.5), P(104, G - 3)];
    return finishFrontal({
      sh, shL, shR, hpL, hpR, armL, armR, legL, legR, props: [prop.mat(40, 160)], focus: ['arms'],
      headAt: add(sh, P(0, 4)), legsBehind: true, loose: ['cuisse', 'tibia', 'cuisse loin', 'tibia loin'],
    });
  }

  if (pose === 'proneYTW') {
    // Vu d'en haut, allongé sur le ventre, tête à droite : bras en Y, puis T, puis W
    const pelvis = P(72, 70);
    const sh = P(pelvis.x + L.torso, 70);
    const shL = add(sh, P(0, -W)); const shR = add(sh, P(0, W));
    const arm = (side) => {
      const root = side < 0 ? shL : shR;
      if (t <= 0.5) {
        const a = lerp(38, 90, smooth(t * 2));
        return lim(root, -side * a, L.upperArm, -side * a, L.forearm);
      }
      const k = smooth((t - 0.5) * 2);
      const up = lerp(90, 128, k); const fore = lerp(90, 52, k);
      return lim(root, -side * up, L.upperArm, -side * fore, L.forearm);
    };
    const hpL = add(pelvis, P(0, -HW)); const hpR = add(pelvis, P(0, HW));
    const legL = lim(hpL, 176, L.thigh, 176, L.shin);
    const legR = lim(hpR, 184, L.thigh, 184, L.shin);
    return finishFrontal({
      sh, shL, shR, hpL, hpR, armL: arm(-1), armR: arm(1), legL, legR,
      props: [{ k: 'rect', x: 12, y: 24, w: 176, h: 92, r: 8, c: 'mat' }], focus: ['back'], axis: 0, topView: true,
    });
  }

  if (pose === 'flag') {
    // Drapeau humain vu de face : bras du haut qui tire, bras du bas qui pousse
    props.push(prop.pole(50));
    const reachTop = Math.sqrt((ARM * 0.995) ** 2 - 14 ** 2);
    const handTop = P(50, 52 - W - reachTop); const handBot = P(50, 52 + W + reachTop);
    const axis = lerp(-10, 0, s);
    const sh = P(lerp(62, 64, s), 52);
    const shL = add(sh, mul(dir(axis + 90), W)); const shR = add(sh, mul(dir(axis - 90), W));
    const pelvis = polar(sh, axis, L.torso);
    const hpL = add(pelvis, mul(dir(axis + 90), HW)); const hpR = add(pelvis, mul(dir(axis - 90), HW));
    const armL = [bend(shL, handTop, L.upperArm, L.forearm, 'ccw'), handTop];
    const armR = [bend(shR, handBot, L.upperArm, L.forearm, 'cw'), handBot];
    // Groupé : genoux ramenés vers la poitrine, vus de face (en raccourci)
    const leg = (root, off) => (p.tuck
      ? lim(root, axis + off, L.thigh * 0.55, axis - 90 + off, L.shin * 0.8)
      : lim(root, axis + off, L.thigh, axis + off, L.shin));
    const legL = leg(hpL, 3); const legR = leg(hpR, -3);
    return finishFrontal({
      sh, shL, shR, hpL, hpR, armL, armR, legL, legR, props, focus: ['torso', 'arms'], axis,
      loose: p.tuck ? ['cuisse', 'tibia', 'cuisse loin', 'tibia loin'] : undefined,
    });
  }

  if (pose === 'cossack') {
    // Bascule d'une jambe à l'autre, pieds écartés, jambe tendue côté opposé
    const footL = P(70, G - 3); const footR = P(130, G - 3);
    const side = lerp(-1, 1, s);
    const depth = Math.abs(side);
    const midY = G - 3 - Math.sqrt((LEG - 1) ** 2 - (30 - HW) ** 2);
    const pelvis = P(100 + side * 16, lerp(midY, G - 32, smooth(depth)));
    const sh = polar(pelvis, 90 - side * 6, L.torso);
    const shL = add(sh, P(-W, 0)); const shR = add(sh, P(W, 0));
    const hands = add(polar(sh, 90 - side * 6, 0), P(0, 24));
    const armL = [bend(shL, add(hands, P(-3, 0)), L.upperArm, L.forearm, P(-1, 0.4)), add(hands, P(-3, 0))];
    const armR = [bend(shR, add(hands, P(3, 0)), L.upperArm, L.forearm, P(1, 0.4)), add(hands, P(3, 0))];
    const hpL = add(pelvis, P(-HW, 0)); const hpR = add(pelvis, P(HW, 0));
    const legL = [bend(hpL, footL, L.thigh, L.shin, P(-1, -0.4)), footL];
    const legR = [bend(hpR, footR, L.thigh, L.shin, P(1, -0.4)), footR];
    return finishFrontal({ sh, shL, shR, hpL, hpR, armL, armR, legL, legR, props, focus: ['legs'] });
  }

  if (pose === 'kneeRotation') {
    // Vu d'en haut, allongé sur le dos, genoux pliés qui tombent d'un côté puis de l'autre
    const sh = P(62, 70); const pelvis = P(sh.x + L.torso, 70);
    const shL = add(sh, P(0, -W)); const shR = add(sh, P(0, W));
    const armL = lim(shL, 100, L.upperArm, 100, L.forearm);
    const armR = lim(shR, 260, L.upperArm, 260, L.forearm);
    const hpL = add(pelvis, P(0, -HW)); const hpR = add(pelvis, P(0, HW));
    // Genoux pliés vus d'en haut : cuisse et tibia en raccourci
    const lean = lerp(-38, 38, s);
    const leg = (root) => { const knee = polar(root, -lean, L.thigh * 0.85); return [knee, polar(knee, 180 - lean * 0.5 + 25, L.shin * 0.55)]; };
    return finishFrontal({
      sh, shL, shR, hpL, hpR, armL, armR, legL: leg(hpL), legR: leg(hpR),
      props: [{ k: 'rect', x: 22, y: 30, w: 156, h: 80, r: 8, c: 'mat' }], focus: ['back'], axis: 180, topView: true,
      loose: ['cuisse', 'tibia', 'cuisse loin', 'tibia loin'],
    });
  }

  // Debout de face : élastique, glissements au mur, cercles de bras, épaules, bassin
  const ang = 2 * Math.PI * t;
  let pelvis = P(100, standY);
  if (pose === 'hipCircles') pelvis = add(pelvis, P(4 * Math.cos(ang), 1.2 * Math.sin(ang) + 1.2));
  const lift = pose === 'shrug' ? Math.max(0, 3 * Math.sin(ang)) : 0;
  const sh = P(100, standY - L.torso - lift);
  const shL = add(sh, P(-W, 0)); const shR = add(sh, P(W, 0));
  let armL; let armR;
  if (pose === 'pullapart') {
    // Élastique tenu bras tendus devant, écarté jusqu'aux bras en croix
    const reach = lerp(0.42, 1, s);
    const aL = lerp(192, 180, s); const aR = lerp(-12, 0, s);
    armL = lim(shL, aL, L.upperArm * reach, aL, L.forearm * reach);
    armR = lim(shR, aR, L.upperArm * reach, aR, L.forearm * reach);
    props.push(prop.band(armL[1], armR[1]));
  } else if (pose === 'wallYW') {
    // Dos au mur : bras en W puis glissés en Y
    props.push({ k: 'rect', x: 34, y: 8, w: 132, h: G - 8, r: 4, c: 'mat' });
    const up = lerp(160, 118, s); const fore = lerp(95, 112, s);
    armL = lim(shL, up, L.upperArm, fore, L.forearm);
    armR = lim(shR, 180 - up, L.upperArm, 180 - fore, L.forearm);
  } else if (pose === 'armCircles') {
    const o = P(4 * Math.cos(ang), 4 * Math.sin(ang));
    armL = [polar(shL, 180, L.upperArm), add(polar(shL, 180, ARM * 0.98), o)];
    armR = [polar(shR, 0, L.upperArm), add(polar(shR, 0, ARM * 0.98), P(-o.x, o.y))];
  } else if (pose === 'hipCircles') {
    armL = [bend(shL, add(pelvis, P(-HW - 4, -4)), L.upperArm, L.forearm, P(-1, 0)), add(pelvis, P(-HW - 4, -4))];
    armR = [bend(shR, add(pelvis, P(HW + 4, -4)), L.upperArm, L.forearm, P(1, 0)), add(pelvis, P(HW + 4, -4))];
  } else {
    armL = lim(shL, 264, L.upperArm, 266, L.forearm);
    armR = lim(shR, 276, L.upperArm, 274, L.forearm);
  }
  const { hpL, hpR, legL, legR } = feetDown(pelvis);
  return finishFrontal({
    sh, shL, shR, hpL, hpR, armL, armR, legL, legR, props, focus: pose === 'pullapart' || pose === 'wallYW' ? ['back'] : ['torso'],
    loose: pose === 'armCircles' ? ['avant-bras', 'avant-bras loin'] : pose === 'pullapart' ? ['bras', 'avant-bras', 'bras loin', 'avant-bras loin'] : undefined,
  });
}

// Formes d'un squelette de face. Gauche = arrière-plan, droite = premier plan.
function finishFrontal(o) {
  const { sh, shL, shR, hpL, hpR, armL, armR, legL, legR, props, focus = [], axis = 90, topView = false, headAt, legsBehind } = o;
  const line = (a, b, w, c) => ({ k: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, w, c });
  const hotArms = focus.includes('arms'); const hotLegs = focus.includes('legs');
  const shapes = [...flat(props)];
  shapes.push(line(hpL, legL[0], 11, hotLegs ? 'accentFar' : 'far'), line(legL[0], legL[1], 9.5, hotLegs ? 'accentFar' : 'far'));
  if (legsBehind) shapes.push(line(hpR, legR[0], 11, 'far'), line(legR[0], legR[1], 9.5, 'far'));
  shapes.push(line(shL, armL[0], 8, hotArms ? 'accentFar' : 'far'), line(armL[0], armL[1], 7, hotArms ? 'accentFar' : 'far'));
  const torsoC = focus.includes('torso') || focus.includes('back') ? 'torsoAccent' : 'torso';
  shapes.push({ k: 'poly', pts: [hpL, hpR, shR, shL], w: 0, c: torsoC, fill: true });
  shapes.push(line(lerpP(hpL, hpR, 0.5), lerpP(shL, shR, 0.5), 15, torsoC));
  if (!legsBehind) shapes.push(line(hpR, legR[0], 11, hotLegs ? 'accent' : 'near'), line(legR[0], legR[1], 9.5, hotLegs ? 'accent' : 'near'));
  shapes.push(line(shR, armR[0], 8.5, hotArms ? 'accent' : 'near'), line(armR[0], armR[1], 7.5, hotArms ? 'accent' : 'near'));
  const head = headAt || polar(sh, axis, L.neck + L.head);
  if (!headAt) shapes.push(line(sh, polar(sh, axis, L.neck), 6, 'torso'));
  shapes.push({ k: 'circle', cx: head.x, cy: head.y, r: L.head, c: 'head' });
  const limbs = [
    [shL, armL[0], L.upperArm, 'bras loin'], [armL[0], armL[1], L.forearm, 'avant-bras loin'],
    [shR, armR[0], L.upperArm, 'bras'], [armR[0], armR[1], L.forearm, 'avant-bras'],
    [hpL, legL[0], L.thigh, 'cuisse loin'], [legL[0], legL[1], L.shin, 'tibia loin'],
    [hpR, legR[0], L.thigh, 'cuisse'], [legR[0], legR[1], L.shin, 'tibia'],
  ];
  return {
    shapes, focus, frontal: true, topView, limbs, loose: o.loose,
    bodyPts: [hpL, hpR, shL, shR, ...armL, ...armR, ...legL, ...legR, P(head.x, head.y + L.head)],
  };
}
