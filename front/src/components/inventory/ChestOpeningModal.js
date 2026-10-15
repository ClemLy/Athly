import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Easing, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { ITEM_CATALOG, RARITY_META, haptics } from '../../services';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { readableOn } from '../../utils/ritualTimer';
import { ChestBody, ChestLid, ChestLeak, ChestInterior, ChestShadow } from './ChestGlyph';

// ─── ChestOpeningModal ────────────────────────────────────────────────────────
// Mise en scène d'ouverture, intensifiée selon la rareté tirée :
//   1. charge      — le coffre vacille, la lumière filtre par la serrure et la
//                    jointure (plus vive et plus longue pour les raretés hautes)
//   2. ouverture   — le couvercle pivote sur sa charnière, un faisceau jaillit,
//                    halo radial ; onde de choc pour Épique et Légendaire
//   3. révélation  — l'objet s'élève hors du coffre dans le faisceau, des
//                    étincelles montent, le texte apparaît
// Tout reste monté du début à la fin : seules les valeurs animées changent
// (démonter une vue pendant une animation l'interrompait).
// Un tap pendant la charge passe directement au résultat.

const LIGHT = { common: '#E5E7EB', rare: '#7DB4FF', epic: '#C99BFF', legendary: '#FFC46B' };

const STAGING = {
  common:    { tilts: [2.5, 4],          leak: 0.45, bloom: 0.35, shock: false, rays: false, sparks: 5 },
  rare:      { tilts: [2.5, 4, 6],       leak: 0.7,  bloom: 0.5,  shock: false, rays: false, sparks: 8 },
  epic:      { tilts: [2.5, 4, 6],       leak: 0.9,  bloom: 0.7,  shock: true,  rays: true,  sparks: 12 },
  legendary: { tilts: [2.5, 4, 6, 8],    leak: 1,    bloom: 0.9,  shock: true,  rays: true,  sparks: 18 },
};

const CHEST = 200;
const STAGE_H = 360;
const HINGE_Y = 250;   // charnière du couvercle dans la scène (centre du coffre)
const ITEM_Y = 118;    // centre de l'objet révélé
const MEDAL = 132;

export default function ChestOpeningModal({ visible, drawnItem, chestsLeft = 0, onClose, onOpenAnother }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const W = Math.min(width - 48, 420);
  const [done, setDone] = useState(false);

  const rarityKey = drawnItem?.rarity in STAGING ? drawnItem.rarity : 'common';
  const stage = STAGING[rarityKey];
  const light = LIGHT[rarityKey];
  const rarity = RARITY_META[rarityKey] ?? RARITY_META.common;
  const item = drawnItem ? ITEM_CATALOG[drawnItem.itemType] : null;

  const a = useRef({
    enter: new Animated.Value(0), tilt: new Animated.Value(0), leak: new Animated.Value(0),
    lid: new Animated.Value(0), beam: new Animated.Value(0), bloom: new Animated.Value(0),
    shock: new Animated.Value(0), item: new Animated.Value(0), chestOut: new Animated.Value(0),
    text: new Animated.Value(0), float: new Animated.Value(0), rays: new Animated.Value(0),
  }).current;
  const sparks = useRef(Array.from({ length: 18 }, () => new Animated.Value(0))).current;
  const sparkSeeds = useMemo(() => sparks.map((_, i) => ({
    x: ((i * 37) % 160) - 80, size: 5 + ((i * 7) % 6), delay: (i * 230) % 1600, dur: 1700 + ((i * 113) % 900),
  })), [sparks]);
  const running = useRef([]);   // séquence d'ouverture
  const idle = useRef([]);      // texte + boucles du résultat

  const stopList = (ref) => { ref.current.forEach((r) => r.stop()); ref.current = []; };
  const stopAll = useCallback(() => { stopList(running); stopList(idle); }, []);
  const run = useCallback((anim, cb) => { running.current.push(anim); anim.start(cb); }, []);
  const runIdle = useCallback((anim) => { idle.current.push(anim); anim.start(); }, []);

  const startIdle = useCallback(() => {
    if (reduced) return;
    runIdle(Animated.loop(Animated.sequence([
      Animated.timing(a.float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a.float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])));
    if (stage.rays) runIdle(Animated.loop(Animated.timing(a.rays, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })));
    sparks.slice(0, stage.sparks).forEach((v, i) => {
      v.setValue(0);
      runIdle(Animated.loop(Animated.sequence([
        Animated.delay(sparkSeeds[i].delay),
        Animated.timing(v, { toValue: 1, duration: sparkSeeds[i].dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ])));
    });
  }, [reduced, stage, runIdle, a, sparks, sparkSeeds]);

  // État final (fin d'animation, tap pour passer, mode réduit). Le texte et
  // les boucles démarrent APRÈS le rendu (effet sur `done`) : lancés pendant
  // le changement d'état, ils étaient interrompus par le re-rendu.
  const instantRef = useRef(false);
  const finish = useCallback((instant) => {
    stopAll();
    a.tilt.setValue(0); a.leak.setValue(0); a.enter.setValue(1); a.lid.setValue(1);
    a.beam.setValue(1); a.item.setValue(1); a.chestOut.setValue(1); a.shock.setValue(1);
    a.bloom.setValue(stage.bloom * 0.6);
    instantRef.current = instant;
    setDone(true);
  }, [stage, stopAll, a]);

  useEffect(() => {
    if (!done || !visible) return undefined;
    if (instantRef.current) a.text.setValue(1);
    else runIdle(Animated.timing(a.text, { toValue: 1, duration: 280, useNativeDriver: true }));
    startIdle();
    return () => stopList(idle);
  }, [done, visible, a, runIdle, startIdle]);

  // Fermé (ou en attente du coffre suivant) : prêt pour une nouvelle ouverture.
  useEffect(() => { if (!visible) setDone(false); }, [visible]);

  useEffect(() => {
    if (!visible || !drawnItem) return undefined;
    setDone(false);
    Object.values(a).forEach((v) => v.setValue(0));
    sparks.forEach((v) => v.setValue(0));

    if (reduced) {
      haptics.success();
      finish(false);
      return stopAll;
    }

    const T = (v, toValue, duration, easing = Easing.out(Easing.cubic)) =>
      Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });
    const n = stage.tilts.length;
    const charge = stage.tilts.flatMap((deg, i) => [
      Animated.parallel([
        Animated.sequence([
          T(a.tilt, deg, 70, Easing.out(Easing.quad)),
          T(a.tilt, -deg, 130, Easing.inOut(Easing.quad)),
          T(a.tilt, deg * 0.5, 100, Easing.inOut(Easing.quad)),
          T(a.tilt, 0, 90, Easing.out(Easing.quad)),
        ]),
        T(a.leak, (stage.leak * (i + 1)) / n, 300),
      ]),
      Animated.delay(i === n - 1 ? 120 : 200),
    ]);

    const burst = Animated.parallel([
      Animated.timing(a.lid, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      T(a.leak, 0, 300),
      T(a.beam, 1, 520),
      Animated.sequence([T(a.bloom, stage.bloom, 220), T(a.bloom, stage.bloom * 0.6, 900)]),
      stage.shock ? T(a.shock, 1, 900, Easing.out(Easing.quad)) : Animated.delay(0),
      Animated.sequence([
        Animated.delay(160),
        Animated.spring(a.item, { toValue: 1, friction: 7, tension: 46, useNativeDriver: true }),
      ]),
      Animated.sequence([Animated.delay(520), T(a.chestOut, 1, 520, Easing.inOut(Easing.cubic))]),
    ]);

    run(Animated.sequence([
      Animated.spring(a.enter, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.delay(180),
      ...charge,
    ]), ({ finished }) => {
      if (!finished) return;
      if (rarityKey === 'epic' || rarityKey === 'legendary') haptics.heavy(); else haptics.success();
      run(burst, ({ finished: ok }) => { if (ok) finish(false); });
    });

    return stopAll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, drawnItem]);

  if (!visible || !drawnItem) return null;

  const skip = () => { if (!done) finish(true); };
  const chestLeft = (W - CHEST) / 2;
  const chestTop = HINGE_Y - CHEST / 2;
  const tone = rarity.text || rarity.color;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={done ? onClose : skip}>
      <Pressable
        style={styles.backdrop}
        onPress={done ? undefined : skip}
        accessible={!done}
        accessibilityRole={done ? undefined : 'button'}
        accessibilityLabel={done ? undefined : 'Ouverture du coffre. Touche pour voir le résultat.'}
      >
        <View style={[styles.stage, { width: W }]} pointerEvents="none">
          {/* Halo radial */}
          <Animated.View style={[styles.abs, { left: W / 2 - 300, top: ITEM_Y + 40 - 300, opacity: a.bloom }]}>
            <Glow size={600} color={light} />
          </Animated.View>

          {/* Rayons (épique et légendaire) */}
          {stage.rays ? (
            <Animated.View
              style={[styles.abs, {
                left: W / 2 - 230, top: ITEM_Y - 230,
                opacity: a.item.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                transform: [{ rotate: a.rays.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
              }]}
            >
              <Rays size={460} color={light} count={rarityKey === 'legendary' ? 14 : 10} />
            </Animated.View>
          ) : null}

          {/* Lueur derrière le coffre pendant la charge */}
          <Animated.View style={[styles.abs, { left: W / 2 - 180, top: HINGE_Y - 180, opacity: a.leak }]}>
            <Glow size={360} color={light} />
          </Animated.View>

          {/* Faisceau qui jaillit du coffre (ancré en bas) */}
          <Animated.View
            style={[styles.abs, {
              left: W / 2 - 100, top: 0, width: 200, height: HINGE_Y,
              opacity: a.beam.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.85] }),
              transform: [
                { translateY: a.beam.interpolate({ inputRange: [0, 1], outputRange: [HINGE_Y / 2, 0] }) },
                { scaleY: a.beam.interpolate({ inputRange: [0, 1], outputRange: [0.01, 1] }) },
              ],
            }]}
          >
            <Beam width={200} height={HINGE_Y} color={light} />
          </Animated.View>

          {/* Coffre */}
          <Animated.View
            style={[styles.abs, {
              left: chestLeft, top: chestTop, width: CHEST, height: CHEST,
              opacity: Animated.multiply(a.enter, a.chestOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
              transform: [
                { translateY: a.enter.interpolate({ inputRange: [0, 1], outputRange: [-36, 0] }) },
                { translateY: a.chestOut.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) },
                { scale: a.chestOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
              ],
            }]}
          >
            <View style={StyleSheet.absoluteFill}><ChestShadow size={CHEST} /></View>
            <Animated.View style={[StyleSheet.absoluteFill, {
              transform: [
                { translateY: 60 },
                { rotate: a.tilt.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) },
                { translateY: -60 },
              ],
            }]}>
              <View style={StyleSheet.absoluteFill}><ChestBody size={CHEST} /></View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.lid }]}>
                <ChestInterior size={CHEST} color={light} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: a.leak }]}>
                <ChestLeak size={CHEST} color={light} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, {
                transform: [
                  { perspective: 700 },
                  { rotateX: a.lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-78deg'] }) },
                ],
              }]}>
                <ChestLid size={CHEST} />
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* Onde de choc */}
          {stage.shock ? (
            <Animated.View style={[styles.abs, styles.shock, {
              left: W / 2 - 80, top: ITEM_Y - 80, borderColor: light,
              opacity: a.shock.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.8, 0] }),
              transform: [{ scale: a.shock.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.6] }) }],
            }]} />
          ) : null}

          {/* Étincelles qui montent */}
          {sparks.slice(0, stage.sparks).map((v, i) => (
            <Animated.View
              key={i}
              style={[styles.abs, {
                left: W / 2 + sparkSeeds[i].x, top: HINGE_Y - 20,
                opacity: v.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
                transform: [
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -200] }) },
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) },
                ],
              }]}
            >
              <Sparkle size={sparkSeeds[i].size * 2} color={i % 3 === 0 ? '#FFFFFF' : light} />
            </Animated.View>
          ))}

          {/* Objet révélé */}
          <Animated.View style={[styles.abs, {
            left: W / 2 - MEDAL / 2, top: ITEM_Y - MEDAL / 2,
            opacity: a.item.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: a.item.interpolate({ inputRange: [0, 1], outputRange: [HINGE_Y - ITEM_Y, 0] }) },
              { translateY: a.float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
              { scale: a.item.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
            ],
          }]}>
            <Medallion icon={item?.icon ?? 'help-circle-outline'} color={light} />
          </Animated.View>
        </View>

        {/* Texte et actions */}
        <Animated.View
          pointerEvents={done ? 'auto' : 'none'}
          style={[styles.panel, {
            opacity: a.text,
            transform: [{ translateY: a.text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }]}
          accessibilityViewIsModal={done}
        >
          <Text style={[styles.rarityLabel, { color: tone }]}>{rarity.label}</Text>
          <Text style={styles.itemName} accessibilityRole="header">{item?.name ?? drawnItem.itemType}</Text>
          {item?.effect ? (
            <View style={[styles.effectPill, { borderColor: `${light}66`, backgroundColor: `${light}14` }]}>
              <Text style={[styles.effectTxt, { color: light }]}>{item.effect}</Text>
            </View>
          ) : null}
          <Text style={styles.itemDesc}>{item?.description ?? ''}</Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: rarity.color }, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={[styles.primaryTxt, { color: readableOn(rarity.color) }]}>Récupérer</Text>
          </Pressable>
          {chestsLeft > 0 && onOpenAnother ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={onOpenAnother}
            >
              <Text style={styles.secondaryTxt}>
                Ouvrir le suivant · {chestsLeft} restant{chestsLeft > 1 ? 's' : ''}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>

        {!done ? <Text style={styles.hint}>Touche pour passer</Text> : null}
      </Pressable>
    </Modal>
  );
}

// ─── Éléments de lumière ──────────────────────────────────────────────────────

function Glow({ size, color }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="cgGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity="0.55" />
          <Stop offset="0.35" stopColor={color} stopOpacity="0.18" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#cgGlow)" />
    </Svg>
  );
}

function Beam({ width: w, height, color }) {
  return (
    <Svg width={w} height={height}>
      <Defs>
        <LinearGradient id="cgBeam" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.14" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="0.38" stopColor={color} stopOpacity="0.8" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {/* Couches superposées de plus en plus étroites : bords doux, cœur vif */}
      {[1, 0.78, 0.56, 0.34, 0.16].map((k) => {
        const b = (w * 0.88 * k) / 2, t = (w * 0.4 * k) / 2, c = w / 2;
        return <Path key={k} d={`M${c - b},${height} L${c - t},0 L${c + t},0 L${c + b},${height} Z`} fill="url(#cgBeam)" opacity={0.32} />;
      })}
    </Svg>
  );
}

function Rays({ size, color, count }) {
  const c = size / 2;
  const d = Array.from({ length: count }, (_, i) => {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + (Math.PI / count) * 0.5;
    return `M${c},${c} L${c + c * Math.cos(a0)},${c + c * Math.sin(a0)} L${c + c * Math.cos(a1)},${c + c * Math.sin(a1)} Z`;
  }).join(' ');
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="cgRays" cx="50%" cy="50%" r="50%">
          <Stop offset="0.15" stopColor={color} stopOpacity="0.5" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path d={d} fill="url(#cgRays)" />
    </Svg>
  );
}

function Sparkle({ size, color }) {
  const s = size / 2;
  return (
    <Svg width={size} height={size}>
      <Path d={`M${s},0 Q${s},${s} ${size},${s} Q${s},${s} ${s},${size} Q${s},${s} 0,${s} Q${s},${s} ${s},0 Z`} fill={color} />
    </Svg>
  );
}

function Medallion({ icon, color }) {
  const r = MEDAL / 2;
  return (
    <View style={{ width: MEDAL, height: MEDAL, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={MEDAL} height={MEDAL} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="cgMedal" cx="50%" cy="38%" r="62%">
            <Stop offset="0" stopColor={color} stopOpacity="0.55" />
            <Stop offset="0.6" stopColor="#14141C" stopOpacity="1" />
            <Stop offset="1" stopColor="#0B0B12" stopOpacity="1" />
          </RadialGradient>
          <LinearGradient id="cgRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="0.45" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0.35" />
          </LinearGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r - 2} fill="url(#cgMedal)" />
        <Circle cx={r} cy={r} r={r - 3} fill="none" stroke="url(#cgRing)" strokeWidth={3} />
        <Circle cx={r} cy={r} r={r - 11} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={1} />
      </Svg>
      <Ionicons
        name={icon}
        size={56}
        color="#FFFFFF"
        style={{ textShadowColor: color, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,4,8,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stage: { height: STAGE_H },
  abs: { position: 'absolute' },
  shock: { width: 160, height: 160, borderRadius: 80, borderWidth: 2 },
  hint: { position: 'absolute', bottom: 56, color: Colors.textSecondary, fontSize: 13 },

  panel: { alignItems: 'center', width: '100%', maxWidth: 400, marginTop: -8 },
  rarityLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 6 },
  itemName: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  effectPill: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  effectTxt: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  itemDesc: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10, marginBottom: 24 },
  primaryBtn: { alignSelf: 'stretch', minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
  secondaryBtn: { alignSelf: 'stretch', minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  secondaryTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
