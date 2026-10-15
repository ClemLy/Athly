import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { ITEM_CATALOG, RARITY_META, haptics } from '../../services';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { readableOn } from '../../utils/ritualTimer';
import BirthdayConfetti from '../profile/BirthdayConfetti';
import { ChestBody, ChestLid } from './ChestGlyph';

// ─── ChestOpeningModal ────────────────────────────────────────────────────────
// Ouverture de coffre, mise en scène selon la rareté tirée :
//   1. charge  — le coffre tremble ; plus c'est rare, plus il tremble
//                longtemps et plus la lueur qui filtre sous le couvercle est vive
//   2. burst   — le couvercle saute, flash à la couleur de la rareté
//   3. reveal  — l'objet apparaît ; rayons (épique+) et confettis (épique+)
// Un tap pendant la charge passe directement au résultat.
// "Réduire les animations" : simple fondu vers le résultat.
//
// Props : visible, drawnItem { itemType, rarity } | null, chestsLeft,
//         onClose, onOpenAnother (optionnel)

const STAGING = {
  common:    { wobbles: [5, 9],          seam: 0.25, flash: 0.35, rays: false, confetti: false },
  rare:      { wobbles: [5, 9, 13],      seam: 0.6,  flash: 0.5,  rays: false, confetti: false },
  epic:      { wobbles: [5, 9, 13],      seam: 0.85, flash: 0.7,  rays: true,  confetti: true },
  legendary: { wobbles: [4, 8, 12, 16],  seam: 1,    flash: 0.9,  rays: true,  confetti: true },
};

const CHEST = 150;

export default function ChestOpeningModal({ visible, drawnItem, chestsLeft = 0, onClose, onOpenAnother }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState('charge'); // charge | reveal
  const v = useRef({
    enter: new Animated.Value(0),
    shake: new Animated.Value(0),
    seam: new Animated.Value(0),
    lid: new Animated.Value(0),
    flash: new Animated.Value(0),
    item: new Animated.Value(0),
    rays: new Animated.Value(0),
  }).current;
  const seqRef = useRef(null);
  const raysLoop = useRef(null);

  const rarityKey = drawnItem?.rarity in STAGING ? drawnItem.rarity : 'common';
  const stage = STAGING[rarityKey];
  const rarity = RARITY_META[rarityKey] ?? RARITY_META.common;
  const tone = rarity.text || rarity.color;
  const item = drawnItem ? ITEM_CATALOG[drawnItem.itemType] : null;

  // Passe au résultat ; l'animation du résultat démarre une fois l'écran
  // affiché (voir l'effet suivant) : lancée pendant le changement de phase,
  // elle était interrompue par le démontage du coffre.
  const reveal = useCallback(() => {
    seqRef.current?.stop();
    setPhase('reveal');
  }, []);

  useEffect(() => {
    if (phase !== 'reveal' || !visible) return undefined;
    if (rarityKey === 'epic' || rarityKey === 'legendary') haptics.heavy(); else haptics.success();
    const anim = Animated.parallel([
      Animated.timing(v.flash, { toValue: 0, duration: 420, useNativeDriver: true }),
      reduced
        ? Animated.timing(v.item, { toValue: 1, duration: 220, useNativeDriver: true })
        : Animated.spring(v.item, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
    ]);
    anim.start();
    if (stage.rays && !reduced) {
      raysLoop.current = Animated.loop(Animated.timing(v.rays, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
      raysLoop.current.start();
    }
    return () => { anim.stop(); raysLoop.current?.stop(); };
  }, [phase, visible, rarityKey, reduced, stage.rays, v]);

  useEffect(() => {
    if (!visible || !drawnItem) return undefined;
    setPhase('charge');
    Object.values(v).forEach((a) => a.setValue(0));

    if (reduced) {
      const t = setTimeout(reveal, 300);
      Animated.timing(v.enter, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return () => clearTimeout(t);
    }

    const wobble = (amp, ms) => Animated.sequence([
      Animated.timing(v.shake, { toValue: amp, duration: ms / 4, useNativeDriver: true }),
      Animated.timing(v.shake, { toValue: -amp, duration: ms / 2, useNativeDriver: true }),
      Animated.timing(v.shake, { toValue: 0, duration: ms / 4, useNativeDriver: true }),
    ]);
    const n = stage.wobbles.length;
    const charge = stage.wobbles.flatMap((amp, i) => [
      Animated.parallel([
        wobble(amp, 280 - i * 25),
        Animated.timing(v.seam, { toValue: (stage.seam * (i + 1)) / n, duration: 280, useNativeDriver: true }),
      ]),
      Animated.delay(i === n - 1 ? 60 : 140),
    ]);

    seqRef.current = Animated.sequence([
      Animated.spring(v.enter, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.delay(150),
      ...charge,
      Animated.parallel([
        Animated.timing(v.lid, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.flash, { toValue: stage.flash, duration: 120, useNativeDriver: true }),
      ]),
    ]);
    seqRef.current.start(({ finished }) => { if (finished) reveal(); });

    return () => {
      seqRef.current?.stop();
      raysLoop.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, drawnItem]);

  if (!visible || !drawnItem) return null;

  const isReveal = phase === 'reveal';
  const lidStyle = {
    transform: [
      { translateY: v.lid.interpolate({ inputRange: [0, 1], outputRange: [0, -CHEST * 0.42] }) },
      { rotate: v.lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-22deg'] }) },
    ],
    opacity: v.lid.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
  };
  const chestStyle = {
    opacity: isReveal ? 0 : v.enter,
    transform: [
      { translateX: v.shake },
      { scale: v.enter.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
    ],
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={isReveal ? onClose : reveal}>
      <Pressable
        style={styles.backdrop}
        onPress={isReveal ? undefined : reveal}
        accessible={!isReveal}
        accessibilityRole={isReveal ? undefined : 'button'}
        accessibilityLabel={isReveal ? undefined : 'Ouverture du coffre. Touche pour voir le résultat.'}
      >
        {isReveal && stage.confetti && !reduced ? <BirthdayConfetti active /> : null}

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: rarityKey === 'common' ? '#FFFFFF' : tone, opacity: v.flash }]} />

        {/* ── Coffre ── */}
        {!isReveal ? (
          <View style={styles.stage}>
            <Animated.View pointerEvents="none" style={[styles.chestGlow, { backgroundColor: tone, opacity: v.seam.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]} />
            <Animated.View style={chestStyle}>
              <View style={{ width: CHEST, height: CHEST }}>
                <View style={StyleSheet.absoluteFill}><ChestBody size={CHEST} /></View>
                <Animated.View style={[styles.seam, { backgroundColor: tone, opacity: v.seam }]} />
                <Animated.View style={[StyleSheet.absoluteFill, lidStyle]}><ChestLid size={CHEST} /></Animated.View>
              </View>
            </Animated.View>
            <Text style={styles.hint}>Touche pour passer</Text>
          </View>
        ) : (
          <View style={styles.revealWrap} accessibilityViewIsModal>
            <View style={styles.iconStage}>
              {stage.rays && !reduced ? (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.rays, { transform: [{ rotate: v.rays.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
                >
                  <Rays color={tone} />
                </Animated.View>
              ) : null}
              <Animated.View
                style={[
                  styles.itemDisc,
                  { borderColor: tone, backgroundColor: `${rarity.color}26` },
                  { opacity: v.item, transform: [{ scale: v.item.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
                ]}
              >
                <Ionicons name={item?.icon ?? 'help-circle-outline'} size={58} color={tone} />
              </Animated.View>
            </View>

            <Text style={[styles.rarityLabel, { color: tone }]}>{rarity.label}</Text>
            <Text style={styles.itemName} accessibilityRole="header">{item?.name ?? drawnItem.itemType}</Text>
            <Text style={styles.itemDesc}>{item?.description ?? ''}</Text>
            <Text style={styles.addedNote}>Ajouté à ton inventaire</Text>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: rarity.color }, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={[styles.primaryTxt, { color: readableOn(rarity.color) }]}>Continuer</Text>
            </Pressable>
            {chestsLeft > 0 && onOpenAnother ? (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={onOpenAnother}
              >
                <Text style={styles.secondaryTxt}>
                  Ouvrir un autre coffre ({chestsLeft} restant{chestsLeft > 1 ? 's' : ''})
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

// Rayons de lumière derrière l'objet (épique et légendaire).
function Rays({ color }) {
  const n = 12;
  const d = Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n * 0.55;
    const R = 150;
    return `M150,150 L${150 + R * Math.cos(a0)},${150 + R * Math.sin(a0)} L${150 + R * Math.cos(a1)},${150 + R * Math.sin(a1)} Z`;
  }).join(' ');
  return (
    <Svg width={300} height={300} viewBox="0 0 300 300">
      <Path d={d} fill={color} opacity={0.22} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  stage: { alignItems: 'center', justifyContent: 'center' },
  chestGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, top: -45 },
  seam: { position: 'absolute', left: CHEST * 0.12, right: CHEST * 0.12, top: CHEST * 0.47, height: CHEST * 0.04, borderRadius: 2 },
  hint: { color: Colors.textSecondary, fontSize: 13, marginTop: 28 },

  revealWrap: { alignItems: 'center', width: '100%', maxWidth: 400 },
  iconStage: { width: 300, height: 220, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', width: 300, height: 300 },
  itemDisc: {
    width: 128, height: 128, borderRadius: 64, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  rarityLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  itemName: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  itemDesc: { color: Colors.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 6 },
  addedNote: { color: Colors.textMuted, fontSize: 13, marginBottom: 26 },
  primaryBtn: {
    alignSelf: 'stretch', minHeight: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
  secondaryBtn: { alignSelf: 'stretch', minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  secondaryTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
