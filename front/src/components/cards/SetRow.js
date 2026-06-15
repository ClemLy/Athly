import React, { useCallback } from 'react';
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

// Ligne de série : SET | POIDS (KG) | REPS | VALIDER
// Quand completed : ligne grisée, inputs verrouillés, bouton "✓ Annuler".
//
// Props :
//   - index (0-based, on affiche index+1)
//   - setData : { weight, reps, completed }
//   - onChange : (patch) => void
//   - onToggle : () => void
//
function SetRow({ index, setData = {}, onChange, onToggle }) {
  const completed = !!setData.completed;
  const weight = setData.weight !== undefined && setData.weight !== null ? String(setData.weight) : '';
  const reps = setData.reps !== undefined && setData.reps !== null ? String(setData.reps) : '';

  const handleToggle = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (e) {}
    if (onToggle) onToggle();
  }, [onToggle]);

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

  return (
    <View style={[styles.row, completed && styles.rowDone]}>
      <View style={styles.colSet}>
        <Text style={styles.setIndex}>{index + 1}</Text>
      </View>

      <View style={styles.colWeight}>
        <TextInput
          value={weight}
          onChangeText={handleWeight}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          editable={!completed}
          selectTextOnFocus
          underlineColorAndroid="transparent"
        />
      </View>

      <View style={styles.colReps}>
        <TextInput
          value={reps}
          onChangeText={handleReps}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          editable={!completed}
          selectTextOnFocus
          underlineColorAndroid="transparent"
        />
      </View>

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
  rowDone: {
    opacity: 0.45,
  },
  colSet: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 18,
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
  input: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 50,
    paddingVertical: 0,
    paddingHorizontal: 0,
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
