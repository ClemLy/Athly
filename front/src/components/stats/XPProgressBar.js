import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { xpToLevel } from '../../services/stats.service';

// Bar de progression niveau / XP. Reçoit le total XP cumulé.
// Visualise : niveau actuel + barre + xp restant pour next level.
export default function XPProgressBar({ totalXP = 0, compact = false }) {
  const { level, currentInLevel, neededForNext, progress } = xpToLevel(totalXP);
  const pct = Math.max(0, Math.min(1, progress || 0));

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelLabel}>Niv.</Text>
          <Text style={styles.levelValue}>{level}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.xpTotal}>{totalXP.toLocaleString('fr-FR')} XP</Text>
          <Text style={styles.xpHint}>
            {currentInLevel} / {neededForNext} pour Niv. {level + 1}
          </Text>
        </View>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    padding: 16,
  },
  wrapCompact: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(254, 116, 57, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  levelLabel: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  levelValue: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  right: {
    flex: 1,
  },
  xpTotal: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  xpHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
});
