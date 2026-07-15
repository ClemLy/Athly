import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { RARITY_META } from '../../services';
import { FeaturedModal, TrophyIcon } from './TrophySlot';

// ─── AchievementShowcase ──────────────────────────────────────────────────────
// Résumé compact (X/55 débloqués + barre de progression) avec un bouton
// "Voir le détail" qui ouvre le catalogue complet dans une modale, groupé par
// catégorie — évite de dérouler 55 badges directement sur le profil.
//
// Couvre les deux catalogues fusionnés côté back (buildAchievementsView) :
// le V2 backend ({name, description}, ~14 trophées) et le miroir du V1 local
// ({label, condition, epicDesc, gradientColors}, ~41 trophées).
//
// Props :
//   achievements  Array<{ id, name|label, description|condition, category, hidden, unlocked, unlockedAt }>
//   stats         { total, unlocked, percentage }

const ICON_BY_ID = {
  BIRTHDAY_SET:         'gift',
  BIRTHDAY_CELEBRATED:  'balloon',
  FIRST_COMMON_ITEM:    'cube-outline',
  FIRST_RARE_ITEM:      'cube',
  FIRST_EPIC_ITEM:      'diamond',
  FIRST_LEGENDARY_ITEM: 'flame',
  FIRST_UNIQUE_ITEM:    'dragon',
  FIRST_REFERRAL:       'person-add',
  FRIENDSHIP_LEVEL_5:   'heart',
  CHEST_1:              'cube-outline',
  CHEST_10:             'cube',
  CHEST_50:             'gift',
  CHEST_100:            'trophy',
  CHEST_200:            'diamond',
  FIRST_MULTI_SESSION:  'people',
  MULTI_SQUAD_FULL:     'people-circle',
};

const RARITY_BY_ID = {
  FIRST_COMMON_ITEM:    'common',
  FIRST_RARE_ITEM:      'rare',
  FIRST_EPIC_ITEM:      'epic',
  FIRST_LEGENDARY_ITEM: 'legendary',
  FIRST_UNIQUE_ITEM:    'unique',
};

// Palier de rareté (glow + intensité visuelle) — sans cette table, tous les
// trophées backend retombaient sur le tier par défaut ("bronze"), écrasant
// toute lecture de progression/difficulté dans la Salle des Trophées.
const TIER_BY_ID = {
  BIRTHDAY_SET:         'bronze',
  BIRTHDAY_CELEBRATED:  'gold',
  FIRST_COMMON_ITEM:    'bronze',
  FIRST_RARE_ITEM:      'silver',
  FIRST_EPIC_ITEM:      'gold',
  FIRST_LEGENDARY_ITEM: 'platinum',
  FIRST_UNIQUE_ITEM:    'diamond',
  FIRST_REFERRAL:       'silver',
  FRIENDSHIP_LEVEL_5:   'diamond',
  CHEST_1:              'bronze',
  CHEST_10:             'silver',
  CHEST_50:             'gold',
  CHEST_100:            'platinum',
  CHEST_200:            'diamond',
  FIRST_MULTI_SESSION:  'silver',
  MULTI_SQUAD_FULL:     'platinum',
};

// FRIENDSHIP_LEVEL_5 ("Lien de Sang") est la même récompense Rareté Unique
// que le cadre cosmétique — même identité Rouge Sang, pas la couleur sociale
// générique.
const COLOR_OVERRIDE_BY_ID = {
  FRIENDSHIP_LEVEL_5: Colors.uniqueBlood,
};

const CATEGORY_COLOR = {
  profile:     Colors.rankViolet,
  collection:  Colors.primary,
  social:      '#22D3EE',
  heritage:    Colors.primary,
  force:       '#DC2626',
  exploration: Colors.valid,
  secret:      '#6366F1',
  corps:       '#D1D5DB',
  regularite:  '#10B981',
  special:     Colors.primary,
  ultime:      Colors.gold,
};

const CATEGORY_LABELS = {
  profile:     'Profil',
  collection:  'Collection',
  social:      'Social',
  heritage:    'Héritage',
  force:       'Force',
  exploration: 'Exploration',
  secret:      'Secrets',
  corps:       'Poids du corps',
  regularite:  'Régularité',
  special:     'Spécial',
  ultime:      'Ultime',
};

const CATEGORY_ORDER = [
  'heritage', 'force', 'exploration', 'corps', 'regularite',
  'collection', 'profile', 'social', 'special', 'secret', 'ultime',
];

// Hauteur numérique fixe (et non un pourcentage) : sur react-native-web, un
// enfant `flex: 1` dans un parent contraint seulement par `maxHeight` (sans
// `height`) calcule mal sa zone scrollable — le scroll ne répondait qu'au
// centre de la modale, jamais en haut ni en bas.
const SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.82);

function colorFor(achievement) {
  // Les trophées du catalogue local synchronisé portent leur couleur ;
  // les trophées backend historiques passent par les maps de repli.
  if (COLOR_OVERRIDE_BY_ID[achievement.id]) return COLOR_OVERRIDE_BY_ID[achievement.id];
  if (achievement.color) return achievement.color;
  const rarity = RARITY_BY_ID[achievement.id];
  if (rarity) return RARITY_META[rarity].color;
  return CATEGORY_COLOR[achievement.category] || Colors.primary;
}

// Normalise les deux formes de catalogue (backend V2 vs miroir local) vers un
// seul shape exploitable par TrophySlot/FeaturedModal (mêmes composants que
// la Vitrine du profil).
export function normalizeAchievement(a) {
  const color = colorFor(a);
  const hiddenLocked = a.hidden && !a.unlocked;
  return {
    ...a,
    label: a.label || a.name || '',
    condition: hiddenLocked ? '???' : (a.condition || a.description || ''),
    epicDesc: hiddenLocked ? 'Ce trophée est encore secret.' : (a.epicDesc || a.description || a.condition || ''),
    color,
    gradientColors: a.gradientColors || [color, color, color],
    icon: hiddenLocked ? 'help-circle' : (a.icon || ICON_BY_ID[a.id] || 'trophy'),
    tier: a.tier || TIER_BY_ID[a.id] || 'bronze',
  };
}

export default function AchievementShowcase({ achievements = [], stats }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const normalized = achievements.map(normalizeAchievement);
  const byCategory = CATEGORY_ORDER
    .map((cat) => ({ cat, items: normalized.filter((a) => a.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <View>
      {stats && (
        <View style={styles.statsBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statsTxt}>
              {stats.unlocked}/{stats.total} trophées débloqués
            </Text>
            <View style={styles.statsBarTrack}>
              <View style={[styles.statsBarFill, { width: `${stats.percentage}%` }]} />
            </View>
          </View>
          <Text style={styles.statsPct}>{stats.percentage}%</Text>
        </View>
      )}

      <TouchableOpacity style={styles.detailBtn} onPress={() => setDetailOpen(true)} activeOpacity={0.8}>
        <Ionicons name="grid" size={15} color={Colors.gold} />
        <Text style={styles.detailBtnText}>Voir le détail</Text>
        <Ionicons name="chevron-forward" size={15} color={Colors.gold} />
      </TouchableOpacity>

      {detailOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDetailOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setDetailOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Trophées {stats ? `· ${stats.unlocked}/${stats.total}` : ''}</Text>
                <TouchableOpacity onPress={() => setDetailOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {byCategory.map(({ cat, items }) => (
                  <View key={cat} style={{ marginBottom: 18 }}>
                    <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat] || cat}</Text>
                    <View style={styles.grid}>
                      {items.map((a) => (
                        <AchievementBadge key={a.id} achievement={a} onPress={() => setSelected(a)} />
                      ))}
                    </View>
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {selected && (
        <FeaturedModal trophy={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

function AchievementBadge({ achievement, onPress }) {
  const { unlocked, color, icon, label } = achievement;
  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={unlocked ? onPress : undefined}
      activeOpacity={unlocked ? 0.8 : 1}
      disabled={!unlocked}
    >
      <View
        style={[
          styles.badgeIconWrap,
          unlocked
            ? { backgroundColor: `${color}1F`, borderColor: `${color}55` }
            : styles.badgeIconWrapLocked,
        ]}
      >
        <TrophyIcon name={icon} size={22} color={unlocked ? color : Colors.textMuted} />
      </View>
      <Text style={[styles.badgeName, unlocked && { color: Colors.textPrimary }]} numberOfLines={2}>
        {label}
      </Text>
      {!unlocked && (
        <View style={styles.lockChip}>
          <Ionicons name="lock-closed" size={9} color={Colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12,
  },
  statsTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  statsBarTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  statsBarFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },
  statsPct: { color: Colors.gold, fontSize: 14, fontWeight: '800' },

  detailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: 12, paddingVertical: 11,
  },
  detailBtnText: { color: Colors.gold, fontSize: 13, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.74)', justifyContent: 'flex-end' },
  sheet: {
    height: SHEET_MAX_HEIGHT, backgroundColor: Colors.bgAbyss,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scrollArea: { flex: 1 },
  categoryLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },

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
