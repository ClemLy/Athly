import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';

// Ligne de série : [-] SET | POIDS (KG) | REPS | VALIDER
//
// Props :
//   - index    : 0-based, on affiche index+1
//   - setData  : { weight, reps, completed }
//   - onChange : (patch) => void
//   - onToggle : () => void
//   - onRemove : () => void | null  – bouton [-] visible si non null
//
// Code couleur :
//   - Non commencée   : fond transparent
//   - En cours (focus): fond violet translucide + bordure gauche violette
//   - Validée         : fond vert translucide + opacité réduite

function SetRow({ index, setData = {}, onChange, onToggle, onRemove }) {
  const [focused, setFocused] = useState(false);

  const completed = !!setData.completed;

  // Affiche '' quand la valeur est 0 ou vide (champ "non rempli"),
  // affiche la valeur réelle sinon. Vider le champ → '' en state.
  const weight = setData.weight ? String(setData.weight) : '';
  const reps   = setData.reps   ? String(setData.reps)   : '';

  const handleToggle = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (e) {}
    if (onToggle) onToggle();
  }, [onToggle]);

  const handleRemove = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (e) {}
    if (onRemove) onRemove();
  }, [onRemove]);

  // '' → '' en state (champ vidé), sinon conversion numérique.
  // On conserve '' pour ne pas afficher "0" quand le champ est effacé.
  const handleWeight = useCallback((text) => {
    if (completed) return;
    const value = text === '' ? '' : Number(text.replace(',', '.')) || 0;
    if (onChange) onChange({ weight: value, reps: setData.reps });
  }, [onChange, setData.reps, completed]);

  const handleReps = useCallback((text) => {
    if (completed) return;
    const value = text === '' ? '' : Number(text) || 0;
    if (onChange) onChange({ weight: setData.weight, reps: value });
  }, [onChange, setData.weight, completed]);

  const rowStyle = [
    styles.row,
    focused && !completed && styles.rowFocused,
    completed && styles.rowDone,
  ];

  return (
    <View style={rowStyle}>

      {/* ── [-] suppression ───────────────────────────────────────────── */}
      <View style={styles.colDel}>
        {onRemove ? (
          <TouchableOpacity
            onPress={handleRemove}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            activeOpacity={0.6}
            disabled={completed}
          >
            <Ionicons
              name="remove-circle-outline"
              size={19}
              color={completed ? 'transparent' : 'rgba(255,77,77,0.50)'}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.delPlaceholder} />
        )}
      </View>

      {/* ── Numéro ────────────────────────────────────────────────────── */}
      <View style={styles.colSet}>
        <Text style={[styles.setIndex, focused && !completed && styles.setIndexFocused]}>
          {index + 1}
        </Text>
      </View>

      {/* ── Poids ─────────────────────────────────────────────────────── */}
      <View style={styles.colWeight}>
        <TextInput
          value={weight}
          onChangeText={handleWeight}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, focused && !completed && styles.inputFocused]}
          editable={!completed}
          selectTextOnFocus
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      {/* ── Reps ──────────────────────────────────────────────────────── */}
      <View style={styles.colReps}>
        <TextInput
          value={reps}
          onChangeText={handleReps}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, focused && !completed && styles.inputFocused]}
          editable={!completed}
          selectTextOnFocus
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>

      {/* ── VALIDER / Annuler ──────────────────────────────────────────── */}
      <View style={styles.colBtn}>
        <TouchableOpacity
          onPress={handleToggle}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          activeOpacity={0.7}
          style={[styles.valBtn, completed && styles.valBtnDone]}
        >
          {completed ? (
            <View style={styles.valBtnInner}>
              <Ionicons name="checkmark" size={11} color={Colors.valid} />
              <Text style={styles.cancelText}>Annuler</Text>
            </View>
          ) : (
            <Text style={styles.valText}>VALIDER</Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#23232b',
  },
  rowFocused: {
    backgroundColor: 'rgba(110,106,240,0.07)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondaryAccent,
  },
  rowDone: {
    opacity: 0.65,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },

  colDel: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delPlaceholder: {
    width: 19,
  },
  colSet: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  colWeight: {
    flex: 2,
    alignItems: 'center',
  },
  colReps: {
    flex: 2,
    alignItems: 'center',
  },
  colBtn: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
  },

  setIndex: {
    color: Colors.textDim,
    fontSize: 17,
    fontWeight: '500',
  },
  setIndexFocused: {
    color: Colors.secondaryAccent,
    fontWeight: '700',
  },
  input: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 50,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  inputFocused: {
    color: Colors.secondaryAccent,
  },

  valBtn: {
    borderWidth: 1.5,
    borderColor: Colors.valid,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  valBtnDone: {
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(34,197,94,0.07)',
  },
  valBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  valText: {
    color: Colors.valid,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cancelText: {
    color: Colors.valid,
    fontSize: 10,
    fontWeight: '600',
  },
});

export default React.memo(SetRow);
