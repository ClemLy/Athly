import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import { haptics } from '../../services';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import ExerciseFigure, { useFigureClock } from '../figure/ExerciseFigure';
import { drillsOf } from '../../data/warmups';

// ─── Échauffement / retour au calme guidé ─────────────────────────────────────
// Un mouvement à la fois : démonstration animée, consigne, puis un chrono
// (mouvements tenus, côté gauche puis côté droit) ou un nombre de
// répétitions à valider. On peut revenir, passer un mouvement ou arrêter :
// tout reste optionnel.
//
// Props : visible, routine ({ id, title, drills }), onClose, onDone(result)
//   result : { routineId, durationSeconds, drillsDone, total }

const RING = 112;
const STROKE = 7;

function Countdown({ total, remaining }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const progress = total > 0 ? 1 - remaining / total : 0;
  return (
    <View style={styles.ring} accessibilityLabel={`${remaining} secondes restantes`}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2} cy={RING / 2} r={r} stroke={Colors.primary} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - progress)} strokeLinecap="round"
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text style={styles.ringValue}>{remaining}</Text>
      <Text style={styles.ringUnit}>s</Text>
    </View>
  );
}

export default function GuidedRoutineModal({ visible, routine, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const drills = useMemo(() => (routine ? drillsOf(routine) : []), [routine]);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState(0);          // 0 = premier côté, 1 = second
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const done = useRef(new Set());
  const startedAt = useRef(0);

  const drill = drills[index] || null;
  const timed = !!drill?.seconds;
  const t = useFigureClock(visible && !!drill && !reduced, drill?.demo);

  // Nouvelle ouverture : on repart du début
  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setSide(0);
    done.current = new Set();
    startedAt.current = Date.now();
  }, [visible, routine?.id]);

  // Nouveau mouvement (ou nouveau côté) : le chrono se prépare et démarre seul
  useEffect(() => {
    if (!visible || !drill) return;
    setRemaining(drill.seconds || 0);
    setRunning(!!drill.seconds);
  }, [visible, drill, side]);

  const finish = useCallback(() => {
    haptics.success();
    onDone?.({
      routineId: routine?.id,
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      drillsDone: done.current.size,
      total: drills.length,
    });
  }, [onDone, routine?.id, drills.length]);

  const next = useCallback((markDone = true) => {
    if (!drill) return;
    if (markDone) done.current.add(drill.id);
    if (drill.perSide && side === 0 && markDone) { haptics.selection(); setSide(1); return; }
    if (index >= drills.length - 1) { finish(); return; }
    haptics.selection();
    setSide(0);
    setIndex((i) => i + 1);
  }, [drill, side, index, drills.length, finish]);

  const previous = useCallback(() => {
    haptics.selection();
    if (side === 1) { setSide(0); return; }
    setSide(0);
    setIndex((i) => Math.max(0, i - 1));
  }, [side]);

  // Chrono des mouvements tenus : décompte, puis enchaînement automatique
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || remaining > 0) return undefined;
    setRunning(false);
    const id = setTimeout(() => next(true), 350);
    return () => clearTimeout(id);
  }, [running, remaining, next]);

  if (!routine || !drill) return null;
  const kind = routine.kind === 'cooldown' ? 'Retour au calme' : 'Échauffement';
  const last = index >= drills.length - 1 && (!drill.perSide || side === 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Quitter : ${kind.toLowerCase()} interrompu`} hitSlop={8}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.kind}>{kind}</Text>
            <Text style={styles.step}>{index + 1} sur {drills.length}</Text>
          </View>
          <Pressable onPress={() => next(false)} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="Passer ce mouvement" hitSlop={8}>
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        </View>

        <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {drills.map((d, i) => (
            <View key={d.id} style={[styles.segment, i < index && styles.segmentDone, i === index && styles.segmentNow]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <ExerciseFigure spec={drill.demo} t={reduced ? 1 : t} style={styles.stage} />

          <Text style={styles.name} accessibilityRole="header">{drill.name}</Text>
          {drill.perSide ? (
            <Text style={styles.sideLabel}>{side === 0 ? 'Premier côté' : 'Change de côté'}</Text>
          ) : null}
          <Text style={styles.cue}>{drill.cue}</Text>

          <View style={styles.counter}>
            {timed ? (
              <>
                <Countdown total={drill.seconds} remaining={remaining} />
                <Pressable
                  onPress={() => { haptics.selection(); setRunning((r) => !r); }}
                  style={({ pressed }) => [styles.pauseBtn, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel={running ? 'Mettre le chrono en pause' : 'Reprendre le chrono'}
                >
                  <Ionicons name={running ? 'pause' : 'play'} size={18} color={Colors.textPrimary} />
                  <Text style={styles.pauseText}>{running ? 'Pause' : 'Reprendre'}</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.reps}>
                <Text style={styles.repsValue}>{drill.reps}</Text>
                <Text style={styles.repsUnit}>répétitions{drill.perSide ? ' de ce côté' : ''}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <Pressable
            onPress={previous}
            disabled={index === 0 && side === 0}
            style={({ pressed }) => [styles.backBtn, (index === 0 && side === 0) && { opacity: 0.35 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Mouvement précédent"
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => next(true)}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>
              {last ? 'Terminer' : timed && running ? 'Fait, suivant' : drill.perSide && side === 0 ? 'Côté suivant' : 'Fait, suivant'}
            </Text>
            <Ionicons name={last ? 'checkmark-done' : 'arrow-forward'} size={19} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.backgroundDeep, paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardDeep },
  kind: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  step: { color: Colors.textSecondary, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  skipBtn: { minWidth: 64, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  segments: { flexDirection: 'row', gap: 4, marginTop: 14 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  segmentDone: { backgroundColor: 'rgba(254,116,57,0.55)' },
  segmentNow: { backgroundColor: Colors.primary },
  body: { paddingTop: 18, paddingBottom: 12, alignItems: 'center' },
  stage: { borderRadius: 22, maxWidth: 460 },
  name: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center', marginTop: 18 },
  sideLabel: { color: Colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 6 },
  cue: { color: Colors.textSecondary, fontSize: 15.5, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 440 },
  counter: { alignItems: 'center', marginTop: 22, gap: 14 },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  ringValue: { color: Colors.textPrimary, fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringUnit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginTop: 12, marginLeft: 2 },
  pauseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 18, borderRadius: 22,
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pauseText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  reps: { alignItems: 'center' },
  repsValue: { color: Colors.textPrimary, fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  repsUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  bottom: { flexDirection: 'row', gap: 12, paddingTop: 10 },
  backBtn: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardDeep },
  cta: {
    flex: 1, height: 56, borderRadius: 16, backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
