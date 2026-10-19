import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { haptics } from '../../services';
import ActionSheetModal from '../common/ActionSheetModal';
import GuidedRoutineModal from './GuidedRoutineModal';
import { suggestRoutine, routineMinutes, WARMUP_ROUTINES } from '../../data/warmups';

// ─── Échauffement optionnel, en tête de séance ────────────────────────────────
// Routine proposée selon les exercices prévus (salle, haut du corps, bas du
// corps…), modifiable. Lancer ouvre le guide pas à pas ; « Passer » le masque.
// Une fois fait, il reste une ligne discrète avec sa durée.
//
// Props : exercises, warmup (état de la séance), onChange(warmup), hidden

export default function WarmupCard({ exercises, warmup, onChange, hidden }) {
  const suggested = useMemo(() => suggestRoutine(exercises), [exercises]);
  const [routineId, setRoutineId] = useState(null);
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const routine = WARMUP_ROUTINES.find((r) => r.id === routineId) || suggested;

  if (warmup && warmup.durationSeconds) {
    const min = Math.max(1, Math.round(warmup.durationSeconds / 60));
    return (
      <View style={styles.doneRow} accessibilityLabel={`Échauffement fait, ${min} minutes`}>
        <Ionicons name="checkmark-circle" size={18} color={Colors.valid} />
        <Text style={styles.doneText}>Échauffement fait · {min} min</Text>
      </View>
    );
  }
  if (hidden || (warmup && warmup.skipped)) return null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name="flame-outline" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Échauffement</Text>
              <Text style={styles.optional}>Optionnel</Text>
            </View>
            <Pressable
              onPress={() => { haptics.selection(); setPicker(true); }}
              accessibilityRole="button"
              accessibilityLabel={`${routine.title}, environ ${routineMinutes(routine)} minutes. Changer d'échauffement`}
              hitSlop={6}
            >
              <Text style={styles.sub}>
                {routine.title} · {routineMinutes(routine)} min · <Text style={styles.change}>Changer</Text>
              </Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.about}>{routine.about}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => { haptics.selection(); onChange?.({ skipped: true }); }}
            style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.ghostText}>Passer</Text>
          </Pressable>
          <Pressable
            onPress={() => { haptics.selection(); setOpen(true); }}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.primaryText}>Commencer</Text>
          </Pressable>
        </View>
      </View>

      <GuidedRoutineModal
        visible={open}
        routine={routine}
        onClose={() => setOpen(false)}
        onDone={(res) => { setOpen(false); onChange?.(res); }}
      />

      <ActionSheetModal
        visible={picker}
        title="Choisir l'échauffement"
        onClose={() => setPicker(false)}
        options={WARMUP_ROUTINES.map((r) => ({
          label: `${r.title} · ${routineMinutes(r)} min${r.id === suggested.id ? ' · conseillé' : ''}${r.id === routine.id ? ' · choisi' : ''}`,
          onPress: () => setRoutineId(r.id),
        }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14, padding: 16, borderRadius: 18,
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(254,116,57,0.22)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.12)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  optional: {
    color: Colors.textSecondary, fontSize: 11.5, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  sub: { color: Colors.textSecondary, fontSize: 13.5, marginTop: 3 },
  change: { color: Colors.primary, fontWeight: '700' },
  about: { color: Colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ghost: {
    height: 46, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ghostText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  primary: {
    flex: 1, height: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary,
  },
  primaryText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 },
  doneText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
