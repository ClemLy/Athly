import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { aggregateExercise, getExerciseSessions } from '../../services';
import ExerciseStatsChart from '../../components/stats/ExerciseStatsChart';

// Progression d'un exercice : record, objectif de la prochaine séance, courbe,
// puis l'historique complet des séances (séries faites, meilleure série).
//
// route.params :
//   - exerciseRef : { id, name } OU string

const fmt = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');

function shortDate(iso, withYear = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

const METRICS = [
  { id: 'maxWeight', label: 'Charge max' },
  { id: 'volume', label: 'Volume' },
];

const HISTORY_PREVIEW = 5;

export default function ExerciseStatsScreen({ route, navigation }) {
  const params = (route && route.params) || {};
  const exerciseRef = params.exerciseRef || null;
  const exerciseName = (exerciseRef && (exerciseRef.name || exerciseRef)) || 'Exercice';

  const { sessionLogs: logs } = useWorkoutLogs();
  const [metric, setMetric] = useState('maxWeight');
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => aggregateExercise(logs, exerciseRef), [logs, exerciseRef]);
  // Séances les plus récentes en premier, seulement celles avec au moins une série faite.
  const sessions = useMemo(
    () => getExerciseSessions(logs, exerciseRef)
      .filter((s) => s.sets.some((x) => x && x.completed))
      .reverse(),
    [logs, exerciseRef],
  );

  const hasData = sessions.length > 0;

  // Record de charge : sa date et le gain depuis la toute première séance.
  const record = useMemo(() => {
    const pts = (stats.points || []).filter((p) => p.maxWeight > 0);
    if (pts.length === 0) return null;
    let best = pts[0];
    pts.forEach((p) => { if (p.maxWeight >= best.maxWeight) best = p; });
    return { weight: best.maxWeight, date: best.date, gain: best.maxWeight - pts[0].maxWeight };
  }, [stats.points]);

  const firstDate = sessions.length ? sessions[sessions.length - 1].date : null;
  const suggestion = stats.suggestedNext;
  const visibleSessions = showAll ? sessions : sessions.slice(0, HISTORY_PREVIEW);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityLabel="Retour"
          accessibilityRole="button"
          onPress={() => navigation && navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topLabel}>Progression</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Titre ── */}
        <View>
          <Text style={styles.title} accessibilityRole="header">{exerciseName}</Text>
          <Text style={styles.subtitle}>
            {hasData
              ? `${sessions.length} séance${sessions.length > 1 ? 's' : ''}  ·  depuis le ${shortDate(firstDate)}`
              : 'Aucune séance enregistrée pour le moment'}
          </Text>
        </View>

        {!hasData ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="trending-up" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Ta courbe démarre à ta première séance</Text>
            <Text style={styles.emptyBody}>
              Valide des séries sur cet exercice : ton record, ta progression et tout ton historique apparaîtront ici.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Record ── */}
            <View style={styles.card}>
              <View style={styles.recordRow}>
                <View style={styles.recordMain}>
                  <View style={styles.labelRow}>
                    <Ionicons name="trophy" size={15} color={Colors.gold} />
                    <Text style={styles.label}>Record de charge</Text>
                  </View>
                  <Text style={styles.recordValue}>
                    {record ? fmt(record.weight) : '–'}
                    <Text style={styles.recordUnit}> kg</Text>
                  </Text>
                  {record ? <Text style={styles.recordMeta}>le {shortDate(record.date)}</Text> : null}
                  {record && record.gain > 0 ? (
                    <View style={styles.gainRow}>
                      <Ionicons name="arrow-up" size={13} color={Colors.valid} />
                      <Text style={styles.gain}>+{fmt(record.gain)} kg depuis le début</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.recordSide}>
                  <MiniStat label="1RM estimé" value={stats.prEstimate1RM ? `${fmt(stats.prEstimate1RM)} kg` : '–'} />
                  <View style={styles.sideDivider} />
                  <MiniStat label="Meilleur volume" value={stats.prVolume ? `${fmtInt(stats.prVolume)} kg` : '–'} />
                </View>
              </View>
            </View>

            {/* ── Objectif de la prochaine séance ── */}
            {suggestion ? (
              <View style={[styles.card, styles.goalCard]}>
                <View style={styles.goalIcon}>
                  <Ionicons name={suggestion.reason === 'progress' ? 'trending-up' : 'repeat'} size={20} color={Colors.primary} />
                </View>
                <View style={styles.goalText}>
                  <Text style={styles.label}>Prochaine séance</Text>
                  <Text style={styles.goalValue}>
                    {fmt(suggestion.weight)} kg
                    {suggestion.delta ? <Text style={styles.goalDelta}>{`  +${fmt(suggestion.delta)} kg`}</Text> : null}
                  </Text>
                  <Text style={styles.goalSub}>
                    {suggestion.reason === 'progress'
                      ? 'Toutes tes séries étaient faites la dernière fois : on monte.'
                      : 'Toutes les séries n\'étaient pas faites : on consolide à la même charge.'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── Courbe ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Progression</Text>
                <View style={styles.segmented} accessibilityRole="tablist">
                  {METRICS.map((m) => {
                    const active = m.id === metric;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => setMetric(m.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <Text style={styles.chartHint}>
                {metric === 'volume' ? 'Poids × répétitions, toutes séries confondues (kg)' : 'Charge la plus lourde soulevée à chaque séance'}
              </Text>
              <ExerciseStatsChart points={stats.points} metric={metric} />
            </View>

            {/* ── Historique ── */}
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 4 }]}>Historique des séances</Text>
              {visibleSessions.map((s, i) => (
                <SessionRow
                  key={`${s.logId || s.date}-${i}`}
                  session={s}
                  isFirst={i === 0}
                  isRecord={!!record && s.date === record.date}
                />
              ))}
              {sessions.length > HISTORY_PREVIEW ? (
                <Pressable
                  onPress={() => setShowAll((v) => !v)}
                  style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.moreText}>
                    {showAll ? 'Afficher moins' : `Voir les ${sessions.length} séances`}
                  </Text>
                  <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// Une séance passée : date, puis ses séries. Même charge partout → une ligne
// « 35 kg × 10 · 9 · 8 · 8 » ; charges différentes → une pastille par série.
function SessionRow({ session, isFirst, isRecord }) {
  const done = session.sets.filter((x) => x && x.completed);
  const weights = done.map((x) => Number(x.weight) || 0);
  const sameWeight = weights.every((w) => w === weights[0]);
  const d = new Date(session.date);
  const valid = !Number.isNaN(d.getTime());

  return (
    <View style={[styles.sessionRow, !isFirst && styles.sessionRowBorder]}>
      <View style={styles.dateTile}>
        <Text style={styles.dateDay}>{valid ? d.getDate() : '–'}</Text>
        <Text style={styles.dateMonth}>{valid ? d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : ''}</Text>
      </View>
      <View style={styles.sessionBody}>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionCount}>{done.length} série{done.length > 1 ? 's' : ''}</Text>
          {isRecord ? (
            <View style={styles.recordBadge}>
              <Ionicons name="trophy" size={11} color={Colors.gold} />
              <Text style={styles.recordBadgeText}>Record</Text>
            </View>
          ) : null}
        </View>
        {sameWeight ? (
          <Text style={styles.sessionSummary}>
            {weights[0] > 0 ? <Text style={styles.sessionWeight}>{`${fmt(weights[0])} kg`}</Text> : null}
            {weights[0] > 0 ? '  ×  ' : ''}
            {done.map((x) => x.reps).join(' · ')}
            {weights[0] > 0 ? '' : ' réps'}
          </Text>
        ) : (
          <View style={styles.chips}>
            {done.map((x, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>
                  {Number(x.weight) > 0 ? `${fmt(x.weight)} × ${x.reps}` : `${x.reps} réps`}
                </Text>
              </View>
            ))}
          </View>
        )}
        {session.notes ? (
          <View style={styles.noteRow}>
            <Ionicons name="document-text-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.noteText}>{session.notes}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topLabel: { color: Colors.textMuted, fontSize: 13.5, fontWeight: '600', marginLeft: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 48, gap: 14 },

  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 6, fontVariant: ['tabular-nums'] },

  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },

  recordRow: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  recordMain: { flex: 1.3 },
  recordValue: { color: Colors.textPrimary, fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 6, fontVariant: ['tabular-nums'] },
  recordUnit: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0 },
  recordMeta: { color: Colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  gainRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  gain: { color: Colors.valid, fontSize: 13, fontWeight: '700' },
  recordSide: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  sideDivider: { height: 14 },
  mini: {},
  miniValue: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  miniLabel: { color: Colors.textMuted, fontSize: 12.5, marginTop: 2 },

  goalCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderColor: 'rgba(254,116,57,0.25)' },
  goalIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(254,116,57,0.14)', alignItems: 'center', justifyContent: 'center',
  },
  goalText: { flex: 1 },
  goalValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  goalDelta: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  goalSub: { color: Colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  chartHint: { color: Colors.textMuted, fontSize: 12.5, marginTop: 6, marginBottom: 12 },
  segmented: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 11, padding: 3 },
  segment: { paddingHorizontal: 12, height: 32, borderRadius: 9, justifyContent: 'center' },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  segmentText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: Colors.textPrimary },

  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  sessionRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)' },
  dateTile: {
    width: 46, height: 52, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  dateDay: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800', lineHeight: 22, fontVariant: ['tabular-nums'] },
  dateMonth: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  sessionBody: { flex: 1 },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sessionCount: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  recordBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  recordBadgeText: { color: Colors.gold, fontSize: 12, fontWeight: '800' },
  sessionSummary: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sessionWeight: { color: Colors.textPrimary, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  noteText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },

  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  moreText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: Colors.cardDeep,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: 'rgba(254,116,57,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
});
