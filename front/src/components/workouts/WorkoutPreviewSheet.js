import React, { useMemo, useState } from 'react';
import {
  View, Text, Image, Modal, Pressable, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { CALI_LEVELS } from '../../data/calisthenics';
import { buildPreview, lastDoneLabel } from '../../data/workoutPreview';
import { instantiateSavedWorkout } from '../../services/savedWorkouts.service';
import { plural } from '../../utils/format';
import { routineFromPlan, routineMinutes } from '../../data/warmups';
import ExerciseFigure from '../figure/ExerciseFigure';
import ExerciseDemoModal from './ExerciseDemoModal';

// ─── WorkoutPreviewSheet ──────────────────────────────────────────────────────
// Détail d'une séance avant de la lancer : chaque exercice avec sa
// démonstration en vignette, ses séries et sa fourchette visée, le muscle
// travaillé ; en tête, la durée estimée et le matériel nécessaire. Toucher un
// exercice ouvre sa démonstration en boucle.
//
// Props :
//   item           { type: 'template' | 'saved', data } | null (fermée)
//   lastDone       date de la dernière réalisation (ou null)
//   onClose        () => void
//   onLaunch       () => void
//   onLaunchMulti  () => void

const LEVEL_LABEL = Object.fromEntries(CALI_LEVELS.map((l) => [l.id, l.label]));
const LEVEL_COLOR = { debutant: '#22C55E', intermediaire: '#3B82F6', avance: '#A855F7', elite: '#F2B84B' };
function Meta({ icon, label }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={Colors.textSecondary} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function ExerciseRow({ index, exercise, info, onOpen }) {
  const { demo } = info;
  const levelColor = LEVEL_COLOR[info.level];
  return (
    <Pressable
      onPress={demo ? onOpen : undefined}
      disabled={!demo}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole={demo ? 'button' : undefined}
      accessibilityLabel={`${index + 1}. ${exercise.name}, ${info.plan}${demo ? '. Voir le mouvement' : ''}`}
    >
      <View style={styles.thumb}>
        {demo?.figure ? (
          <ExerciseFigure spec={demo.figure} t={0.75} style={styles.thumbFill} />
        ) : demo?.frames ? (
          <Image source={{ uri: demo.frames[0] }} style={styles.thumbFill} resizeMode="cover" />
        ) : (
          <Ionicons name="barbell-outline" size={22} color={Colors.textMuted} />
        )}
        <View style={styles.index}><Text style={styles.indexText}>{index + 1}</Text></View>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={2}>{exercise.name}</Text>
        <Text style={styles.rowPlan} numberOfLines={1}>{info.plan}</Text>
        <View style={styles.rowTags}>
          {info.muscle ? <Text style={styles.rowMuscle} numberOfLines={1}>{info.muscle}</Text> : null}
          {info.level ? (
            <View style={[styles.levelPill, { borderColor: `${levelColor}66`, backgroundColor: `${levelColor}1A` }]}>
              <Text style={[styles.levelText, { color: levelColor }]}>{LEVEL_LABEL[info.level]}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {demo ? <Ionicons name="play-circle-outline" size={22} color={Colors.textMuted} /> : null}
    </Pressable>
  );
}

export default function WorkoutPreviewSheet({ item, lastDone, onClose, onLaunch, onLaunchMulti }) {
  const insets = useSafeAreaInsets();
  const [demoExercise, setDemoExercise] = useState(null);

  const preview = useMemo(() => {
    if (!item?.data) return null;
    const exercises = item.type === 'template'
      ? item.data.buildExercises()
      : (instantiateSavedWorkout(item.data)?.exercises || []);
    return buildPreview(exercises);
  }, [item]);

  const data = item?.data;
  const ownWarmup = item?.type === 'saved' ? routineFromPlan(data?.warmup) : null;
  const subtitle = data?.description || data?.musclesSummary || '';
  const done = lastDoneLabel(lastDone);

  return (
    <Modal visible={!!item} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: Math.max(14, insets.bottom + 10) }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>{data?.name || 'Séance'}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onClose}
              style={styles.close}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {preview ? (
            <View style={styles.metaRow}>
              <Meta icon="barbell-outline" label={plural(preview.exercises.length, 'exercice')} />
              <Meta icon="layers-outline" label={plural(preview.sets, 'série')} />
              <Meta icon="time-outline" label={`≈ ${preview.minutes} min`} />
              {done ? <Meta icon="checkmark-done-outline" label={done} /> : null}
            </View>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {preview ? (
              <View style={styles.gear}>
                <Ionicons name="construct-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.gearText}>
                  {preview.gear.length ? `Matériel : ${preview.gear.join(', ')}` : 'Sans matériel'}
                </Text>
              </View>
            ) : null}
            {ownWarmup ? (
              <View style={styles.gear}>
                <Ionicons name="flame-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.gearText}>
                  {`Échauffement prévu : ${plural(ownWarmup.drills.length, 'mouvement')}, environ ${routineMinutes(ownWarmup)} min`}
                </Text>
              </View>
            ) : null}
            {preview?.exercises.map((ex, i) => (
              <ExerciseRow
                key={ex.id || `${ex.name}-${i}`}
                index={i}
                exercise={ex}
                info={preview.infos[i]}
                onOpen={() => setDemoExercise(ex)}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" style={styles.launch} onPress={onLaunch} activeOpacity={0.85}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.launchText}>Lancer la séance</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.multi} onPress={onLaunchMulti} activeOpacity={0.8}>
              <Ionicons name="people" size={16} color={Colors.primary} />
              <Text style={styles.multiText}>Lancer en Multi</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ExerciseDemoModal visible={!!demoExercise} exercise={demoExercise} onClose={() => setDemoExercise(null)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    maxHeight: '90%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18 },
  title: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  close: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, marginTop: 12 },
  meta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  metaText: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
  list: { flexGrow: 0, marginTop: 12 },
  listContent: { paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  gear: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 6, paddingBottom: 8 },
  gearText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 16 },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  thumb: {
    width: 76, height: 56, borderRadius: 12, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#12141C',
  },
  thumbFill: { width: '100%', height: '100%', aspectRatio: undefined },
  index: {
    position: 'absolute', top: 4, left: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)',
  },
  indexText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700' },
  rowPlan: { color: Colors.primary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  rowTags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  rowMuscle: { color: Colors.textMuted, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  levelPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
  levelText: { fontSize: 11, fontWeight: '800' },
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  launch: {
    height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary,
  },
  launchText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  multi: {
    height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.35)', backgroundColor: 'rgba(254,116,57,0.08)',
  },
  multiText: { color: Colors.primary, fontSize: 14.5, fontWeight: '700' },
});
