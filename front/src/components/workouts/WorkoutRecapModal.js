import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  AccessibilityInfo,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { xpToLevel, getRank } from '../../services';
import { QUEST_XP, BONUS_XP } from '../../services';

const RANK_ICONS = {
  novice:      'shield-outline',
  initiate:    'star-outline',
  athlete:     'body-outline',
  competitor:  'trophy-outline',
  warrior:     'flame',
  elite:       'ribbon-outline',
  master:      'medal-outline',
  grandmaster: 'medal',
  legend:      'star',
  god:         'flash',
};
function getRankIcon(tier) { return RANK_ICONS[tier] || 'star-outline'; }

// 665 → « 665 kg » ; 6 300 → « 6,3 t »
function formatVolume(v) {
  const n = Math.round(Number(v) || 0);
  if (n >= 1000) return `${String(Math.round(n / 100) / 10).replace('.', ',')} t`;
  return `${n.toLocaleString('fr-FR')} kg`;
}

function formatDuration(s) {
  const total = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props :
//   visible        bool
//   onClose        () → navigation vers tableau de bord
//   stats          { totalVolume, setsCompleted, totalSets?, durationSeconds, xpEarned }
//   newPRs         Array<{ name, oldPR, newPR }>
//   prevTotalXP    number  — XP cumulé AVANT cette séance
//   workoutName    string  — nom de la séance (sous-titre)
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutRecapModal({
  visible,
  onClose,
  stats = null,
  newPRs = [],
  prevTotalXP = 0,
  completedQuests = [],
  bonusUnlocked = false,
  workoutName = '',
}) {
  const insets = useSafeAreaInsets();
  // Sur Android (nouvelle architecture), le conteneur racine d'une Modal
  // transparente n'a pas toujours la taille de l'écran : une couche en
  // « absoluteFill » s'y calait et le récap ne couvrait qu'une partie de
  // l'écran (contenu invisible, séance visible dessous). On impose donc la
  // taille réelle de l'écran, en pixels. La hauteur de la fenêtre n'inclut
  // pas la barre de navigation : on prend celle de l'écran pour passer dessous.
  const { width: winW, height: windowH } = useWindowDimensions();
  const winH = Math.max(windowH, Dimensions.get('screen').height);

  // Réduction des animations demandée par l'appareil : on affiche directement
  // les valeurs finales (compteur XP, barre de niveau).
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReducedMotion(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const fade      = useRef(new Animated.Value(0)).current;
  const bodyScale = useRef(new Animated.Value(0.88)).current;
  const xpScale   = useRef(new Animated.Value(0.75)).current;

  // Compteur XP animé
  const xpCounter   = useRef(new Animated.Value(0)).current;
  const [displayedXP, setDisplayedXP] = useState(0);

  // Barre de progression niveau
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pulse du label XP (scale) pour accentuer l'animation
  const xpPulse = useRef(new Animated.Value(1)).current;

  // ── Rank-up overlay ──────────────────────────────────────────────────────────
  const rankOverlayOpacity = useRef(new Animated.Value(0)).current;
  const rankBadgeScale     = useRef(new Animated.Value(0.05)).current;
  const rankBadgeOpacity   = useRef(new Animated.Value(0)).current;
  const glowScale1         = useRef(new Animated.Value(0.5)).current;
  const glowScale2         = useRef(new Animated.Value(0.5)).current;
  const glowOpacity1       = useRef(new Animated.Value(0)).current;
  const glowOpacity2       = useRef(new Animated.Value(0)).current;
  const rankNamePulse      = useRef(new Animated.Value(1)).current;
  const tapHintOpacity     = useRef(new Animated.Value(0)).current;
  const levelBounce        = useRef(new Animated.Value(1)).current;
  const [rankAnimVisible, setRankAnimVisible] = useState(false);

  // ── Rank-up cinematic overlay ─────────────────────────────────────────────────
  const rkOverlayOpacity = useRef(new Animated.Value(0)).current;
  const rkCardY          = useRef(new Animated.Value(80)).current;
  const rkCardOpacity    = useRef(new Animated.Value(0)).current;
  const rkCardScale      = useRef(new Animated.Value(0.85)).current;
  const rkRing1Scale     = useRef(new Animated.Value(0.3)).current;
  const rkRing1Opacity   = useRef(new Animated.Value(0)).current;
  const rkRing2Scale     = useRef(new Animated.Value(0.3)).current;
  const rkRing2Opacity   = useRef(new Animated.Value(0)).current;
  const rkRing3Scale     = useRef(new Animated.Value(0.3)).current;
  const rkRing3Opacity   = useRef(new Animated.Value(0)).current;
  const rkTitleScale     = useRef(new Animated.Value(2.8)).current;
  const rkTitleOpacity   = useRef(new Animated.Value(0)).current;
  const rkIconScale      = useRef(new Animated.Value(0)).current;
  const rkSubtitleOp     = useRef(new Animated.Value(0)).current;
  const rkTapOpacity     = useRef(new Animated.Value(0)).current;
  const rkBorderPulse    = useRef(new Animated.Value(0.2)).current;
  const [rankUpAnimVisible, setRankUpAnimVisible] = useState(false);

  // ── Dérivations métier ──────────────────────────────────────────────────────
  const safeStats     = stats || {};
  const xpEarned      = Math.round(Number(safeStats.xpEarned) || 0);
  const totalVolume   = Math.round(Number(safeStats.totalVolume) || 0);
  const setsCompleted = Number(safeStats.setsCompleted) || 0;
  const totalSets     = Number(safeStats.totalSets) || setsCompleted;
  const duration      = formatDuration(safeStats.durationSeconds);
  const hasPRs        = Array.isArray(newPRs) && newPRs.length > 0;
  const hasQuests     = (Array.isArray(completedQuests) && completedQuests.length > 0) || bonusUnlocked;

  // ── Détail XP ────────────────────────────────────────────────────────────────
  const dailyCapReached  = !!safeStats.dailyCapReached;
  const questXPEarned    = Math.round(Number(safeStats.questXP) || 0);
  const xpMultiplier     = Number(safeStats.xpMultiplier) || 1.0;
  const workoutXP        = xpEarned - questXPEarned;
  const baseXP           = xpMultiplier > 1 ? Math.round(workoutXP / xpMultiplier) : workoutXP;
  const streakBonusXP    = workoutXP - baseXP;
  const hasXPBreakdown   = !dailyCapReached && (streakBonusXP > 0 || questXPEarned > 0);

  const prevXP        = Math.max(0, prevTotalXP);
  const newXP         = prevXP + xpEarned;

  const prevLevelData = xpToLevel(prevXP);
  const newLevelData  = xpToLevel(newXP);
  const prevLevel     = prevLevelData.level;
  const newLevel      = newLevelData.level;
  const leveledUp     = newLevel > prevLevel;

  const prevProgress  = prevLevelData.progress;
  const newProgress   = leveledUp ? 1 : newLevelData.progress;

  const newRank       = getRank(newLevel);
  const prevRank      = getRank(prevLevel);
  const rankChanged   = newRank.tier !== prevRank.tier;

  // ── Anim d'entrée ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      bodyScale.setValue(0.88);
      xpScale.setValue(0.75);
      return undefined;
    }

    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(bodyScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.spring(xpScale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();

    return undefined;
  }, [visible, fade, bodyScale, xpScale]);

  // ── Rank-up sequence ─────────────────────────────────────────────────────────
  const dismissRankAnim = useCallback(() => {
    Animated.timing(rankOverlayOpacity, {
      toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => setRankAnimVisible(false));
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
  }, [rankOverlayOpacity]);

  useEffect(() => {
    if (!visible || !leveledUp || rankChanged) {
      if (!visible) setRankAnimVisible(false);
      return undefined;
    }
    rankOverlayOpacity.setValue(0);
    rankBadgeScale.setValue(0.05);
    rankBadgeOpacity.setValue(0);
    glowScale1.setValue(0.5);
    glowScale2.setValue(0.5);
    glowOpacity1.setValue(0);
    glowOpacity2.setValue(0);
    rankNamePulse.setValue(1);
    tapHintOpacity.setValue(0);
    setRankAnimVisible(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}

    Animated.sequence([
      Animated.delay(650),
      Animated.timing(rankOverlayOpacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(rankBadgeScale, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }),
        Animated.timing(rankBadgeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glowOpacity1, { toValue: 0.65, duration: 800, useNativeDriver: true }),
        Animated.timing(glowScale1, { toValue: 2.6, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(glowOpacity2, { toValue: 0.38, duration: 900, useNativeDriver: true }),
            Animated.timing(glowScale2, { toValue: 3.8, duration: 2100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
        ]),
      ]),
      Animated.sequence([
        Animated.timing(rankNamePulse, { toValue: 1.16, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(rankNamePulse, { toValue: 1, friction: 3, tension: 280, useNativeDriver: true }),
      ]),
      Animated.timing(tapHintOpacity, { toValue: 0.55, duration: 550, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(dismissRankAnim, 5500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leveledUp, rankChanged]);

  // ── Rank-up cinematic sequence ───────────────────────────────────────────────
  const dismissRankUpAnim = useCallback(() => {
    Animated.timing(rkOverlayOpacity, {
      toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => setRankUpAnimVisible(false));
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
  }, [rkOverlayOpacity]);

  useEffect(() => {
    if (!visible || !rankChanged) {
      if (!visible) setRankUpAnimVisible(false);
      return undefined;
    }
    rkOverlayOpacity.setValue(0);
    rkCardY.setValue(80); rkCardOpacity.setValue(0); rkCardScale.setValue(0.85);
    rkRing1Scale.setValue(0.3); rkRing1Opacity.setValue(0);
    rkRing2Scale.setValue(0.3); rkRing2Opacity.setValue(0);
    rkRing3Scale.setValue(0.3); rkRing3Opacity.setValue(0);
    rkTitleScale.setValue(2.8); rkTitleOpacity.setValue(0);
    rkIconScale.setValue(0); rkSubtitleOp.setValue(0);
    rkTapOpacity.setValue(0); rkBorderPulse.setValue(0.2);
    setRankUpAnimVisible(true);

    const timers = [];
    const at = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); };

    // T+600 : overlay fond + 3 anneaux de choc simultanés
    at(600, () => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      Animated.timing(rkOverlayOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      Animated.parallel([
        Animated.timing(rkRing1Scale,   { toValue: 5.5, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rkRing1Opacity, { toValue: 0.85, duration: 200, useNativeDriver: true }),
          Animated.timing(rkRing1Opacity, { toValue: 0, duration: 1800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    });
    at(730, () => {
      Animated.parallel([
        Animated.timing(rkRing2Scale,   { toValue: 4.0, duration: 1900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rkRing2Opacity, { toValue: 0.65, duration: 200, useNativeDriver: true }),
          Animated.timing(rkRing2Opacity, { toValue: 0, duration: 1500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    });
    at(860, () => {
      Animated.parallel([
        Animated.timing(rkRing3Scale,   { toValue: 2.6, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(rkRing3Opacity, { toValue: 0.50, duration: 300, useNativeDriver: true }),
          Animated.timing(rkRing3Opacity, { toValue: 0.15, duration: 900, useNativeDriver: true }),
        ]),
      ]).start();
    });

    // T+800 : carte remonte avec spring + haptic lourd
    at(800, () => {
      Animated.parallel([
        Animated.spring(rkCardY,        { toValue: 0,   friction: 7, tension: 65, useNativeDriver: true }),
        Animated.timing(rkCardOpacity,  { toValue: 1,   duration: 280,            useNativeDriver: true }),
        Animated.spring(rkCardScale,    { toValue: 1,   friction: 7, tension: 65, useNativeDriver: true }),
      ]).start();
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) {}
    });

    // T+1100 : icône rebondit
    at(1100, () => {
      Animated.spring(rkIconScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }).start();
    });

    // T+1380 : nom du rang ZOOM depuis 2.8× → 1× + haptic lourd
    at(1380, () => {
      Animated.parallel([
        Animated.timing(rkTitleScale,   { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rkTitleOpacity, { toValue: 1, duration: 280,                                   useNativeDriver: true }),
      ]).start();
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) {}
    });

    // T+1680 : sous-titre (niveau + transition)
    at(1680, () => {
      Animated.timing(rkSubtitleOp, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    });

    // T+1900 : bord pulsant en boucle
    at(1900, () => {
      const pulse = () => Animated.sequence([
        Animated.timing(rkBorderPulse, { toValue: 0.75, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rkBorderPulse, { toValue: 0.20, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) pulse(); });
      pulse();
    });

    // T+2500 : invite à appuyer
    at(2500, () => {
      Animated.timing(rkTapOpacity, { toValue: 0.55, duration: 700, useNativeDriver: true }).start();
    });

    // Auto-dismiss à 10s
    at(10000, dismissRankUpAnim);

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, rankChanged]);

  // ── Compteur XP + barre + pulse ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      xpCounter.setValue(0);
      setDisplayedXP(0);
      progressAnim.setValue(prevProgress);
      xpPulse.setValue(1);
      levelBounce.setValue(1);
      return;
    }

    if (reducedMotion) {
      setDisplayedXP(xpEarned);
      progressAnim.setValue(newProgress);
      return undefined;
    }

    const listener = xpCounter.addListener(({ value }) => setDisplayedXP(Math.round(value)));
    progressAnim.setValue(prevProgress);

    Animated.parallel([
      Animated.timing(xpCounter, {
        toValue: xpEarned,
        duration: 1400,
        delay: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: newProgress,
        duration: 1100,
        delay: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Micro-pulse à la fin du compteur pour accentuer l'effet
      Animated.sequence([
        Animated.timing(xpPulse, { toValue: 1.08, duration: 120, useNativeDriver: true }),
        Animated.spring(xpPulse, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
      if (leveledUp) {
        Animated.sequence([
          Animated.delay(80),
          Animated.spring(levelBounce, { toValue: 1.07, friction: 3, tension: 180, useNativeDriver: true }),
          Animated.spring(levelBounce, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        ]).start();
      }
    });

    return () => xpCounter.removeListener(listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reducedMotion]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View style={[styles.overlay, { width: winW, height: winH, opacity: fade }]}>

        {/* Plein écran : le contenu est centré s'il tient, et défile sinon.
            (L'ancienne carte à hauteur max figée au chargement sortait de
            l'écran sur Android en bord à bord.) */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          bounces
          overScrollMode="never"
        >
          <Animated.View style={[styles.content, { transform: [{ scale: bodyScale }] }]}>

            {/* ── Emblème + titre ── */}
            <View style={styles.hero}>
              <View style={[styles.emblem, { borderColor: newRank.color + '55', backgroundColor: newRank.color + '18' }]}>
                <Ionicons name="checkmark" size={34} color={newRank.color} />
              </View>
              <Text style={styles.title} accessibilityRole="header">Séance terminée</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {workoutName ? `${workoutName} · bien joué !` : 'Bien joué !'}
              </Text>
            </View>

            {/* ── XP gagnée (compteur animé) ── */}
            <Animated.View style={[styles.xpBlock, { transform: [{ scale: xpScale }] }]}>
              {dailyCapReached ? (
                <>
                  <Text style={[styles.xpValue, { color: Colors.textMuted }]}>+0<Text style={styles.xpUnit}> XP</Text></Text>
                  <View style={styles.capBadge}>
                    <Ionicons name="time-outline" size={15} color={Colors.textSecondary} />
                    <Text style={styles.capText}>Limite d'XP du jour atteinte. Reviens demain pour en gagner à nouveau.</Text>
                  </View>
                </>
              ) : (
                <>
                  <Animated.Text
                    style={[styles.xpValue, { color: newRank.color, transform: [{ scale: xpPulse }] }]}
                    accessibilityLabel={`${xpEarned} XP gagnés`}
                  >
                    +{displayedXP.toLocaleString('fr-FR')}
                    <Text style={styles.xpUnit}> XP</Text>
                  </Animated.Text>
                  <Text style={styles.xpCaption}>gagnés sur cette séance</Text>
                </>
              )}
            </Animated.View>

            {/* ── Niveau ── */}
            <Animated.View style={[styles.card, { transform: [{ scale: levelBounce }] }]}>
              <View style={styles.levelHeader}>
                <View style={[styles.levelPill, { backgroundColor: newRank.color + '1F' }]}>
                  <Text style={[styles.levelPillText, { color: newRank.color }]}>Niveau {newLevel}</Text>
                </View>
                <Text style={styles.rankName} numberOfLines={1}>{newRank.name}</Text>
                <Text style={styles.levelXPText}>
                  {newLevelData.currentInLevel.toLocaleString('fr-FR')} / {newLevelData.neededForNext.toLocaleString('fr-FR')} XP
                </Text>
              </View>
              <View style={styles.levelTrack}>
                <Animated.View
                  style={[
                    styles.levelFill,
                    { backgroundColor: newRank.color },
                    { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              </View>
              <Text style={styles.levelHint}>
                {leveledUp
                  ? (rankChanged ? `Nouveau rang débloqué : ${newRank.name} !` : `Niveau ${newLevel} atteint !`)
                  : `Encore ${Math.max(0, newLevelData.neededForNext - newLevelData.currentInLevel).toLocaleString('fr-FR')} XP pour le niveau ${newLevel + 1}`}
              </Text>

              {/* Détail du calcul XP */}
              {hasXPBreakdown && (
                <View style={styles.xpDetail}>
                  <View style={styles.xpDetailRow}>
                    <Text style={styles.xpDetailLabel}>Séance</Text>
                    <Text style={styles.xpDetailValue}>+{baseXP.toLocaleString('fr-FR')} XP</Text>
                  </View>
                  {streakBonusXP > 0 && (
                    <View style={styles.xpDetailRow}>
                      <Text style={styles.xpDetailLabel}>Bonus régularité ×{String(xpMultiplier).replace('.', ',')}</Text>
                      <Text style={[styles.xpDetailValue, { color: Colors.primary }]}>+{streakBonusXP.toLocaleString('fr-FR')} XP</Text>
                    </View>
                  )}
                  {questXPEarned > 0 && (
                    <View style={styles.xpDetailRow}>
                      <Text style={styles.xpDetailLabel}>Bonus quêtes</Text>
                      <Text style={[styles.xpDetailValue, { color: Colors.gold }]}>+{questXPEarned.toLocaleString('fr-FR')} XP</Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>

            {/* ── Chiffres de la séance ── */}
            <View style={styles.kpisRow}>
              <Kpi icon="time-outline" label="Durée" value={duration} />
              <Kpi icon="barbell-outline" label="Volume" value={formatVolume(totalVolume)} />
              <Kpi icon="checkmark-done" label="Séries" value={`${setsCompleted}/${totalSets}`} />
            </View>

            {/* ── Records battus ── */}
            {hasPRs ? (
              <View style={[styles.card, styles.prCard]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trophy" size={17} color={Colors.gold} />
                  <Text style={styles.sectionTitle}>
                    {newPRs.length === 1 ? 'Nouveau record' : `${newPRs.length} nouveaux records`}
                  </Text>
                </View>
                {newPRs.slice(0, 3).map((pr, i) => (
                  <View key={`pr-${i}`} style={[styles.prRow, i > 0 && styles.rowBorder]}>
                    <Text style={styles.prName} numberOfLines={1}>{pr.name}</Text>
                    <Text style={styles.prValues}>
                      {pr.oldPR ? <Text style={styles.prOld}>{`${pr.oldPR} kg  →  `}</Text> : null}
                      <Text style={styles.prNew}>{pr.newPR} kg</Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ── Quêtes accomplies ── */}
            {hasQuests ? (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flash" size={17} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>
                    {completedQuests.length === 1 ? 'Quête accomplie' : `${completedQuests.length} quêtes accomplies`}
                  </Text>
                </View>
                {completedQuests.map((q, i) => (
                  <View key={q.templateId || `q-${i}`} style={[styles.questRow, i > 0 && styles.rowBorder]}>
                    <Ionicons name="checkmark-circle" size={17} color={Colors.valid} />
                    <Text style={styles.questName} numberOfLines={1}>{q.label}</Text>
                    <Text style={styles.questXP}>+{QUEST_XP} XP</Text>
                  </View>
                ))}
                {bonusUnlocked ? (
                  <View style={[styles.questRow, styles.rowBorder]}>
                    <Ionicons name="star" size={17} color={Colors.gold} />
                    <Text style={[styles.questName, { color: Colors.gold }]}>Bonus toutes quêtes</Text>
                    <Text style={[styles.questXP, { color: Colors.gold }]}>+{BONUS_XP} XP</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        {/* ── Action principale, toujours visible ── */}
        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity accessibilityRole="button" style={styles.cta} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Voir mes statistiques</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Rank-up CINEMATIC overlay ────────────────────────────────────── */}
        {rankUpAnimVisible ? (
          <Animated.View style={[styles.rkOverlay, { opacity: rkOverlayOpacity }]}>
            {/* Anneaux de choc */}
            <Animated.View style={[styles.rkRing, { borderColor: newRank.color,         transform: [{ scale: rkRing1Scale }], opacity: rkRing1Opacity }]} />
            <Animated.View style={[styles.rkRing, { borderColor: newRank.color + 'CC', width: 240, height: 240, borderRadius: 120, transform: [{ scale: rkRing2Scale }], opacity: rkRing2Opacity }]} />
            <Animated.View style={[styles.rkRing, { borderColor: newRank.color + '88', width: 180, height: 180, borderRadius:  90, transform: [{ scale: rkRing3Scale }], opacity: rkRing3Opacity }]} />

            {/* Carte cinématique */}
            <Animated.View style={[
              styles.rkCard,
              { borderColor: newRank.color + '60', shadowColor: newRank.color },
              { opacity: rkCardOpacity, transform: [{ translateY: rkCardY }, { scale: rkCardScale }] },
            ]}>
              {/* Lueur de bord pulsante */}
              <Animated.View style={[StyleSheet.absoluteFill, styles.rkBorderGlow, { borderColor: newRank.color, opacity: rkBorderPulse }]} pointerEvents="none" />

              {/* Icône rebondissante */}
              <Animated.View style={[styles.rkIconWrap, { backgroundColor: newRank.color + '1A', borderColor: newRank.color + '44', transform: [{ scale: rkIconScale }] }]}>
                <Ionicons name={getRankIcon(newRank.tier)} size={44} color={newRank.color} />
              </Animated.View>

              <Text style={styles.rkKicker}>Nouveau rang débloqué</Text>

              {/* Nom du rang — ZOOM depuis 2.8× + responsive */}
              <Animated.View style={[styles.rkTitleWrap, { transform: [{ scale: rkTitleScale }], opacity: rkTitleOpacity }]}>
                <Text
                  style={[styles.rkRankName, { color: newRank.color }]}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  minimumFontScale={0.4}
                >
                  {newRank.name.toUpperCase()}
                </Text>
              </Animated.View>

              {/* Niveau + transition ancien → nouveau rang */}
              <Animated.Text style={[styles.rkLevelLine, { color: newRank.color + 'CC', opacity: rkSubtitleOp }]}>
                Niveau {newLevel}
              </Animated.Text>
              <Animated.View style={[styles.rkFromRow, { opacity: rkSubtitleOp }]}>
                <Text style={styles.rkFromOld}>{prevRank.name}</Text>
                <Ionicons name="arrow-forward" size={11} color="rgba(255,255,255,0.3)" style={{ marginHorizontal: 7 }} />
                <Text style={[styles.rkFromNew, { color: newRank.color }]}>{newRank.name}</Text>
              </Animated.View>
            </Animated.View>

            <Animated.Text style={[styles.rkTap, { opacity: rkTapOpacity }]}>
              Appuie pour continuer
            </Animated.Text>
            <TouchableOpacity accessible={false} style={StyleSheet.absoluteFill} onPress={dismissRankUpAnim} activeOpacity={1} />
          </Animated.View>
        ) : null}

        {/* ── Level-up overlay — affiché par-dessus tout ───────────────────── */}
        {rankAnimVisible ? (
          <Animated.View style={[styles.rankOverlayWrap, { opacity: rankOverlayOpacity }]}>
            {/* Anneau de lumière 1 */}
            <Animated.View style={[
              styles.glowRing,
              { borderColor: newRank.color, transform: [{ scale: glowScale1 }], opacity: glowOpacity1 },
            ]} />
            {/* Anneau de lumière 2 */}
            <Animated.View style={[
              styles.glowRing,
              { borderColor: newRank.color + '80', transform: [{ scale: glowScale2 }], opacity: glowOpacity2 },
            ]} />

            {/* Badge central */}
            <Animated.View style={[
              styles.rankUpCard,
              {
                borderColor: newRank.color + '55',
                shadowColor: newRank.color,
                transform: [{ scale: rankBadgeScale }],
                opacity: rankBadgeOpacity,
              },
            ]}>
              <Text style={styles.rankUpKicker}>Niveau atteint !</Text>
              <Animated.Text style={[
                styles.rankUpName,
                { color: newRank.color, transform: [{ scale: rankNamePulse }] },
              ]}>
                {newLevel}
              </Animated.Text>
              <Text style={[styles.rankUpLevel, { color: newRank.color + 'CC' }]}>
                {newRank.name}
              </Text>
            </Animated.View>

            <Animated.Text style={[styles.rankUpTap, { opacity: tapHintOpacity }]}>
              Appuie pour continuer
            </Animated.Text>

            <TouchableOpacity accessible={false}
              style={StyleSheet.absoluteFill}
              onPress={dismissRankAnim}
              activeOpacity={1}
            />
          </Animated.View>
        ) : null}

      </Animated.View>
    </Modal>
  );
}

function Kpi({ icon, label, value }) {
  return (
    <View style={styles.kpi}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond plein : l'écran de séance ne doit pas transparaître derrière le récap.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: Colors.bgAbyss,
  },

  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 14 },

  // ── Emblème + titre ───────────────────────────────────────────────────────
  hero: { alignItems: 'center', marginBottom: 4 },
  emblem: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 15, marginTop: 6, textAlign: 'center' },

  // ── XP ────────────────────────────────────────────────────────────────────
  xpBlock: { alignItems: 'center', paddingVertical: 6 },
  xpValue: { fontSize: 64, fontWeight: '900', letterSpacing: -2, lineHeight: 72, fontVariant: ['tabular-nums'] },
  xpUnit: { fontSize: 26, fontWeight: '800', letterSpacing: 0 },
  xpCaption: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  capBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  capText: { color: Colors.textSecondary, fontSize: 13.5, flex: 1, lineHeight: 19 },

  // ── Cartes ────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },

  // ── Niveau ────────────────────────────────────────────────────────────────
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  levelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  levelPillText: { fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankName: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  levelXPText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  levelTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  levelFill: { height: '100%', borderRadius: 4 },
  levelHint: { color: Colors.textSecondary, fontSize: 13.5, marginTop: 10 },

  xpDetail: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  xpDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  xpDetailLabel: { color: Colors.textSecondary, fontSize: 13.5 },
  xpDetailValue: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // ── Chiffres ──────────────────────────────────────────────────────────────
  kpisRow: { flexDirection: 'row', gap: 10 },
  kpi: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  kpiValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 6, fontVariant: ['tabular-nums'] },
  kpiLabel: { color: Colors.textMuted, fontSize: 12.5, marginTop: 2 },

  // ── Records ───────────────────────────────────────────────────────────────
  prCard: { borderColor: 'rgba(255,215,0,0.25)' },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 10 },
  prName: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '600', flex: 1 },
  prValues: { fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  prOld: { color: Colors.textMuted },
  prNew: { color: Colors.gold, fontWeight: '900' },

  // ── Quêtes ────────────────────────────────────────────────────────────────
  questRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  questName: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '600', flex: 1 },
  questXP: { color: Colors.primary, fontSize: 13.5, fontWeight: '800', flexShrink: 0 },

  // ── Action principale ─────────────────────────────────────────────────────
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  cta: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── Rank-up overlay ───────────────────────────────────────────────────────
  rankOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 4, 10, 0.97)',
  },
  glowRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  rankUpCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(14, 12, 24, 0.98)',
    borderWidth: 1.5,
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 44,
    marginHorizontal: 24,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.9,
    shadowRadius: 50,
    elevation: 24,
  },
  rankUpKicker: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 16,
    textAlign: 'center',
  },
  rankUpName: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 18,
  },
  rankUpLevel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  rankUpTap: {
    position: 'absolute',
    bottom: 56,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // ── Rank-up cinematic styles ──────────────────────────────────────────────
  rkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 2, 8, 0.98)',
  },
  rkRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  rkCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 6, 18, 0.99)',
    borderWidth: 1.5,
    borderRadius: 32,
    paddingVertical: 44,
    paddingHorizontal: 36,
    width: '88%',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1.0,
    shadowRadius: 70,
    elevation: 32,
  },
  rkBorderGlow: {
    borderRadius: 32,
    borderWidth: 3,
  },
  rkIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 22,
  },
  rkTitleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  rkKicker: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  rkRankName: {
    fontSize: 60,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 24,
    marginBottom: 2,
  },
  rkLevelLine: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  rkFromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rkFromOld: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontWeight: '700',
  },
  rkFromNew: {
    fontSize: 14,
    fontWeight: '800',
  },
  rkTap: {
    position: 'absolute',
    bottom: 56,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

});
