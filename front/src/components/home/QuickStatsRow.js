import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { formatWeight, pluralWord } from '../../utils/format';

// Trois KPIs compacts sur la home : Séances, Volume, Streak.
// Affichage uniquement quand l'utilisateur a au moins 1 log (sinon EmptyHomeState).
//
// Props :
//   - sessions (number)
//   - volume (number, kg)
//   - streak (number, jours consécutifs)
//
export default function QuickStatsRow({ sessions = 0, volume = 0, streak = 0 }) {
  return (
    <View style={styles.row}>
      <Stat
        icon="bookmark"
        label="Séances"
        sub="cette semaine"
        value={sessions}
        accent={Colors.secondaryAccent}
      />
      <Stat
        icon="barbell"
        label="Volume"
        sub="cette semaine"
        value={formatWeight(volume)}
        accent={Colors.primary}
      />
      <Stat
        icon="flame"
        label="Streak"
        sub={pluralWord(streak, 'jour')}
        value={streak}
        accent={Colors.primary}
        highlight={streak >= 3}
      />
    </View>
  );
}

function Stat({ icon, label, sub, value, accent, highlight = false }) {
  return (
    <View
      style={[styles.card, highlight && styles.cardHighlight]}
      accessible
      accessibilityLabel={`${label} ${sub} : ${value}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,0,0,0)' }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    width: '32%',
    backgroundColor: Colors.cardDeep,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(254, 116, 57, 0.35)',
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  sub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
