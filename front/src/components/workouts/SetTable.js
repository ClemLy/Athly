import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SetRow from '../cards/SetRow';
import { Colors } from '../../constants/theme';

// Tableau des séries : [-] SET | POIDS (KG) | REPS | VALIDER
//
// Props :
//   - sets     : array<{ weight, reps, completed }>
//   - onToggle : (setIndex) => void
//   - onChange : (setIndex, { weight, reps }) => void
//   - onRemove : (setIndex) => void | undefined
//   - compact  : bool – zéro marge/radius pour InlineExerciseBlock
//
// Autocomplétion :
//   Quand le SET 1 a weight > 0 ET reps > 0 simultanément (i.e. les deux
//   champs sont remplis), les valeurs sont copiées dans les sets suivants
//   qui sont encore vides (weight = 0 ou '' ET reps = 0 ou '').
//   Ces valeurs sont RÉELLES (stockées en state), pas des placeholders.

function HeaderCell({ children, style, align = 'center' }) {
  return (
    <View style={[
      styles.headerCellWrap,
      style,
      { alignItems: align === 'left' ? 'flex-start' : 'center' },
    ]}>
      <Text style={styles.headerText}>{children}</Text>
    </View>
  );
}

export default function SetTable({ sets = [], onToggle, onChange, onRemove, compact = false }) {
  const canRemove = !!onRemove && sets.length > 1;

  // Mémorise les valeurs précédentes auto-remplies pour propager chaque frappe
  // (sans ça, dès que les sets suivants ont reps=3, isEmpty=false bloque la mise
  // à jour suivante quand l'utilisateur tape "0" pour finir "30").
  const lastAutoFill = useRef({ weight: 0, reps: 0 });

  const handleChange = useCallback((i, patch) => {
    if (!onChange) return;
    onChange(i, patch);

    if (i !== 0) return;

    const newWeight = Number(patch.weight) || 0;
    const newReps   = Number(patch.reps)   || 0;
    if (newWeight <= 0 || newReps <= 0) return;

    const prev = lastAutoFill.current;

    sets.forEach((s, idx) => {
      if (idx === 0 || s.completed) return;
      const sw = Number(s.weight) || 0;
      const sr = Number(s.reps)   || 0;
      const isEmpty       = sw === 0 && sr === 0;
      // Aussi mettre à jour si ce set a été auto-rempli au keystroke précédent
      const wasAutoFilled = sw === prev.weight && sr === prev.reps && (prev.weight > 0 || prev.reps > 0);
      if (!isEmpty && !wasAutoFilled) return;
      onChange(idx, { weight: newWeight, reps: newReps });
    });

    lastAutoFill.current = { weight: newWeight, reps: newReps };
  }, [onChange, sets]);

  return (
    <View style={[styles.table, compact && styles.tableCompact]}>

      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.colDel} />
        <HeaderCell style={styles.colSet} align="left">SET</HeaderCell>
        <HeaderCell style={styles.colWeight}>POIDS (KG)</HeaderCell>
        <HeaderCell style={styles.colReps}>REPS</HeaderCell>
        <HeaderCell style={styles.colBtn}> </HeaderCell>
      </View>

      {/* ── Lignes ───────────────────────────────────────────────────── */}
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
            onToggle={() => onToggle && onToggle(i)}
            onChange={(patch) => handleChange(i, patch)}
            onRemove={canRemove ? () => onRemove(i) : null}
          />
        ))
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23232b',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tableCompact: {
    marginHorizontal: 0,
    borderRadius: 0,
    borderWidth: 0,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#16161c',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#23232b',
  },
  headerCellWrap: {
    justifyContent: 'center',
  },
  headerText: {
    color: '#8B95A3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Colonnes — alignées avec celles de SetRow
  colDel: {
    width: 36,
  },
  colSet: {
    flex: 1,
    paddingLeft: 4,
  },
  colWeight: {
    flex: 2,
  },
  colReps: {
    flex: 2,
  },
  colBtn: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
