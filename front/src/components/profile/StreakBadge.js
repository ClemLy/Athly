import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Modal, ScrollView, Dimensions,
} from 'react-native';

const SCROLL_MAX_H = Math.round(Dimensions.get('window').height * 0.38);
import { Ionicons } from '@expo/vector-icons';
import { getStreakMultiplier, STREAK_MILESTONES } from '../../services/stats.service';
import { Colors } from '../../constants/theme';

// ─── StreakBonusModal — Roadmap des multiplicateurs ───────────────────────────

function StreakBonusModal({ visible, streak, onClose }) {
  const { multiplier: currentMult, tier: currentTier } = getStreakMultiplier(streak);

  // Indice du palier actuel (le plus haut atteint)
  let currentIdx = 0;
  for (let i = 0; i < STREAK_MILESTONES.length; i++) {
    if (streak >= STREAK_MILESTONES[i].days) currentIdx = i;
  }

  const nextMilestone = STREAK_MILESTONES[currentIdx + 1] || null;
  const daysToNext = nextMilestone ? nextMilestone.days - streak : 0;
  const progressToNext = nextMilestone
    ? Math.min(1, (streak - STREAK_MILESTONES[currentIdx].days) / (nextMilestone.days - STREAK_MILESTONES[currentIdx].days))
    : 1;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={ms.backdrop}>
        <View style={ms.sheet}>

          {/* Handle */}
          <View style={ms.handle} />

          {/* Header */}
          <View style={ms.header}>
            <View style={ms.headerLeft}>
              <Ionicons name="flame" size={22} color="#FE7439" />
              <Text style={ms.headerTitle}>Régularité & Multiplicateurs</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Streak actuel */}
          <View style={ms.currentCard}>
            <Text style={ms.currentLabel}>TA SÉRIE ACTUELLE</Text>
            <View style={ms.currentRow}>
              <Text style={ms.currentDays}>{streak}</Text>
              <Text style={ms.currentUnit}> jour{streak > 1 ? 's' : ''}</Text>
              <View style={[ms.multChip, { backgroundColor: (getStreakMultiplier(streak).color || Colors.primary) + '22', borderColor: (getStreakMultiplier(streak).color || Colors.primary) + '55' }]}>
                <Text style={[ms.multChipText, { color: getStreakMultiplier(streak).color || Colors.primary }]}>
                  ×{currentMult}
                </Text>
              </View>
            </View>
            {nextMilestone && (
              <>
                <View style={ms.progressTrack}>
                  <View style={[ms.progressFill, { width: `${Math.round(progressToNext * 100)}%`, backgroundColor: nextMilestone.color || Colors.primary }]} />
                </View>
                <Text style={ms.progressHint}>
                  <Text style={{ color: nextMilestone.color || Colors.primary, fontWeight: '700' }}>{daysToNext} jour{daysToNext > 1 ? 's' : ''}</Text>
                  {' '}avant ×{nextMilestone.multiplier} — {nextMilestone.label}
                </Text>
              </>
            )}
          </View>

          {/* Roadmap */}
          <Text style={ms.roadmapTitle}>FEUILLE DE ROUTE</Text>
          <ScrollView style={ms.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {STREAK_MILESTONES.filter(m => m.days > 0).map((m, idx) => {
              const isReached  = streak >= m.days;
              const isCurrent  = m.tier === currentTier;
              const color = m.color || Colors.textMuted;
              return (
                <View key={m.days} style={[ms.row, isCurrent && ms.rowCurrent, { borderColor: isCurrent ? color + '40' : 'transparent' }]}>
                  <View style={[ms.iconDot, { backgroundColor: isReached ? color + '22' : 'rgba(255,255,255,0.04)', borderColor: isReached ? color + '55' : 'rgba(255,255,255,0.08)' }]}>
                    <Ionicons
                      name={isReached ? 'flame' : 'flame-outline'}
                      size={16}
                      color={isReached ? color : Colors.textMuted}
                    />
                  </View>
                  <View style={ms.rowContent}>
                    <Text style={[ms.rowDays, { color: isReached ? Colors.textPrimary : Colors.textMuted }]}>
                      {m.days} jour{m.days > 1 ? 's'  : ''}
                    </Text>
                    <Text style={[ms.rowLabel, { color: isReached ? color : Colors.textMuted }]} numberOfLines={1}>
                      {m.label}
                    </Text>
                  </View>
                  <View style={[ms.multBadge, { backgroundColor: isReached ? color + '20' : 'rgba(255,255,255,0.04)', borderColor: isReached ? color + '50' : 'rgba(255,255,255,0.08)' }]}>
                    <Text style={[ms.multBadgeText, { color: isReached ? color : Colors.textMuted }]}>×{m.multiplier}</Text>
                  </View>
                  {isCurrent && (
                    <View style={[ms.currentTag, { backgroundColor: color }]}>
                      <Text style={ms.currentTagText}>EN COURS</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── StreakBadge ──────────────────────────────────────────────────────────────

export default function StreakBadge({ streak = 0, compact = false }) {
  const { multiplier, label, color, tier } = getStreakMultiplier(streak);
  const [modalVisible, setModalVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (tier === 'base' || streak === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 650,  useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 750,  useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tier, streak, pulseAnim]);

  if (streak === 0) return null;

  const flameColor = color || '#FE7439';

  const openModal = () => setModalVisible(true);

  if (compact) {
    return (
      <>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={openModal}
          style={[styles.compact, { borderColor: flameColor + '40', backgroundColor: flameColor + '12' }]}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Ionicons name="flame" size={13} color={flameColor} />
          </Animated.View>
          <Text style={[styles.compactText, { color: flameColor }]}>{streak}</Text>
          {multiplier > 1 && (
            <Text style={[styles.multiplier, { color: flameColor }]}>×{multiplier}</Text>
          )}
        </TouchableOpacity>
        <StreakBonusModal visible={modalVisible} streak={streak} onClose={() => setModalVisible(false)} />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openModal}
        style={[styles.badge, { borderColor: flameColor + '40', backgroundColor: flameColor + '10' }]}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Ionicons name="flame" size={20} color={flameColor} />
        </Animated.View>
        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={[styles.streakNum, { color: flameColor }]}>{streak}</Text>
            <Text style={[styles.streakUnit, { color: flameColor }]}> jours</Text>
            {multiplier > 1 && (
              <View style={[styles.multChip, { backgroundColor: flameColor + '25', borderColor: flameColor + '50' }]}>
                <Text style={[styles.multText, { color: flameColor }]}>×{multiplier}</Text>
              </View>
            )}
          </View>
          {label ? (
            <Text style={[styles.label, { color: flameColor }]}>{label}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={14} color={flameColor + '80'} />
      </TouchableOpacity>
      <StreakBonusModal visible={modalVisible} streak={streak} onClose={() => setModalVisible(false)} />
    </>
  );
}

// ─── Styles StreakBadge ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  compactText: { fontSize: 12, fontWeight: '800' },
  multiplier:  { fontSize: 10, fontWeight: '700', opacity: 0.85 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  info: { flex: 1 },
  row:  { flexDirection: 'row', alignItems: 'center' },
  streakNum:  { fontSize: 20, fontWeight: '900' },
  streakUnit: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  multChip: {
    marginLeft: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
  },
  multText: { fontSize: 11, fontWeight: '800' },
  label: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', marginTop: 2, opacity: 0.85,
  },
});

// ─── Styles StreakBonusModal ──────────────────────────────────────────────────

const ms = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F0F1A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },

  currentCard: {
    backgroundColor: 'rgba(254,116,57,0.08)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(254,116,57,0.20)',
    padding: 16, marginBottom: 20,
  },
  currentLabel: {
    color: Colors.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.2, marginBottom: 8,
  },
  currentRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  currentDays: { color: '#FE7439', fontSize: 36, fontWeight: '900' },
  currentUnit: { color: '#FE7439', fontSize: 16, fontWeight: '600' },
  multChip: {
    marginLeft: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  multChipText: { fontSize: 14, fontWeight: '900' },
  progressTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressHint: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },

  roadmapTitle: {
    color: Colors.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.2, marginBottom: 12,
  },
  scroll: { maxHeight: SCROLL_MAX_H },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 6,
    borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowCurrent: { backgroundColor: 'rgba(255,255,255,0.05)' },
  iconDot: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  rowContent: { flex: 1 },
  rowDays:  { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rowLabel: { fontSize: 11, fontWeight: '600', opacity: 0.85 },
  multBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  multBadgeText: { fontSize: 13, fontWeight: '800' },
  currentTag: {
    position: 'absolute', top: -6, right: 8,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  currentTagText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
});
