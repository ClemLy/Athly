import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { WARMUP_DRILLS } from '../../data/calisthenics';
import {
  PICKABLE_DRILLS, WARMUP_ROUTINES, MAX_PLAN_DRILLS, suggestDrillIds, routineFromPlan, routineMinutes, drillSeconds,
} from '../../data/warmups';
import { haptics } from '../../services';
import { plural } from '../../utils/format';
import ExerciseFigure from '../figure/ExerciseFigure';
import ActionSheetModal from '../common/ActionSheetModal';

// ─── Échauffement d'une séance, à la création ─────────────────────────────────
// Optionnel. Activé, il propose des mouvements adaptés aux muscles travaillés
// (modifiables : retirer, déplacer, ajouter, ou partir d'une routine toute
// faite). Désactivé, l'échauffement conseillé est proposé au lancement, comme
// avant.
//
// Props :
//   plan      ids des mouvements (WARMUP_DRILLS) ou null
//   onChange  (plan | null) => void
//   groups    groupes musculaires de la séance (pour la suggestion)
//   cali      séance de calisthénie (série légère plutôt que séries d'approche)

function durationLabel(drill) {
  const s = drillSeconds(drill);
  return s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`;
}

function DrillThumb({ drill }) {
  return (
    <View style={styles.thumb}>
      {drill.demo ? <ExerciseFigure spec={drill.demo} t={0.75} style={styles.thumbFill} /> : null}
    </View>
  );
}

function PickerSheet({ visible, taken, onPick, onClose }) {
  const insets = useSafeAreaInsets();
  const free = PICKABLE_DRILLS.filter((d) => !taken.includes(d.id));
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: Math.max(14, insets.bottom + 10) }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} accessibilityRole="header">Ajouter un mouvement</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} style={styles.close}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
            {free.length === 0 ? (
              <Text style={styles.empty}>Tous les mouvements sont déjà dans ton échauffement.</Text>
            ) : free.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => { haptics.selection(); onPick(d.id); }}
                style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${d.name}, ${durationLabel(d)}`}
              >
                <DrillThumb drill={d} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={2}>{d.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={2}>{durationLabel(d)} · {d.cue}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function WarmupPlanner({ plan, onChange, groups = [], cali = false }) {
  const [adding, setAdding] = useState(false);
  const [routines, setRoutines] = useState(false);
  const on = Array.isArray(plan) && plan.length > 0;
  const routine = on ? routineFromPlan(plan) : null;

  const suggest = () => suggestDrillIds(groups, { cali });
  const toggle = (v) => { haptics.selection(); onChange(v ? suggest() : null); };
  const remove = (i) => { const next = plan.filter((_, idx) => idx !== i); onChange(next.length ? next : null); };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= plan.length) return;
    const next = [...plan];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (id) => {
    const next = [...(plan || []), id];
    onChange(next);
    if (next.length >= MAX_PLAN_DRILLS) setAdding(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="flame-outline" size={20} color={Colors.primary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Échauffement</Text>
            <Text style={styles.optional}>Optionnel</Text>
          </View>
          <Text style={styles.sub}>
            {on ? `${plural(plan.length, 'mouvement')} · environ ${routineMinutes(routine)} min` : 'Aucun prévu pour cette séance'}
          </Text>
        </View>
        <Switch
          value={on}
          onValueChange={toggle}
          trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.primary }}
          thumbColor="#fff"
          accessibilityLabel="Ajouter un échauffement à cette séance"
        />
      </View>

      {!on ? (
        <Text style={styles.about}>
          Active-le pour préparer l’échauffement avec ta séance. Sinon, on te propose celui qui convient au moment de lancer.
        </Text>
      ) : (
        <>
          <Text style={styles.about}>
            {groups.length ? 'Choisi selon les muscles que tu travailles. Change ce que tu veux.' : 'Un échauffement général. Change ce que tu veux.'}
          </Text>
          <View style={styles.list}>
            {plan.map((id, i) => {
              const d = WARMUP_DRILLS[id];
              if (!d) return null;
              return (
                <View key={id} style={styles.row}>
                  <DrillThumb drill={d} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName} numberOfLines={2}>{d.name}</Text>
                    <Text style={styles.rowSub}>{durationLabel(d)}</Text>
                  </View>
                  <View style={styles.tools}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Monter ${d.name}`} disabled={i === 0}
                      onPress={() => move(i, -1)} style={[styles.tool, i === 0 && styles.toolOff]} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Descendre ${d.name}`} disabled={i === plan.length - 1}
                      onPress={() => move(i, 1)} style={[styles.tool, i === plan.length - 1 && styles.toolOff]} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Retirer ${d.name}`}
                      onPress={() => remove(i)} style={styles.tool} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => setAdding(true)}
              disabled={plan.length >= MAX_PLAN_DRILLS} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Ajouter</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => { haptics.selection(); onChange(suggest()); }} activeOpacity={0.8}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Proposer</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => setRoutines(true)} activeOpacity={0.8}>
              <Ionicons name="list-outline" size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Routines</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <PickerSheet visible={adding} taken={plan || []} onPick={add} onClose={() => setAdding(false)} />
      <ActionSheetModal
        visible={routines}
        title="Partir d'une routine"
        onClose={() => setRoutines(false)}
        options={WARMUP_ROUTINES.map((r) => ({
          label: `${r.title} · ${routineMinutes(r)} min`,
          onPress: () => onChange([...r.drills]),
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(254,116,57,0.18)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(254,116,57,0.12)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '800' },
  optional: {
    color: Colors.textSecondary, fontSize: 11.5, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
  about: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 10 },
  list: { marginTop: 8, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  thumb: { width: 64, height: 46, borderRadius: 10, overflow: 'hidden', backgroundColor: '#12141C' },
  thumbFill: { width: '100%', height: '100%', aspectRatio: undefined },
  rowName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowSub: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1, lineHeight: 17 },
  tools: { flexDirection: 'row', alignItems: 'center' },
  tool: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  toolOff: { opacity: 0.25 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  action: {
    flex: 1, height: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.35)', backgroundColor: 'rgba(254,116,57,0.07)',
  },
  actionText: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    maxHeight: '85%', width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)', paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  sheetList: { paddingHorizontal: 12, paddingBottom: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14 },
  empty: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', padding: 24 },
});
