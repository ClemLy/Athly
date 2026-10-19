import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SetRow from '../cards/SetRow';
import { Colors } from '../../constants/theme';

// Tableau des séries : Série | Précédent | kg (ou Lest) | Réps (ou Secondes) | ✓
//
// Props :
//   - sets          : array<{ weight, reps, completed }>
//   - onToggle      : (setIndex) => void
//   - onChange      : (setIndex, { weight, reps }) => void
//   - previousFor   : (setIndex) => { weight, reps } | null
//   - onUsePrevious : (setIndex) => void
//   - onAdd         : () => void — « + Ajouter une série »
//   - onRemoveLast  : () => void | null — « Retirer » (dernière série non validée)
//   - compact       : bool — sans marge ni bordure (vue « Tout afficher »)
//
// Autocomplétion : quand la série 1 a un poids ET des répétitions, les valeurs
// sont recopiées dans les séries suivantes encore vides (valeurs réelles).

function HeaderCell({ children, style }) {
  return <Text style={[styles.headerText, style]}>{children}</Text>;
}

export default function SetTable({
  sets = [], onToggle, onChange, previousFor, onUsePrevious, onAdd, onRemoveLast, onToggleWarmup,
  tracking = 'reps', bodyweight = false, target = null, showWarmupHint = false, compact = false,
}) {
  const timed = tracking === 'time';
  // Mémorise les valeurs auto-remplies pour propager chaque frappe (sans ça,
  // dès que les séries suivantes ont reps=3, elles ne suivent plus quand
  // l'utilisateur tape « 0 » pour finir « 30 »).
  const lastAutoFill = useRef({ weight: 0, reps: 0, seconds: 0 });

  const handleChange = useCallback((i, patch) => {
    if (!onChange) return;
    onChange(i, patch);
    const first = sets.findIndex((s) => !s.warmup);
    if (i !== first) return;

    const cur = { ...sets[i], ...patch };
    const next = {
      weight: Number(cur.weight) || 0,
      reps: Number(cur.reps) || 0,
      seconds: Number(cur.seconds) || 0,
    };
    // Série de référence complète : charge (ou poids du corps) ET répétitions,
    // ou une durée pour une tenue.
    const complete = timed ? next.seconds > 0 : next.reps > 0 && (next.weight > 0 || bodyweight);
    if (!complete) return;

    const prev = lastAutoFill.current;
    sets.forEach((s, idx) => {
      if (idx <= i || s.completed || s.warmup) return;
      const sw = Number(s.weight) || 0;
      const sr = Number(s.reps) || 0;
      const ss = Number(s.seconds) || 0;
      const isEmpty = sw === 0 && sr === 0 && ss === 0;
      const wasAutoFilled = sw === prev.weight && sr === prev.reps && ss === prev.seconds
        && (prev.weight > 0 || prev.reps > 0 || prev.seconds > 0);
      if (!isEmpty && !wasAutoFilled) return;
      onChange(idx, timed ? { seconds: next.seconds } : { weight: next.weight, reps: next.reps });
    });
    lastAutoFill.current = next;
  }, [onChange, sets, timed, bodyweight]);

  return (
    <View style={[styles.table, compact && styles.tableCompact]}>
      <View style={styles.headerRow}>
        <HeaderCell style={styles.colSet}>Série</HeaderCell>
        <HeaderCell style={styles.colPrev}>{previousFor && previousFor(0) ? 'Précédent' : target ? 'Objectif' : 'Précédent'}</HeaderCell>
        {timed ? (
          <HeaderCell style={styles.colSeconds}>Secondes</HeaderCell>
        ) : (
          <>
            <HeaderCell style={styles.colWeight}>{bodyweight ? 'Lest' : 'kg'}</HeaderCell>
            <HeaderCell style={styles.colReps}>Réps</HeaderCell>
          </>
        )}
        <View style={styles.colCheck} />
      </View>

      {sets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune série pour cet exercice</Text>
        </View>
      ) : (
        sets.map((s, i) => (
          <SetRow
            key={`set-${i}`}
            index={i}
            setData={s}
            compact={compact}
            previous={previousFor ? previousFor(i) : null}
            tracking={tracking}
            bodyweight={bodyweight}
            target={target}
            onToggle={() => onToggle && onToggle(i)}
            onChange={(patch) => handleChange(i, patch)}
            onUsePrevious={onUsePrevious ? () => onUsePrevious(i) : undefined}
            onToggleWarmup={onToggleWarmup ? () => onToggleWarmup(i) : undefined}
          />
        ))
      )}

      {showWarmupHint && onToggleWarmup ? (
        <Text style={styles.hint}>
          Touche un numéro de série pour la marquer en échauffement : elle ne comptera ni dans l’XP ni dans tes records.
        </Text>
      ) : null}

      {(onAdd || onRemoveLast) ? (
        <View style={styles.footer}>
          {onAdd ? (
            <Pressable
              style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
              onPress={onAdd}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addText}>Ajouter une série</Text>
            </Pressable>
          ) : null}
          {onRemoveLast ? (
            <Pressable
              style={({ pressed }) => [styles.footerBtn, styles.removeBtn, pressed && styles.footerBtnPressed]}
              onPress={onRemoveLast}
              accessibilityRole="button"
              accessibilityLabel="Retirer la dernière série"
            >
              <Ionicons name="remove" size={18} color={Colors.textSecondary} />
              <Text style={styles.removeText}>Retirer</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginHorizontal: 20,
    borderRadius: 18,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tableCompact: {
    marginHorizontal: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerText: { color: Colors.textMuted, fontSize: 12.5, fontWeight: '600', textAlign: 'center' },

  // Colonnes — alignées sur SetRow
  colSet: { width: 34 },
  colPrev: { flex: 1, textAlign: 'left', paddingHorizontal: 6 },
  colWeight: { width: 74 },
  colReps: { width: 62 },
  colSeconds: { width: 136 },
  colCheck: { width: 52 },
  hint: {
    color: Colors.textMuted, fontSize: 12.5, lineHeight: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)',
  },

  empty: { paddingVertical: 22, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },

  footer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 50,
  },
  footerBtnPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  removeBtn: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    paddingHorizontal: 20,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  addText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  removeText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
