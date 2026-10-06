import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  TouchableOpacity,
  AccessibilityInfo,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Circle, Path, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { getRank } from '../../services';
import { getRankInfo, getNextRankInfo } from '../../constants/ranks';
import { COLOR_DEFS, SHAPE_DEFS, FrameStage } from './AvatarFrame';

// ─── LevelUpOverlay ───────────────────────────────────────────────────────────
//
// Célébration plein écran d'un gain de niveau, en deux variantes :
//   • niveau classique : l'anneau se remplit, le chiffre bascule, éclats ;
//   • nouveau rang : charge sur l'ancien emblème → éclair → révélation du
//     nouvel emblème et du nom du rang lettre par lettre → avatar avec le
//     cadre débloqué et les avantages du rang.
//
// Pas de Modal ici : le composant se pose en absolu par-dessus son parent
// (récap de séance) ou dans LevelUpModal (montées de niveau hors séance).
// Le parent le monte quand il faut célébrer et le démonte dans onClose.
// Un appui pendant l'animation l'amène directement à la fin ; « Continuer »
// ferme. Réduction des animations : état final affiché d'emblée.
//
// Props :
//   prevLevel   number
//   newLevel    number
//   userInitial string  — initiale de l'avatar (aperçu du cadre débloqué)
//   onClose     () => void

export default function LevelUpOverlay({ prevLevel, newLevel, userInitial = 'A', onClose }) {
  const rankChanged = getRank(prevLevel).tier !== getRank(newLevel).tier;
  const [reduced, setReduced] = useState(null);

  useEffect(() => {
    let alive = true;
    const check = AccessibilityInfo.isReduceMotionEnabled?.();
    if (!check) { setReduced(false); return undefined; }
    check.then((v) => { if (alive) setReduced(!!v); }).catch(() => { if (alive) setReduced(false); });
    return () => { alive = false; };
  }, []);

  // On attend de savoir si l'appareil réduit les animations pour ne pas
  // lancer une séquence qu'il faudrait couper aussitôt.
  if (reduced === null) return null;

  return rankChanged ? (
    <RankUp prevLevel={prevLevel} newLevel={newLevel} userInitial={userInitial} reduced={reduced} onClose={onClose} />
  ) : (
    <LevelUp prevLevel={prevLevel} newLevel={newLevel} reduced={reduced} onClose={onClose} />
  );
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex, target, t) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Texte lisible sur un fond de la couleur du rang (or, jaune, vert → texte foncé).
function textOn(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#15120B' : '#FFFFFF';
}

// ─── Séquenceur ───────────────────────────────────────────────────────────────
//
// Valeurs animées déclarées avec leur état final : « terminer » (appui pendant
// l'animation, réduction des animations) = arrêter les minuteurs et animations
// en cours puis poser chaque valeur sur sa fin.

function useSequencer(spec) {
  const values = useRef(null);
  if (!values.current) {
    values.current = {};
    Object.keys(spec).forEach((k) => { values.current[k] = new Animated.Value(spec[k][0]); });
  }
  const timers = useRef([]);
  const running = useRef([]);

  const at = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const run = useCallback((anim) => { running.current.push(anim); anim.start(); }, []);
  const stopAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    running.current.forEach((a) => a.stop());
    running.current = [];
  }, []);
  const toFinal = useCallback(() => {
    stopAll();
    Object.keys(spec).forEach((k) => values.current[k].setValue(spec[k][1]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll]);

  useEffect(() => stopAll, [stopAll]);
  return { v: values.current, at, run, stopAll, toFinal };
}

const native = { useNativeDriver: true };
const tween = (value, toValue, duration, easing = Easing.out(Easing.cubic), delay = 0) =>
  Animated.timing(value, { toValue, duration, easing, delay, ...native });
const spring = (value, toValue, friction, tension) =>
  Animated.spring(value, { toValue, friction, tension, ...native });

function haptic(kind) {
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle[kind]);
  } catch (e) { /* appareil sans retour haptique */ }
}

// Taille réelle de l'écran : la fenêtre n'inclut pas la barre de navigation
// Android, que la célébration doit couvrir (même règle que le récap).
function useScreenBox() {
  const { width, height } = useWindowDimensions();
  return { W: width, H: Math.max(height, Dimensions.get('screen').height) };
}

// ─── Décors ───────────────────────────────────────────────────────────────────

// Étincelles déterministes (même gerbe à chaque fois, pas de saut au rendu).
function makeSparks(count, minDist, maxDist, seed) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return Array.from({ length: count }, (_, i) => {
    const ang = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.45;
    const dist = minDist + rnd() * (maxDist - minDist);
    const dot = rnd() < 0.3;
    const w = 2.5 + rnd() * 1.5;
    return {
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist,
      fall: 14 + rnd() * 26,
      w: dot ? w * 1.7 : w,
      h: dot ? w * 1.7 : 7 + rnd() * 11,
      rot: (ang * 180) / Math.PI + 90,
      white: i % 3 === 0,
    };
  });
}

// Gerbe d'étincelles pilotée par une seule valeur 0 → 1.
function Burst({ progress, color, sparks }) {
  return (
    <View pointerEvents="none" style={styles.origin}>
      {sparks.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: -p.w / 2,
            top: -p.h / 2,
            width: p.w,
            height: p.h,
            borderRadius: p.w,
            backgroundColor: p.white ? '#FFFFFF' : color,
            opacity: progress.interpolate({ inputRange: [0, 0.04, 0.6, 1], outputRange: [0, 1, 0.85, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, p.dy * 0.9, p.dy + p.fall] }) },
              { rotate: `${p.rot}deg` },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

// Onde de choc : anneau qui s'élargit en s'estompant.
function Shockwave({ progress, color, size, to = 5, width = 3 }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: width,
        borderColor: color,
        opacity: progress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.85, 0] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, to] }) }],
      }}
    />
  );
}

// Halo doux (dégradé radial : les ombres colorées n'existent pas sur Android).
function Glow({ size, color, id, strength = 0.6 }) {
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.45" stopColor={color} stopOpacity={strength * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

// Faisceaux de lumière autour de l'emblème (tournent lentement).
function Rays({ size, color, count = 12 }) {
  const c = size / 2;
  const half = (Math.PI / count) * 0.3;
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const x1 = c + Math.cos(a - half) * c;
    const y1 = c + Math.sin(a - half) * c;
    const x2 = c + Math.cos(a + half) * c;
    const y2 = c + Math.sin(a + half) * c;
    d += `M${c} ${c}L${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}Z`;
  }
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id="luRays" cx="50%" cy="50%" r="50%">
          <Stop offset="0.12" stopColor={color} stopOpacity={0.6} />
          <Stop offset="0.4" stopColor={color} stopOpacity={0.16} />
          <Stop offset="0.8" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={d} fill="url(#luRays)" />
    </Svg>
  );
}

function hexPoints(c, r) {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (-90 + 60 * k);
    return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

// Emblème de rang : hexagone en métal teinté de la couleur du rang.
function RankEmblem({ size, color, icon, id }) {
  const c = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}m`} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={mix(color, '#FFFFFF', 0.5)} />
            <Stop offset="0.45" stopColor={color} />
            <Stop offset="1" stopColor={mix(color, '#000000', 0.5)} />
          </LinearGradient>
          <LinearGradient id={`${id}i`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={mix(color, '#0B0C14', 0.7)} />
            <Stop offset="1" stopColor="#0B0C14" />
          </LinearGradient>
        </Defs>
        <Polygon points={hexPoints(c, c * 0.97)} fill={`url(#${id}m)`} />
        <Polygon
          points={hexPoints(c, c * 0.8)}
          fill={`url(#${id}i)`}
          stroke={rgba(mix(color, '#FFFFFF', 0.35), 0.6)}
          strokeWidth={Math.max(1, size * 0.014)}
        />
      </Svg>
      <Ionicons name={icon} size={size * 0.38} color={mix(color, '#FFFFFF', 0.18)} />
    </View>
  );
}

function ContinueButton({ color, opacity, bottom, enabled, onPress }) {
  return (
    <Animated.View
      style={[styles.footer, { paddingBottom: bottom, opacity }]}
      pointerEvents={enabled ? 'box-none' : 'none'}
    >
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.cta, { backgroundColor: color }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={[styles.ctaText, { color: textOn(color) }]}>Continuer</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Sortie commune : fondu puis onClose.
function useExit(onClose) {
  const exit = useRef(new Animated.Value(1)).current;
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    haptic('Light');
    Animated.timing(exit, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), ...native })
      .start(() => onClose && onClose());
  }, [exit, onClose]);
  return { exit, close };
}

// ─── Niveau classique ─────────────────────────────────────────────────────────

const LEVEL_SPEC = {
  backdrop: [0, 1],
  medal:    [0, 1],
  oldNum:   [0, 1],
  newNum:   [0, 1],
  pulse:    [0, 1],
  wave:     [0, 1],
  burst:    [0, 1],
  glow:     [0, 1],
  info:     [0, 1],
  cta:      [0, 1],
};
const MEDAL = 196;
const RING_R = 78;
const RING_W = 7;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function LevelUp({ prevLevel, newLevel, reduced, onClose }) {
  const { W, H } = useScreenBox();
  const insets = useSafeAreaInsets();
  const { v, at, run, toFinal } = useSequencer(LEVEL_SPEC);
  // L'anneau anime une propriété SVG : pilote JS, valeur à part.
  const ring = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);
  const { exit, close } = useExit(onClose);

  const rank = getRank(newLevel);
  const color = rank.color;
  const next = getNextRankInfo(newLevel);
  const sparks = useMemo(() => makeSparks(18, 70, 150, 7), []);

  const finish = useCallback(() => {
    toFinal();
    ring.stopAnimation();
    ring.setValue(1);
    setDone(true);
  }, [toFinal, ring]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Niveau ${newLevel} atteint`);
    if (reduced) { finish(); return; }

    run(tween(v.backdrop, 1, 240));
    run(spring(v.medal, 1, 6, 80));
    at(200, () => {
      const anim = Animated.timing(ring, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
      run(anim);
    });
    at(950, () => {
      haptic('Medium');
      haptic('success');
      run(tween(v.oldNum, 1, 160, Easing.in(Easing.quad)));
      run(Animated.sequence([Animated.delay(110), spring(v.newNum, 1, 5, 140)]));
      run(tween(v.pulse, 1, 520));
      run(tween(v.wave, 1, 850));
      run(tween(v.burst, 1, 1000, Easing.out(Easing.quad)));
      run(tween(v.glow, 1, 300));
    });
    at(1250, () => run(tween(v.info, 1, 420)));
    at(1550, () => { run(tween(v.cta, 1, 350)); setDone(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = next
    ? `Plus que ${next.minLevel - newLevel} niveau${next.minLevel - newLevel > 1 ? 'x' : ''} avant le rang ${next.name}`
    : 'Tu es au sommet des rangs';

  return (
    <Animated.View style={[styles.root, { width: W, height: H, opacity: exit }]} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: v.backdrop }]} />
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={done ? undefined : finish} />

      <View style={[styles.stage, { paddingTop: insets.top + 24, paddingBottom: 120 + insets.bottom }]} pointerEvents="box-none">
        <Animated.Text style={[styles.kicker, { opacity: v.backdrop }]}>Niveau supérieur</Animated.Text>

        <Animated.View
          style={[
            styles.medal,
            {
              opacity: v.medal,
              transform: [
                { scale: v.medal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                { scale: v.pulse.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.09, 1] }) },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.centerAbs, { opacity: v.glow }]}>
            <Glow size={MEDAL * 1.9} color={color} id="luLvlGlow" strength={0.45} />
          </Animated.View>
          <Shockwave progress={v.wave} color={color} size={RING_R * 2} to={2.6} />

          <Svg width={MEDAL} height={MEDAL} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={MEDAL / 2} cy={MEDAL / 2} r={RING_R} stroke="rgba(255,255,255,0.08)" strokeWidth={RING_W} fill="#0D0E16" />
            <AnimatedCircle
              cx={MEDAL / 2}
              cy={MEDAL / 2}
              r={RING_R}
              stroke={color}
              strokeWidth={RING_W}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${RING_C} ${RING_C}`}
              strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [RING_C, 0] })}
            />
          </Svg>

          <View style={styles.centerAbs}>
            <Text style={styles.medalLabel}>Niveau</Text>
            <View style={styles.numBox}>
              <Animated.Text
                style={[
                  styles.num,
                  {
                    color: 'rgba(255,255,255,0.55)',
                    opacity: v.oldNum.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [
                      { translateY: v.oldNum.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
                      { scale: v.oldNum.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
                    ],
                  },
                ]}
              >
                {prevLevel}
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.num,
                  styles.numAbs,
                  {
                    opacity: v.newNum.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' }),
                    transform: [{ scale: v.newNum.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }],
                  },
                ]}
              >
                {newLevel}
              </Animated.Text>
            </View>
          </View>

          <Burst progress={v.burst} color={color} sparks={sparks} />
        </Animated.View>

        <Animated.View
          style={[
            styles.info,
            { opacity: v.info, transform: [{ translateY: v.info.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
          ]}
        >
          <View style={[styles.rankPill, { backgroundColor: rgba(color, 0.14), borderColor: rgba(color, 0.35) }]}>
            <Text style={[styles.rankPillText, { color }]}>{rank.name}</Text>
          </View>
          <Text style={styles.hint}>{hint}</Text>
        </Animated.View>
      </View>

      <ContinueButton color={color} opacity={v.cta} bottom={20 + insets.bottom} enabled={done} onPress={close} />
    </Animated.View>
  );
}

// ─── Nouveau rang ─────────────────────────────────────────────────────────────

const RANK_SPEC = {
  backdrop: [0, 1],
  oldIn:    [0, 0],   // apparition de l'ancien emblème (0 → 1), caché à la fin
  oldOut:   [0, 1],   // éclatement de l'ancien emblème
  shake:    [0, 0],
  charge:   [0, 0],
  conv0:    [0, 1],
  conv1:    [0, 1],
  conv2:    [0, 1],
  flash:    [0, 0],
  reveal:   [0, 1],
  wave1:    [0, 1],
  wave2:    [0, 1],
  burst:    [0, 1],
  rays:     [0, 1],
  kicker:   [0, 1],
  sub:      [0, 1],
  rewards:  [0, 1],
  cta:      [0, 1],
};
const BURST_AT = 1350;
const LETTER_STEP = 55;

function rankRewards(prevLevel, newLevel) {
  const info = getRankInfo(newLevel);
  const pick = (defs) => defs.filter((d) => !d.special && d.unlockLevel <= newLevel).pop();
  const color = pick(COLOR_DEFS);
  const shape = pick(SHAPE_DEFS);
  const perks = (info.perks || []).map((p) => p.replace(/\s*\(Niv\. ?\d+\)\s*$/, ''));
  return { info, colorId: color ? color.id : 'none', shapeId: shape ? shape.id : 'circle', perks };
}

function RankUp({ prevLevel, newLevel, userInitial, reduced, onClose }) {
  const { W, H } = useScreenBox();
  const insets = useSafeAreaInsets();
  const { v, at, run, toFinal } = useSequencer(RANK_SPEC);
  const [done, setDone] = useState(false);
  const { exit, close } = useExit(onClose);

  const oldRank = getRank(prevLevel);
  const rank = getRank(newLevel);
  const color = rank.color;
  const { info, colorId, shapeId, perks } = useMemo(() => rankRewards(prevLevel, newLevel), [prevLevel, newLevel]);
  const oldInfo = getRankInfo(prevLevel);

  const name = rank.name;
  const letters = useMemo(() => name.split('').map(() => new Animated.Value(0)), [name]);
  const nameSize = Math.max(30, Math.min(52, (W - 48) / (name.length * 0.64)));

  const EMBLEM = Math.min(132, Math.round(H * 0.15));
  const sparks = useMemo(() => makeSparks(30, EMBLEM * 0.8, EMBLEM * 2.1, 11), [EMBLEM]);
  const raysSize = Math.min(W * 1.25, 560);

  // Rotation continue des faisceaux, indépendante du séquenceur.
  const spin = useRef(new Animated.Value(0)).current;
  const spinning = useRef(null);
  const startSpin = useCallback(() => {
    if (reduced || spinning.current) return;
    spinning.current = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 36000, easing: Easing.linear, ...native }));
    spinning.current.start();
  }, [reduced, spin]);
  useEffect(() => () => spinning.current && spinning.current.stop(), []);

  const finish = useCallback(() => {
    toFinal();
    letters.forEach((l) => { l.stopAnimation(); l.setValue(1); });
    startSpin();
    setDone(true);
  }, [toFinal, letters, startSpin]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Nouveau rang : ${name}. Niveau ${newLevel}.`);
    if (reduced) { finish(); return; }

    // 1. Charge : l'ancien emblème apparaît, l'énergie converge, il tremble.
    run(tween(v.backdrop, 1, 300));
    run(spring(v.oldIn, 1, 7, 60));
    run(tween(v.charge, 1, 1100, Easing.in(Easing.quad), 250));
    [0, 1, 2].forEach((i) => at(260 + i * 240, () => run(tween(v[`conv${i}`], 1, 640, Easing.in(Easing.quad)))));
    at(620, () => {
      const steps = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
      run(Animated.sequence([
        ...steps.flatMap((a) => [tween(v.shake, a, 45, Easing.linear), tween(v.shake, -a, 45, Easing.linear)]),
        tween(v.shake, 0, 45, Easing.linear),
      ]));
    });
    at(450, () => haptic('Light'));
    at(800, () => haptic('Light'));
    at(1060, () => haptic('Medium'));
    at(1230, () => haptic('Medium'));

    // 2. Éclair : l'ancien emblème éclate, le nouveau surgit.
    at(BURST_AT, () => {
      haptic('Heavy');
      haptic('success');
      run(Animated.sequence([tween(v.flash, 0.9, 70, Easing.linear), tween(v.flash, 0, 560, Easing.out(Easing.quad))]));
      run(tween(v.oldOut, 1, 240));
      run(tween(v.charge, 0, 200));
      run(spring(v.reveal, 1, 4.5, 70));
      run(tween(v.wave1, 1, 950));
      run(tween(v.wave2, 1, 1250, Easing.out(Easing.cubic), 140));
      run(tween(v.burst, 1, 1400, Easing.out(Easing.quad)));
      run(tween(v.rays, 1, 700));
      startSpin();
    });

    // 3. Nom du rang, lettre par lettre.
    at(BURST_AT + 300, () => run(tween(v.kicker, 1, 400)));
    const lettersAt = BURST_AT + 450;
    letters.forEach((l, i) => at(lettersAt + i * LETTER_STEP, () => run(spring(l, 1, 6, 170))));
    const afterName = lettersAt + letters.length * LETTER_STEP + 200;
    at(afterName, () => { haptic('Medium'); run(tween(v.sub, 1, 420)); });

    // 4. Ce qui est débloqué, puis l'action.
    at(afterName + 380, () => run(tween(v.rewards, 1, 520)));
    at(afterName + 950, () => { run(tween(v.cta, 1, 380)); setDone(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = perks.slice(0, 3);
  const more = perks.length - shown.length;

  return (
    <Animated.View style={[styles.root, { width: W, height: H, opacity: exit }]} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdropDeep, { opacity: v.backdrop }]} />
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={done ? undefined : finish} />

      <View style={[styles.stage, { paddingTop: insets.top + 16, paddingBottom: 110 + insets.bottom }]} pointerEvents="box-none">
        {/* ── Emblème et effets ── */}
        <View style={{ width: EMBLEM * 1.6, height: EMBLEM * 1.45, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Animated.View
            style={[
              styles.centerAbs,
              {
                opacity: v.rays.interpolate({ inputRange: [0, 1], outputRange: [0, 0.65] }),
                transform: [
                  { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                  { scale: v.rays.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                ],
              },
            ]}
          >
            <Rays size={raysSize} color={color} />
          </Animated.View>

          <Animated.View style={[styles.centerAbs, { opacity: v.rays }]}>
            <Glow size={EMBLEM * 2.6} color={color} id="luRankGlow" strength={0.55} />
          </Animated.View>
          <Animated.View
            style={[
              styles.centerAbs,
              { opacity: v.charge, transform: [{ scale: v.charge.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) }] },
            ]}
          >
            <Glow size={EMBLEM * 2.2} color={oldRank.color} id="luChargeGlow" strength={0.5} />
          </Animated.View>

          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: EMBLEM,
                height: EMBLEM,
                borderRadius: EMBLEM / 2,
                borderWidth: 2,
                borderColor: oldRank.color,
                opacity: v[`conv${i}`].interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.6, 0] }),
                transform: [{ scale: v[`conv${i}`].interpolate({ inputRange: [0, 1], outputRange: [2.8, 0.85] }) }],
              }}
            />
          ))}

          <Shockwave progress={v.wave1} color={color} size={EMBLEM} to={6} width={4} />
          <Shockwave progress={v.wave2} color={mix(color, '#FFFFFF', 0.4)} size={EMBLEM} to={4} width={2} />

          {/* Ancien emblème : apparaît, tremble, éclate */}
          <Animated.View
            style={[
              styles.centerAbs,
              {
                opacity: Animated.multiply(v.oldIn, v.oldOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
                transform: [
                  { translateX: v.shake },
                  { scale: v.oldIn.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) },
                  { scale: v.oldOut.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) },
                ],
              },
            ]}
          >
            <RankEmblem size={EMBLEM * 0.85} color={oldRank.color} icon={oldInfo.icon} id="luOld" />
          </Animated.View>

          {/* Nouvel emblème */}
          <Animated.View
            style={{
              opacity: v.reveal.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ scale: v.reveal.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }],
            }}
          >
            <RankEmblem size={EMBLEM} color={color} icon={info.icon} id="luNew" />
          </Animated.View>

          <Burst progress={v.burst} color={color} sparks={sparks} />
        </View>

        {/* ── Nom du rang ── */}
        <Animated.Text style={[styles.rankKicker, { color: mix(color, '#FFFFFF', 0.35), opacity: v.kicker }]}>
          Nouveau rang
        </Animated.Text>
        <View style={styles.nameRow} accessible accessibilityRole="header" accessibilityLabel={name}>
          {letters.map((l, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                {
                  fontSize: nameSize,
                  lineHeight: nameSize * 1.15,
                  color,
                  opacity: l.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
                  transform: [{ scale: l.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] }) }],
                },
              ]}
            >
              {name[i] === ' ' ? ' ' : name[i]}
            </Animated.Text>
          ))}
        </View>
        <Animated.View style={[styles.subRow, { opacity: v.sub }]}>
          <Text style={styles.subLevel}>Niveau {newLevel}</Text>
          <Text style={styles.subDot}>·</Text>
          <Text style={styles.subOld}>{oldRank.name}</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} style={{ marginHorizontal: 6 }} />
          <Text style={[styles.subNew, { color }]}>{name}</Text>
        </Animated.View>

        {/* ── Débloqué ── */}
        {perks.length > 0 ? (
          <Animated.View
            style={[
              styles.rewards,
              { borderColor: rgba(color, 0.28) },
              { opacity: v.rewards, transform: [{ translateY: v.rewards.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
            ]}
          >
            <FrameStage shapeId={shapeId} colorId={colorId} size={60} width={88} height={88} userInitial={userInitial}>
              <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{userInitial}</Text></View>
            </FrameStage>
            <View style={styles.perks}>
              <Text style={styles.rewardsTitle}>Débloqué</Text>
              {shown.map((p) => (
                <View key={p} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={color} style={styles.perkIcon} />
                  <Text style={styles.perkText}>{p}</Text>
                </View>
              ))}
              {more > 0 ? (
                <Text style={styles.perkMore}>{`Et ${more} autre${more > 1 ? 's' : ''} avantage${more > 1 ? 's' : ''}`}</Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </View>

      <ContinueButton color={color} opacity={v.cta} bottom={20 + insets.bottom} enabled={done} onPress={close} />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: v.flash }]} />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  backdrop: { backgroundColor: 'rgba(6,7,12,0.97)' },
  backdropDeep: { backgroundColor: '#05060A' },
  flash: { backgroundColor: '#FFFFFF' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centerAbs: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  origin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },

  // ── Niveau classique ──
  kicker: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginBottom: 20 },
  medal: { width: MEDAL, height: MEDAL, alignItems: 'center', justifyContent: 'center' },
  medalLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: -2 },
  numBox: { height: 76, minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  num: { color: '#FFFFFF', fontSize: 64, lineHeight: 76, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'], textAlign: 'center' },
  numAbs: { position: 'absolute', left: 0, right: 0, top: 0 },
  info: { alignItems: 'center', marginTop: 28, gap: 12 },
  rankPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  rankPillText: { fontSize: 15, fontWeight: '800' },
  hint: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center' },

  // ── Nouveau rang ──
  rankKicker: { fontSize: 16, fontWeight: '800', marginTop: 8, letterSpacing: 0.2 },
  nameRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 2 },
  letter: { fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  subLevel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subDot: { color: Colors.textMuted, fontSize: 15, marginHorizontal: 8 },
  subOld: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  subNew: { fontSize: 15, fontWeight: '800' },

  rewards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 420,
    marginTop: 26,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(22,22,31,0.92)',
  },
  avatarFallback: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.cardDeep, alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  perks: { flex: 1, gap: 7 },
  rewardsTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 1 },
  perkRow: { flexDirection: 'row', alignItems: 'flex-start' },
  perkIcon: { marginTop: 1, marginRight: 8 },
  perkText: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  perkMore: { color: Colors.textMuted, fontSize: 13, marginLeft: 24 },

  // ── Action ──
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, alignItems: 'center' },
  cta: {
    width: '100%',
    maxWidth: 440,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800' },
});
