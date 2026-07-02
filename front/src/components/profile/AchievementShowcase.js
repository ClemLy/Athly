import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { RARITY_META } from '../../services/inventory.service';

// ─── AchievementShowcase ──────────────────────────────────────────────────────
// Vitrine des trophées backend V2 (reward.controller.js ACHIEVEMENT_CATALOG) :
// anniversaire, collection d'objets, social. Distinct du système de trophées
// V1 100% local (trophyCatalog.js / TrophyGrid) qui n'est pas consultable
// pour un tiers faute d'accès à ses logs de séances.
//
// Props :
//   achievements  Array<{ id, name, description, category, hidden, unlocked, unlockedAt }>
//   stats         { total, unlocked, percentage }

const ICON_BY_ID = {
  BIRTHDAY_SET:         'gift',
  BIRTHDAY_CELEBRATED:  'balloon',
  FIRST_COMMON_ITEM:    'cube-outline',
  FIRST_RARE_ITEM:      'cube',
  FIRST_EPIC_ITEM:      'diamond',
  FIRST_LEGENDARY_ITEM: 'flame',
  FIRST_UNIQUE_ITEM:    'star',
  FIRST_REFERRAL:       'person-add',
  FRIENDSHIP_LEVEL_5:   'heart',
};

const RARITY_BY_ID = {
  FIRST_COMMON_ITEM:    'common',
  FIRST_RARE_ITEM:      'rare',
  FIRST_EPIC_ITEM:      'epic',
  FIRST_LEGENDARY_ITEM: 'legendary',
  FIRST_UNIQUE_ITEM:    'unique',
};

const CATEGORY_COLOR = {
  profile:    Colors.rankViolet,
  collection: Colors.primary,
  social:     '#22D3EE',
};

function colorFor(achievement) {
  const rarity = RARITY_BY_ID[achievement.id];
  if (rarity) return RARITY_META[rarity].color;
  return CATEGORY_COLOR[achievement.category] || Colors.primary;
}

export default function AchievementShowcase({ achievements = [], stats }) {
  return (
    <View>
      {stats && (
        <View style={styles.statsBar}>
          <Text style={styles.statsTxt}>
            {stats.unlocked}/{stats.total} trophées débloqués
          </Text>
          <View style={styles.statsBarTrack}>
            <View style={[styles.statsBarFill, { width: `${stats.percentage}%` }]} />
          </View>
          <Text style={styles.statsPct}>{stats.percentage}%</Text>
        </View>
      )}

      <View style={styles.grid}>
        {achievements.map((a, i) => (
          <AchievementBadge key={a.id} achievement={a} color={colorFor(a)} index={i} />
        ))}
      </View>
    </View>
  );
}

function AchievementBadge({ achievement, color, index }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, delay: index * 40, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 260, delay: index * 40, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { unlocked, hidden } = achievement;
  const icon = hidden && !unlocked ? 'help-circle' : (ICON_BY_ID[achievement.id] || 'trophy');

  return (
    <Animated.View style={[styles.badge, { opacity, transform: [{ scale }] }]}>
      <View
        style={[
          styles.badgeIconWrap,
          unlocked
            ? { backgroundColor: `${color}1F`, borderColor: `${color}55` }
            : styles.badgeIconWrapLocked,
        ]}
      >
        <Ionicons name={icon} size={22} color={unlocked ? color : Colors.textMuted} />
      </View>
      <Text style={[styles.badgeName, unlocked && { color: Colors.textPrimary }]} numberOfLines={2}>
        {achievement.name}
      </Text>
      {!unlocked && (
        <View style={styles.lockChip}>
          <Ionicons name="lock-closed" size={9} color={Colors.textMuted} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 16,
  },
  statsTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  statsBarTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  statsBarFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },
  statsPct: { color: Colors.gold, fontSize: 12, fontWeight: '800' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  badge: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    position: 'relative',
  },
  badgeIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  badgeIconWrapLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeName: {
    color: Colors.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  lockChip: {
    position: 'absolute', top: 8, right: 8,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
});
