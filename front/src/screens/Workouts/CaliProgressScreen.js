import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useWorkoutLogs } from '../../context/WorkoutLogsContext';
import { familyStatus } from '../../data/caliProgress';
import { CALI_LEVELS } from '../../data/calisthenics';
import ExerciseFigure from '../../components/figure/ExerciseFigure';
import ExerciseDemoModal from '../../components/workouts/ExerciseDemoModal';
import { haptics } from '../../services';

// ─── Mes progressions (calisthénie) ───────────────────────────────────────────
// Une carte par famille de mouvement : le niveau atteint (le plus haut
// exercice pratiqué), la barre de progression dans l'échelle et l'étape
// suivante. Déplier une carte montre toute l'échelle ; chaque niveau ouvre sa
// démonstration et ses points clés.

const LEVEL_LABEL = Object.fromEntries(CALI_LEVELS.map((l) => [l.id, l.label]));
const LEVEL_COLOR = { debutant: '#22C55E', intermediaire: '#3B82F6', avance: '#A855F7', elite: '#F2B84B' };

function LevelPill({ level }) {
  const c = LEVEL_COLOR[level] || Colors.textSecondary;
  return (
    <View style={[styles.pill, { borderColor: `${c}66`, backgroundColor: `${c}1A` }]}>
      <Text style={[styles.pillText, { color: c }]}>{LEVEL_LABEL[level] || level}</Text>
    </View>
  );
}

function FamilyCard({ status, open, onToggle, onOpenExercise }) {
  const { family, ladder, current, next } = status;
  const idx = current ? ladder.findIndex((e) => e.id === current.id) : -1;
  const progress = ladder.length ? (idx + 1) / ladder.length : 0;
  const upcoming = next || (idx >= 0 ? ladder[idx + 1] : ladder[0]);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.cardHead, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${family.label}. ${current ? `Niveau atteint : ${current.name}` : 'Pas encore commencé'}`}
      >
        <View style={styles.familyIcon}>
          <Ionicons name={family.icon} size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.familyName}>{family.label}</Text>
          <Text style={styles.familyCurrent} numberOfLines={1}>
            {current ? current.name : 'Pas encore commencé'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
      </Pressable>

      <View style={styles.trackRow}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.max(4, progress * 100)}%` }]} />
        </View>
        <Text style={styles.trackText}>{idx + 1} / {ladder.length}</Text>
      </View>

      {upcoming ? (
        <View style={[styles.next, next && styles.nextReady]}>
          <Ionicons name={next ? 'trending-up' : 'flag-outline'} size={16} color={next ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.nextText, next && { color: Colors.textPrimary }]} numberOfLines={2}>
            {next ? `Prêt pour : ${next.name}` : current ? `Prochaine étape : ${upcoming.name}` : `Pour commencer : ${upcoming.name}`}
          </Text>
        </View>
      ) : (
        <View style={styles.next}>
          <Ionicons name="trophy-outline" size={16} color={Colors.gold} />
          <Text style={styles.nextText}>Sommet de l’échelle atteint</Text>
        </View>
      )}

      {open ? (
        <View style={styles.ladder}>
          <Text style={styles.about}>{family.about}</Text>
          {ladder.map((e, i) => {
            const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
            return (
              <Pressable
                key={e.id}
                onPress={() => onOpenExercise(e)}
                style={({ pressed }) => [styles.rung, state === 'current' && styles.rungCurrent, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel={`${e.name}, ${LEVEL_LABEL[e.level]}${state === 'current' ? ', ton niveau actuel' : state === 'done' ? ', déjà pratiqué' : ''}. Voir le mouvement`}
              >
                <View style={styles.rungThumb}>
                  <ExerciseFigure spec={e.demoFigure} t={0.75} style={styles.rungFig} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rungName, state === 'todo' && { color: Colors.textSecondary }]} numberOfLines={2}>{e.name}</Text>
                  <View style={styles.rungMeta}>
                    <LevelPill level={e.level} />
                    <Text style={styles.rungTarget}>
                      {e.target[0]} à {e.target[1]} {e.tracking === 'time' ? 's' : 'réps'}{e.unilateral ? ' par côté' : ''}
                    </Text>
                  </View>
                </View>
                {state === 'done' ? <Ionicons name="checkmark-circle" size={20} color={Colors.valid} /> : null}
                {state === 'current' ? <Ionicons name="radio-button-on" size={20} color={Colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function CaliProgressScreen({ navigation }) {
  const { sessionLogs } = useWorkoutLogs();
  const statuses = useMemo(() => familyStatus(sessionLogs), [sessionLogs]);
  const [openId, setOpenId] = useState(null);
  const [demo, setDemo] = useState(null);
  const started = statuses.filter((s) => s.current).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle} accessibilityRole="header">Mes progressions</Text>
          <Text style={styles.headerSub}>{started} famille{started > 1 ? 's' : ''} sur {statuses.length} commencée{started > 1 ? 's' : ''}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.rule}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.ruleText}>
            Commence au niveau où tu fais 2 séries propres dans la fourchette. Quand tu atteins le haut de la fourchette sur toutes tes séries, deux séances de suite, passe au niveau suivant. Une douleur vive : redescends d’un niveau.
          </Text>
        </View>

        {statuses.map((st) => (
          <FamilyCard
            key={st.family.id}
            status={st}
            open={openId === st.family.id}
            onToggle={() => { haptics.selection(); setOpenId((id) => (id === st.family.id ? null : st.family.id)); }}
            onOpenExercise={setDemo}
          />
        ))}
      </ScrollView>

      <ExerciseDemoModal visible={!!demo} exercise={demo} onClose={() => setDemo(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundDeep },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardDeep },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  headerSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  rule: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  ruleText: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  card: {
    borderRadius: 18, padding: 14, backgroundColor: Colors.cardDeep,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  familyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(254,116,57,0.12)' },
  familyName: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '800' },
  familyCurrent: { color: Colors.textSecondary, fontSize: 13.5, marginTop: 2 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  trackText: { color: Colors.textMuted, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  nextReady: {},
  nextText: { flex: 1, color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
  ladder: { marginTop: 12, gap: 6 },
  about: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginBottom: 4 },
  rung: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14 },
  rungCurrent: { backgroundColor: 'rgba(254,116,57,0.08)' },
  rungThumb: { width: 64, height: 46, borderRadius: 10, overflow: 'hidden' },
  rungFig: { width: '100%', height: '100%', aspectRatio: undefined },
  rungName: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700' },
  rungMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  rungTarget: { color: Colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  pillText: { fontSize: 11.5, fontWeight: '800' },
});
