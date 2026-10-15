import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { xpToLevel } from '../../services';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { RANKS } from '../../constants/ranks';

// ─── RankRoadmapScreen ────────────────────────────────────────────────────────

export default function RankRoadmapScreen({ navigation }) {
  const { totalXP } = useWorkoutLogs();
  const { level: currentLevel } = useMemo(() => xpToLevel(totalXP), [totalXP]);
  const currentIndex = RANKS.reduce((acc, r, i) => (currentLevel >= r.minLevel ? i : acc), 0);
  const next = RANKS[currentIndex + 1] || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Retour" accessibilityRole="button"
          onPress={() => navigation && navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} accessibilityRole="header">Progression des rangs</Text>
          <Text style={styles.headerSub}>Niveau {currentLevel}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          {next
            ? `Encore ${next.minLevel - currentLevel} niveau${next.minLevel - currentLevel > 1 ? 'x' : ''} avant ${next.name}. Chaque rang débloque de nouveaux cadres et effets.`
            : 'Tu as atteint le rang le plus haut. Tous les cadres et effets sont à toi.'}
        </Text>

        {RANKS.map((rank, index) => (
          <RankCard
            key={rank.name}
            rank={rank}
            state={index < currentIndex ? 'past' : index === currentIndex ? 'current' : 'future'}
            level={currentLevel}
            nextMin={RANKS[index + 1]?.minLevel ?? null}
          />
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── RankCard ─────────────────────────────────────────────────────────────────
// Passé : sobre (déjà acquis). Actuel : mis en avant avec la progression vers
// le rang suivant. À venir : neutre, avec son niveau de déblocage.

function RankCard({ rank, state, level, nextMin }) {
  const reached = state !== 'future';
  const current = state === 'current';
  const pct = current && nextMin ? Math.min(1, (level - rank.minLevel) / (nextMin - rank.minLevel)) : 1;

  return (
    <View
      style={[styles.card, current && { borderColor: rank.color + '80', backgroundColor: rank.color + '12' }]}
      accessible
      accessibilityLabel={`${rank.name}, ${rank.levelRange}, ${current ? 'rang actuel' : reached ? 'atteint' : `se débloque au niveau ${rank.minLevel}`}`}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, reached
            ? { backgroundColor: rank.color + '1F', borderColor: rank.color + '40' }
            : styles.iconBoxLocked]}>
            <Ionicons name={reached ? rank.icon : 'lock-closed'} size={reached ? 22 : 18} color={reached ? rank.color : Colors.textMuted} />
          </View>
          <View style={styles.cardText}>
            <View style={styles.nameRow}>
              <Text style={[styles.rankName, { color: reached ? Colors.textPrimary : Colors.textSecondary }]}>
                {rank.name}
              </Text>
              {current && (
                <View style={[styles.currentBadge, { backgroundColor: rank.color + '25', borderColor: rank.color + '60' }]}>
                  <Text style={[styles.currentBadgeText, { color: rank.color }]}>Rang actuel</Text>
                </View>
              )}
            </View>
            <Text style={styles.rankRange}>
              {reached ? rank.levelRange : `Se débloque au niveau ${rank.minLevel}`}
            </Text>
          </View>
        </View>
        {state === 'past' ? <Ionicons name="checkmark-circle" size={22} color={rank.color} /> : null}
      </View>

      {current && nextMin ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: rank.color }]} />
          </View>
          <Text style={styles.progressTxt}>Niveau {level} sur {nextMin - 1}</Text>
        </View>
      ) : null}

      <View style={styles.perks}>
        {rank.perks.map((perk, i) => (
          <View key={i} style={styles.perkRow}>
            <Ionicons
              name={reached ? 'checkmark' : 'ellipse-outline'}
              size={14}
              color={reached ? rank.color : Colors.textMuted}
            />
            <Text style={[styles.perkText, { color: reached ? Colors.textSecondary : Colors.textMuted }]}>
              {perk}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundDeep,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardDeep,
    borderRadius: 22,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // ── Rank Card ─────────────────────────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: Colors.cardDeep,
    overflow: 'hidden',
  },
  iconBoxLocked: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
  progressWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressTxt: { color: Colors.textSecondary, fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '900',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rankRange: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Perks ─────────────────────────────────────────────────────────────────
  perks: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  perkText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
