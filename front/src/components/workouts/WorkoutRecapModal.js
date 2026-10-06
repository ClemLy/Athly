import React, { useEffect, useRef, useState } from 'react';
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
import { useUser } from '../../context/UserContext';
import { markLevelCelebrated } from '../../services/levelCelebration';
import LevelUpOverlay from '../profile/LevelUpOverlay';

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

  // Rebond de la carte niveau quand la barre se remplit
  const levelBounce = useRef(new Animated.Value(1)).current;

  // Célébration (niveau ou nouveau rang), lancée une fois la barre remplie
  const [celebrating, setCelebrating] = useState(false);
  // Tant que la célébration n'est pas passée, le récap montre encore l'ancien
  // niveau (et l'ancien rang) : pas de nouveau rang dévoilé avant l'animation.
  const [revealed, setRevealed] = useState(false);
  const { user } = useUser();
  const userInitial = ((user && user.name) || 'A').charAt(0).toUpperCase();

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

  // Ce que la carte niveau affiche : l'ancien niveau jusqu'à la célébration.
  const pending       = leveledUp && !revealed;
  const shownRank     = pending ? prevRank : newRank;
  const shownLevel    = pending ? prevLevel : newLevel;
  const accent        = shownRank.color;

  const finishCelebration = () => {
    setCelebrating(false);
    setRevealed(true);
    // La barre repart de zéro dans le nouveau niveau.
    progressAnim.setValue(0);
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: newLevelData.progress,
        duration: 650,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(levelBounce, { toValue: 1.05, friction: 3, tension: 180, useNativeDriver: true }),
        Animated.spring(levelBounce, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]),
    ]).start();
  };

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

  // ── Compteur XP + barre + pulse ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      xpCounter.setValue(0);
      setDisplayedXP(0);
      progressAnim.setValue(prevProgress);
      xpPulse.setValue(1);
      levelBounce.setValue(1);
      setCelebrating(false);
      setRevealed(false);
      return;
    }

    let celebrateTimer = null;
    const celebrate = (delay) => {
      if (!leveledUp) return;
      celebrateTimer = setTimeout(() => {
        markLevelCelebrated(newLevel);
        setCelebrating(true);
      }, delay);
    };

    if (reducedMotion) {
      setDisplayedXP(xpEarned);
      progressAnim.setValue(newProgress);
      celebrate(400);
      return () => clearTimeout(celebrateTimer);
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
        // La barre vient d'atteindre le bout : place à la célébration.
        celebrate(450);
      }
    });

    return () => {
      xpCounter.removeListener(listener);
      clearTimeout(celebrateTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reducedMotion]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={celebrating ? finishCelebration : onClose}
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
              <View style={[styles.emblem, { borderColor: accent + '55', backgroundColor: accent + '18' }]}>
                <Ionicons name="checkmark" size={34} color={accent} />
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
                    style={[styles.xpValue, { color: accent, transform: [{ scale: xpPulse }] }]}
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
                <View style={[styles.levelPill, { backgroundColor: accent + '1F' }]}>
                  <Text style={[styles.levelPillText, { color: accent }]}>Niveau {shownLevel}</Text>
                </View>
                <Text style={styles.rankName} numberOfLines={1}>{shownRank.name}</Text>
                <Text style={styles.levelXPText}>
                  {pending
                    ? `${prevLevelData.neededForNext.toLocaleString('fr-FR')} / ${prevLevelData.neededForNext.toLocaleString('fr-FR')} XP`
                    : `${newLevelData.currentInLevel.toLocaleString('fr-FR')} / ${newLevelData.neededForNext.toLocaleString('fr-FR')} XP`}
                </Text>
              </View>
              <View style={styles.levelTrack}>
                <Animated.View
                  style={[
                    styles.levelFill,
                    { backgroundColor: accent },
                    { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              </View>
              {/* Avant la célébration, l'indication reste invisible mais garde sa place. */}
              <Text
                style={[styles.levelHint, pending && { opacity: 0 }]}
                accessibilityElementsHidden={pending}
                importantForAccessibility={pending ? 'no-hide-descendants' : 'auto'}
              >
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

        {/* ── Gain de niveau / nouveau rang, par-dessus le récap ── */}
        {celebrating ? (
          <LevelUpOverlay
            prevLevel={prevLevel}
            newLevel={newLevel}
            userInitial={userInitial}
            onClose={finishCelebration}
          />
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
});
