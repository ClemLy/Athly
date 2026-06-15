import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useQuests } from '../../context/QuestContext';
import { QUEST_XP, BONUS_XP } from '../../services/quest.service';

export default function DailyQuestsCard() {
  const { quests, completedCount, bonusClaimed, loading } = useQuests();

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (!quests || quests.length === 0) return null;

  const allDone = completedCount === 3;
  const pct = (completedCount / 3) * 100;

  return (
    <View style={[styles.card, allDone && styles.cardAllDone]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flash" size={13} color={Colors.primary} />
          <Text style={styles.title}>QUÊTES DU JOUR</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.progressLabel, allDone && { color: Colors.primary }]}>
            {completedCount}/3
          </Text>
          <View style={styles.dots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, i < completedCount && styles.dotActive]} />
            ))}
          </View>
        </View>
      </View>

      {/* Quest items */}
      <View style={styles.list}>
        {quests.map((q, i) => <QuestRow key={q.templateId || i} quest={q} />)}
      </View>

      {/* Progress bar + bonus row */}
      <View style={styles.footer}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }, allDone && styles.fillDone]} />
        </View>
        <View style={styles.bonusRow}>
          <Ionicons
            name={allDone ? 'star' : 'star-outline'}
            size={10}
            color={allDone ? '#FFD700' : Colors.textMuted}
          />
          <Text style={[styles.bonusText, allDone && styles.bonusTextDone]}>
            Bonus toutes quêtes : +{BONUS_XP} XP
          </Text>
          {allDone && (
            <Ionicons name="checkmark-circle" size={11} color="#FFD700" />
          )}
        </View>
      </View>

    </View>
  );
}

function QuestRow({ quest }) {
  const done = quest.completed;
  return (
    <View style={[styles.row, done && styles.rowDone]}>

      <View style={[styles.iconBox, done && styles.iconBoxDone]}>
        {done
          ? <Ionicons name="checkmark" size={12} color={Colors.primary} />
          : <Ionicons name={quest.icon || 'flash-outline'} size={12} color="rgba(255,255,255,0.35)" />
        }
      </View>

      <View style={styles.rowInfo}>
        <Text
          style={[styles.rowLabel, done && styles.rowLabelDone]}
          numberOfLines={1}
        >
          {quest.label || '…'}
        </Text>
        <Text
          style={[styles.rowDesc, done && styles.rowDescDone]}
          numberOfLines={1}
        >
          {quest.desc || ''}
        </Text>
      </View>

      <Text style={[styles.rowXP, done && styles.rowXPDone]}>+{QUEST_XP} XP</Text>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardAllDone: {
    borderColor: Colors.primary + '40',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotActive: { backgroundColor: Colors.primary },

  // ── Quest rows ─────────────────────────────────────────────────────────────
  list: { gap: 10, marginBottom: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    opacity: 1,
  },
  rowDone: { opacity: 0.75 },

  iconBox: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconBoxDone: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '40',
  },

  rowInfo: { flex: 1 },
  rowLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  rowLabelDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  rowDesc: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  rowDescDone: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.20)',
  },
  rowXP: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 0,
  },
  rowXPDone: { color: Colors.primary },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: { gap: 8 },

  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },
  fillDone: {
    opacity: 1,
    backgroundColor: Colors.primary,
  },

  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bonusText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  bonusTextDone: { color: '#FFD700' },
});
