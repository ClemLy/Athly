import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { aggregateExercise } from '../../services/stats.service';
import ExerciseStatsChart from '../../components/stats/ExerciseStatsChart';
import PRCard from '../../components/stats/PRCard';

// Détail historique d'un exercice : graphique de progression + PRs + suggestion.
//
// route.params :
//   - exerciseRef : { id, name } OU string
//
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const METRICS = [
  { id: 'maxWeight', label: 'Poids max' },
  { id: 'volume', label: 'Volume' },
];

export default function ExerciseStatsScreen({ route, navigation }) {
  const params = (route && route.params) || {};
  const exerciseRef = params.exerciseRef || null;
  const exerciseName = (exerciseRef && (exerciseRef.name || exerciseRef)) || 'Exercice';

  const { sessionLogs: logs } = useWorkoutLogs();
  const [metric, setMetric] = useState('maxWeight');

  const stats = useMemo(() => aggregateExercise(logs, exerciseRef), [logs, exerciseRef]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation && navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{exerciseName}</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kpisRow}>
          <Kpi label="Sessions" value={stats.totalSessions} icon="calendar-outline" />
          <Kpi label="Poids max" value={stats.prWeight ? `${stats.prWeight} kg` : '—'} icon="trophy-outline" />
          <Kpi label="1RM est." value={stats.prEstimate1RM ? `${stats.prEstimate1RM} kg` : '—'} icon="rocket-outline" />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Progression</Text>
            <View style={styles.metricsToggle}>
              {METRICS.map((m) => {
                const active = m.id === metric;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.metricBtn, active && styles.metricBtnActive]}
                    onPress={() => setMetric(m.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.metricLabel, active && styles.metricLabelActive]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <ExerciseStatsChart points={stats.points} metric={metric} />
        </View>

        <PRCard
          prWeight={stats.prWeight}
          prVolume={stats.prVolume}
          prEstimate1RM={stats.prEstimate1RM}
          suggestedNext={stats.suggestedNext}
          totalSessions={stats.totalSessions}
        />

        {stats.lastSession ? <LastSessionCard session={stats.lastSession} /> : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function LastSessionCard({ session }) {
  const date = formatDate(session.date);
  const completedCount = session.sets.filter((s) => s && s.completed).length;

  return (
    <View style={styles.lastCard}>
      <View style={styles.lastHeader}>
        <View style={styles.lastHeaderLeft}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <Text style={styles.lastTitle}>DERNIÈRE SÉANCE</Text>
        </View>
        <Text style={styles.lastDate}>{date}</Text>
      </View>

      <View style={styles.lastSetsHeader}>
        <Text style={styles.lastColLabel} numberOfLines={1}>SET</Text>
        <Text style={[styles.lastColLabel, { flex: 2, textAlign: 'center' }]}>POIDS</Text>
        <Text style={[styles.lastColLabel, { flex: 2, textAlign: 'center' }]}>REPS</Text>
        <Text style={[styles.lastColLabel, { width: 28, textAlign: 'center' }]}>✓</Text>
      </View>

      {session.sets.length === 0 ? (
        <Text style={styles.lastEmpty}>Aucune série enregistrée</Text>
      ) : (
        session.sets.map((s, i) => {
          const w = Number(s && s.weight) || 0;
          const r = Number(s && s.reps) || 0;
          const done = !!(s && s.completed);
          return (
            <View key={i} style={[styles.lastSetRow, !done && styles.lastSetRowDim]}>
              <Text style={styles.lastSetNum}>{i + 1}</Text>
              <Text style={[styles.lastSetVal, { flex: 2, textAlign: 'center' }]}>
                {w > 0 ? `${w} kg` : 'PC'}
              </Text>
              <Text style={[styles.lastSetVal, { flex: 2, textAlign: 'center' }]}>
                {r > 0 ? r : '—'}
              </Text>
              <View style={{ width: 28, alignItems: 'center' }}>
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={done ? Colors.valid : Colors.borderDim}
                />
              </View>
            </View>
          );
        })
      )}

      {session.sets.length > 0 && (
        <Text style={styles.lastSummary}>
          {completedCount}/{session.sets.length} sets validés
        </Text>
      )}

      {session.notes ? (
        <View style={styles.lastNotesRow}>
          <Ionicons name="document-text-outline" size={13} color={Colors.textMuted} style={{ marginRight: 6, flexShrink: 0 }} />
          <Text style={styles.lastNotesText}>{session.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Kpi({ label, value, icon }) {
  return (
    <View style={styles.kpi}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a20',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  headerSide: { width: 26 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },

  kpisRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  kpi: {
    flex: 1,
    backgroundColor: Colors.cardDeep,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  kpiValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  kpiLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricsToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bgAbyss,
    borderRadius: 10,
    padding: 3,
  },
  metricBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  metricBtnActive: {
    backgroundColor: Colors.primary,
  },
  metricLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  metricLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },

  footerSpacer: { height: 30 },

  // ── Dernière séance ───────────────────────────────────────────────────────
  lastCard: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  lastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lastHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastTitle: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  lastDate: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  lastSetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  lastColLabel: {
    flex: 1,
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  lastSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  lastSetRowDim: {
    opacity: 0.45,
  },
  lastSetNum: {
    flex: 1,
    color: Colors.textDim,
    fontSize: 14,
    fontWeight: '500',
  },
  lastSetVal: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  lastSummary: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'right',
  },
  lastNotesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  lastNotesText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  lastEmpty: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
