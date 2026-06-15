import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from 'react-native';

const SCREEN_H = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { xpToLevel, getRank } from '../../services/stats.service';
import { QUEST_XP, BONUS_XP } from '../../services/quest.service';

const LOGO_VIOLET = require('../../../assets/logo-violet.png');

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

let LottieView = null;
let confettiSource = null;
try {
  LottieView = require('lottie-react-native').default;
  confettiSource = require('../../../assets/animations/confetti.json');
} catch (e) {
  LottieView = null;
  confettiSource = null;
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
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkoutRecapModal({
  visible,
  onClose,
  stats = null,
  newPRs = [],
  prevTotalXP = 0,
  completedQuests = [],
  bonusUnlocked = false,
}) {
  const fade      = useRef(new Animated.Value(0)).current;
  const bodyScale = useRef(new Animated.Value(0.88)).current;
  const xpScale   = useRef(new Animated.Value(0.75)).current;
  const lottieRef = useRef(null);

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

    const t = setTimeout(() => {
      try { lottieRef.current && lottieRef.current.play(); } catch (e) {}
    }, 80);

    return () => clearTimeout(t);
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
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fade }]}>

        {LottieView && confettiSource ? (
          <View style={styles.confettiWrap} pointerEvents="none">
            <LottieView
              ref={lottieRef}
              source={confettiSource}
              autoPlay={false}
              loop={false}
              style={styles.confetti}
            />
          </View>
        ) : null}

        <Animated.View style={[styles.body, { transform: [{ scale: bodyScale }], maxHeight: SCREEN_H * 0.9 }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces
            overScrollMode="never"
            contentContainerStyle={styles.scrollContent}
          >

          {/* ── Logo ── */}
          <View style={styles.logoWrap}>
            <Image source={LOGO_VIOLET} style={styles.logo} resizeMode="contain" accessibilityLabel="Logo Athly" />
          </View>

          {/* ── Kicker + Titre ── */}
          <Text style={styles.kicker}>SÉANCE TERMINÉE</Text>
          <Text style={styles.title}>Mission accomplie !</Text>

          {/* ── XP gagné (compteur animé) ── */}
          <Animated.View style={[styles.xpCard, { transform: [{ scale: xpScale }] }, { borderColor: dailyCapReached ? 'rgba(255,255,255,0.12)' : newRank.color + '55' }]}>
            {dailyCapReached ? (
              <>
                <Text style={[styles.xpLabel, { color: Colors.textMuted }]}>XP GAGNÉS</Text>
                <Text style={[styles.xpValue, { color: Colors.textMuted, fontSize: 28, letterSpacing: 0 }]}>
                  +0 XP
                </Text>
                <View style={styles.capBadge}>
                  <Ionicons name="time-outline" size={13} color={Colors.textMuted} style={{ marginRight: 5 }} />
                  <Text style={styles.capText}>Limite quotidienne atteinte — reviens demain !</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.xpLabel, { color: newRank.color }]}>XP GAGNÉS</Text>
                <Animated.Text style={[styles.xpValue, { color: newRank.color, transform: [{ scale: xpPulse }] }]}>
                  +{displayedXP.toLocaleString('fr-FR')}
                </Animated.Text>
              </>
            )}
          </Animated.View>

          {/* ── Détail du calcul XP ── */}
          {hasXPBreakdown && (
            <View style={styles.xpDetail}>
              <View style={styles.xpDetailRow}>
                <Text style={styles.xpDetailLabel}>XP de base</Text>
                <Text style={styles.xpDetailValue}>+{baseXP.toLocaleString('fr-FR')} XP</Text>
              </View>
              {streakBonusXP > 0 && (
                <View style={styles.xpDetailRow}>
                  <Text style={styles.xpDetailLabel}>Bonus Régularité ×{xpMultiplier}</Text>
                  <Text style={[styles.xpDetailValue, { color: '#FE7439' }]}>+{streakBonusXP.toLocaleString('fr-FR')} XP</Text>
                </View>
              )}
              {questXPEarned > 0 && (
                <View style={styles.xpDetailRow}>
                  <Text style={styles.xpDetailLabel}>Bonus Quêtes</Text>
                  <Text style={[styles.xpDetailValue, { color: '#FFD700' }]}>+{questXPEarned.toLocaleString('fr-FR')} XP</Text>
                </View>
              )}
              <View style={styles.xpDetailDivider} />
              <View style={styles.xpDetailRow}>
                <Text style={[styles.xpDetailLabel, styles.xpDetailTotalLabel]}>Total</Text>
                <Text style={[styles.xpDetailValue, styles.xpDetailTotalValue]}>{xpEarned.toLocaleString('fr-FR')} XP</Text>
              </View>
            </View>
          )}

          {/* ── Rang (uniquement si changement de tier) ── */}
          {rankChanged ? (
            <View style={[styles.rankBadge, { borderColor: newRank.color + '55', backgroundColor: newRank.color + '12' }]}>
              <Ionicons name="arrow-up-circle" size={14} color={newRank.color} />
              <Text style={[styles.rankBadgeText, { color: newRank.color }]}>
                {'  '}NOUVEAU RANG : {newRank.name.toUpperCase()}
              </Text>
            </View>
          ) : null}

          {/* ── Barre de progression niveau ── */}
          <Animated.View style={[styles.levelWrap, { transform: [{ scale: levelBounce }] }]}>
            <View style={styles.levelHeader}>
              <Text style={[styles.levelLabel, { color: newRank.color }]}>
                {leveledUp ? `NIVEAU ${newLevel} ATTEINT !` : `NIVEAU ${prevLevel} · ${newRank.name}`}
              </Text>
              <Text style={styles.levelXPText}>
                {newLevelData.currentInLevel.toLocaleString('fr-FR')} / {newLevelData.neededForNext.toLocaleString('fr-FR')} XP
              </Text>
            </View>
            <View style={styles.levelTrack}>
              <Animated.View
                style={[
                  styles.levelFill,
                  { backgroundColor: newRank.color },
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </Animated.View>

          {/* ── Records battus ── */}
          {hasPRs ? (
            <View style={styles.prCard}>
              <View style={styles.prHeader}>
                <Ionicons name="trophy" size={14} color={Colors.primary} />
                <Text style={styles.prTitle}>
                  {newPRs.length === 1 ? 'Record battu !' : `${newPRs.length} records battus !`}
                </Text>
              </View>
              {newPRs.slice(0, 3).map((pr, i) => (
                <View key={`pr-${i}`} style={styles.prRow}>
                  <Text style={styles.prName} numberOfLines={1}>{pr.name}</Text>
                  <Text style={styles.prValues}>
                    <Text style={styles.prOld}>{pr.oldPR || '—'} kg</Text>
                    <Text style={styles.prArrow}>  →  </Text>
                    <Text style={styles.prNew}>{pr.newPR} kg</Text>
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Quêtes accomplies ── */}
          {hasQuests ? (
            <View style={styles.questCard}>
              <View style={styles.questHeader}>
                <Ionicons name="flash" size={14} color={Colors.primary} />
                <Text style={styles.questTitle}>
                  {completedQuests.length === 1 ? 'Quête accomplie !' : `${completedQuests.length} quêtes accomplies !`}
                </Text>
              </View>
              {completedQuests.map((q, i) => (
                <View key={q.templateId || `q-${i}`} style={styles.questRow}>
                  <Ionicons name="checkmark-circle" size={13} color={Colors.primary} />
                  <Text style={styles.questName} numberOfLines={1}>{q.label}</Text>
                  <Text style={styles.questXP}>+{QUEST_XP} XP</Text>
                </View>
              ))}
              {bonusUnlocked ? (
                <View style={styles.questRow}>
                  <Ionicons name="star" size={13} color="#FFD700" />
                  <Text style={[styles.questName, { color: '#FFD700' }]}>Bonus toutes quêtes</Text>
                  <Text style={[styles.questXP, { color: '#FFD700' }]}>+{BONUS_XP} XP</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── KPIs ── */}
          <View style={styles.kpisRow}>
            <Kpi icon="barbell"        label="Volume" value={`${totalVolume.toLocaleString('fr-FR')} kg`} color={newRank.color} />
            <View style={styles.kpiSep} />
            <Kpi icon="checkmark-done" label="Sets"   value={`${setsCompleted}/${totalSets}`}            color={newRank.color} />
            <View style={styles.kpiSep} />
            <Kpi icon="time-outline"   label="Durée"  value={duration}                                   color={newRank.color} />
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity style={styles.cta} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Retour au tableau de bord</Text>
          </TouchableOpacity>

          </ScrollView>
        </Animated.View>

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

              <Text style={styles.rkKicker}>NOUVEAU RANG DÉBLOQUÉ</Text>

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
                NIVEAU {newLevel}
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
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismissRankUpAnim} activeOpacity={1} />
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
              <Text style={styles.rankUpKicker}>NIVEAU ATTEINT !</Text>
              <Animated.Text style={[
                styles.rankUpName,
                { color: newRank.color, transform: [{ scale: rankNamePulse }] },
              ]}>
                {newLevel}
              </Animated.Text>
              <Text style={[styles.rankUpLevel, { color: newRank.color + 'AA' }]}>
                {newRank.name.toUpperCase()}
              </Text>
            </Animated.View>

            <Animated.Text style={[styles.rankUpTap, { opacity: tapHintOpacity }]}>
              Appuie pour continuer
            </Animated.Text>

            <TouchableOpacity
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

function Kpi({ icon, label, value, color }) {
  return (
    <View style={styles.kpi}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 18, 0.93)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'center',
  },

  confettiWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    width: 360,
    height: 360,
    opacity: 0.9,
  },

  body: {
    backgroundColor: 'rgba(16, 16, 24, 0.99)',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.75,
    shadowRadius: 56,
    elevation: 28,
  },
  scrollContent: {
    padding: 22,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoWrap: { alignItems: 'center', marginBottom: 14 },
  logo: { width: 130, height: 87 },

  // ── Kicker + Titre ────────────────────────────────────────────────────────
  kicker: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.8,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 18,
  },

  // ── XP Card ───────────────────────────────────────────────────────────────
  xpCard: {
    backgroundColor: 'rgba(110, 106, 240, 0.08)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 2,
  },
  xpValue: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 58,
  },
  capBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  capText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  // ── Badge rang ────────────────────────────────────────────────────────────
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // ── Barre de niveau ───────────────────────────────────────────────────────
  levelWrap: { marginBottom: 14 },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  levelXPText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  levelTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── PRs ───────────────────────────────────────────────────────────────────
  prCard: {
    backgroundColor: 'rgba(254,116,57,0.09)',
    borderColor: 'rgba(254,116,57,0.28)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  prHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  prTitle: { color: Colors.primary, fontSize: 13, fontWeight: '800', marginLeft: 6 },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  prName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  prValues: { fontSize: 13, fontWeight: '700' },
  prOld: { color: Colors.textMuted },
  prArrow: { color: Colors.textMuted },
  prNew: { color: Colors.primary, fontWeight: '900' },

  // ── Quêtes ────────────────────────────────────────────────────────────────
  questCard: {
    backgroundColor: 'rgba(254,116,57,0.07)',
    borderColor: 'rgba(254,116,57,0.22)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  questHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  questTitle: { color: Colors.primary, fontSize: 13, fontWeight: '800', marginLeft: 6 },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  questName: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  questXP: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },

  // ── KPIs ──────────────────────────────────────────────────────────────────
  kpisRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(22, 22, 31, 0.9)',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 4,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  kpiLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  kpiSep: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'center',
  },

  // ── Détail XP ─────────────────────────────────────────────────────────────
  xpDetail: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  xpDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  xpDetailLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  xpDetailValue: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  xpDetailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
  },
  xpDetailTotalLabel: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  xpDetailTotalValue: { color: Colors.textPrimary, fontWeight: '900', fontSize: 13 },

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
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3.5,
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
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rankUpTap: {
    position: 'absolute',
    bottom: 56,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
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
    color: 'rgba(255,255,255,0.32)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 14,
    textTransform: 'uppercase',
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
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
    color: 'rgba(255,255,255,0.30)',
    fontSize: 12,
    fontWeight: '700',
  },
  rkFromNew: {
    fontSize: 12,
    fontWeight: '800',
  },
  rkTap: {
    position: 'absolute',
    bottom: 56,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // ── CTA ───────────────────────────────────────────────────────────────────
  cta: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
