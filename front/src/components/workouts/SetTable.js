import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SetRow from '../cards/SetRow';
import { Colors } from '../../constants/theme';

// Tableau des séries : Série | Précédent | kg | Réps | ✓
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
  sets = [], onToggle, onChange, previousFor, onUsePrevious, onAdd, onRemoveLast, compact = false,
}) {
  // Mémorise les valeurs auto-remplies pour propager chaque frappe (sans ça,
  // dès que les séries suivantes ont reps=3, elles ne suivent plus quand
  // l'utilisateur tape « 0 » pour finir « 30 »).
  const lastAutoFill = useRef({ weight: 0, reps: 0 });

  const handleChange = useCallback((i, patch) => {
    if (!onChange) return;
    onChange(i, patch);
    if (i !== 0) return;

    const newWeight = Number(patch.weight) || 0;
    const newReps = Number(patch.reps) || 0;
    if (newWeight <= 0 || newReps <= 0) return;

    const prev = lastAutoFill.current;
    sets.forEach((s, idx) => {
      if (idx === 0 || s.completed) return;
      const sw = Number(s.weight) || 0;
      const sr = Number(s.reps) || 0;
      const isEmpty = sw === 0 && sr === 0;
      const wasAutoFilled = sw === prev.weight && sr === prev.reps && (prev.weight > 0 || prev.reps > 0);
      if (!isEmpty && !wasAutoFilled) return;
      onChange(idx, { weight: newWeight, reps: newReps });
    });
    lastAutoFill.current = { weight: newWeight, reps: newReps };
  }, [onChange, sets]);

  return (
    <View style={[styles.table, compact && styles.tableCompact]}>
      <View style={styles.headerRow}>
        <HeaderCell style={styles.colSet}>Série</HeaderCell>
        <HeaderCell style={styles.colPrev}>Précédent</HeaderCell>
        <HeaderCell style={styles.colWeight}>kg</HeaderCell>
        <HeaderCell style={styles.colReps}>Réps</HeaderCell>
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
            onToggle={() => onToggle && onToggle(i)}
            onChange={(patch) => handleChange(i, patch)}
            onUsePrevious={onUsePrevious ? () => onUsePrevious(i) : undefined}
          />
        ))
      )}

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
  colCheck: { width: 52 },

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
