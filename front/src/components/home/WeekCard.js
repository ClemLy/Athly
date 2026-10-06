import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { formatWeight, plural } from '../../utils/format';

// Carte « Ta semaine » de l'accueil : les 7 jours d'un coup d'œil (jours
// entraînés cochés), séances, volume et série en cours.
//
// Props :
//   - days     : weekDays() de data/homeInsights
//   - sessions : séances cette semaine
//   - volume   : kg soulevés cette semaine
//   - streak   : jours d'affilée
//   - trainedToday : bool
//   - onPress  : ouvre les stats
//
export default function WeekCard({ days = [], sessions = 0, volume = 0, streak = 0, trainedToday = false, onPress }) {
  const streakText = streak > 0
    ? `Série de ${plural(streak, 'jour')}${trainedToday ? '' : ' : entraîne-toi aujourd\'hui pour la garder'}`
    : 'Entraîne-toi aujourd\'hui pour lancer ta série';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Ta semaine : ${sessions > 0 ? `${plural(sessions, 'séance')}, ${formatWeight(volume)} soulevés` : 'aucune séance'}. ${streakText}. Voir les stats`}
    >
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>Ta semaine</Text>
        <View style={styles.headRight}>
          {sessions > 0 ? (
            <>
              <Text style={styles.kpi} numberOfLines={1}>
                <Text style={styles.kpiValue}>{sessions}</Text>
                {` ${sessions >= 2 ? 'séances' : 'séance'}`}
              </Text>
              <View style={styles.sep} />
              <Text style={styles.kpi} numberOfLines={1}><Text style={styles.kpiValue}>{formatWeight(volume)}</Text></Text>
            </>
          ) : (
            <Text style={styles.kpi} numberOfLines={1}>Aucune séance</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      </View>

      <View style={styles.days}>
        {days.map((d) => (
          <View key={d.key} style={styles.day}>
            <View
              style={[
                styles.bubble,
                d.trained && styles.bubbleDone,
                d.isToday && !d.trained && styles.bubbleToday,
                d.isFuture && styles.bubbleFuture,
              ]}
            >
              {d.trained
                ? <Ionicons name="checkmark" size={16} color="#fff" />
                : <Text style={[styles.letter, d.isToday && styles.letterToday]}>{d.letter}</Text>}
            </View>
            {d.isToday ? <View style={styles.todayDot} /> : <View style={styles.todayDotSpacer} />}
          </View>
        ))}
      </View>

      <View style={styles.foot}>
        <Ionicons name="flame" size={15} color={streak > 0 ? Colors.primary : Colors.textMuted} />
        <Text style={[styles.footText, streak > 0 && styles.footTextOn]} numberOfLines={2}>{streakText}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', flexShrink: 0, marginRight: 10 },
  headRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 1, minWidth: 0 },
  kpi: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  kpiValue: { color: Colors.textPrimary, fontWeight: '800' },
  sep: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', flex: 1 },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bubbleDone: { backgroundColor: Colors.primary },
  bubbleToday: { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: 'rgba(254,116,57,0.08)' },
  bubbleFuture: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  letter: { color: Colors.textMuted, fontSize: 13, fontWeight: '800' },
  letterToday: { color: Colors.textPrimary },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary, marginTop: 5 },
  todayDotSpacer: { height: 4, marginTop: 5 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  footText: { flex: 1, color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  footTextOn: { color: Colors.textSecondary },
});
