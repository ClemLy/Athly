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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';
import { xpToLevel } from '../../services';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { FRAME_DEFS } from '../../components/profile/AvatarFrame';
import { RANKS } from '../../constants/ranks';

// ─── RankRoadmapScreen ────────────────────────────────────────────────────────

export default function RankRoadmapScreen({ navigation }) {
  const { totalXP } = useWorkoutLogs();
  const { level: currentLevel } = useMemo(() => xpToLevel(totalXP), [totalXP]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Retour" accessibilityRole="button"
          onPress={() => navigation && navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Roadmap des Rangs</Text>
          <Text style={styles.headerSub}>Niveau actuel : {currentLevel}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Chaque rang débloque des effets visuels exclusifs. Progresse pour transformer ton interface.
        </Text>

        {RANKS.map((rank, index) => {
          const isReached  = currentLevel >= rank.minLevel;
          const isCurrent  = currentLevel >= rank.minLevel && (index === RANKS.length - 1 || currentLevel < RANKS[index + 1].minLevel);
          const frameDef   = FRAME_DEFS.find((f) => f.id === rank.frameId);

          return (
            <RankCard
              key={rank.name}
              rank={rank}
              frameDef={frameDef}
              isReached={isReached}
              isCurrent={isCurrent}
            />
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── RankCard ─────────────────────────────────────────────────────────────────

function RankCard({ rank, frameDef, isReached, isCurrent }) {
  return (
    <View style={[styles.card, isCurrent && { borderColor: rank.color + '60' }]}>
      {/* Gradient subtil en fond */}
      <LinearGradient
        colors={isReached ? rank.gradientColors : ['#0D0D14', '#0D0D14']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        borderRadius={16}
      />

      <View style={styles.cardContent}>
        {/* Icône + nom + range */}
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: rank.color + '18', borderColor: rank.color + '30' }]}>
            <Ionicons name={rank.icon} size={22} color={isReached ? rank.color : Colors.textMuted} />
          </View>
          <View style={styles.cardText}>
            <View style={styles.nameRow}>
              <Text style={[styles.rankName, { color: isReached ? rank.color : Colors.textMuted }]}>
                {rank.name}
              </Text>
              {isCurrent && (
                <View style={[styles.currentBadge, { backgroundColor: rank.color + '25', borderColor: rank.color + '50' }]}>
                  <Text style={[styles.currentBadgeText, { color: rank.color }]}>Actuel</Text>
                </View>
              )}
            </View>
            <Text style={styles.rankRange}>{rank.levelRange}</Text>
          </View>
        </View>

        {/* Indicateur atteint */}
        <View style={[styles.reachDot, { backgroundColor: isReached ? rank.color : 'rgba(255,255,255,0.10)' }]}>
          {isReached && <Ionicons name="checkmark" size={12} color="#000" />}
        </View>
      </View>

      {/* Perks */}
      <View style={styles.perks}>
        {rank.perks.map((perk, i) => (
          <View key={i} style={styles.perkRow}>
            <Ionicons
              name={isReached ? 'checkmark-circle' : 'ellipse-outline'}
              size={12}
              color={isReached ? rank.color : Colors.textMuted}
            />
            <Text style={[styles.perkText, { color: isReached ? Colors.textSecondary : Colors.textMuted }]}>
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
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardDeep,
    borderRadius: 12,
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
    color: Colors.textMuted,
    fontSize: 11,
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
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // ── Rank Card ─────────────────────────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankRange: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  reachDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});
