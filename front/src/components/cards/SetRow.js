import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { haptics } from '../../services';

// Ligne de série : Série | Précédent | kg | Réps | ✓
//
// Props :
//   - index         : 0-based, on affiche index+1
//   - setData       : { weight, reps, completed }
//   - previous      : { weight, reps } | null — la même série la dernière fois
//   - onChange      : (patch) => void
//   - onToggle      : () => void
//   - onUsePrevious : () => void — recopie la performance précédente
//
// Les champs vides montrent la dernière performance en fantôme : valider une
// série vide la reprend telle quelle (voir useSetLogging.toggle).

const fmt = (n) => String(n).replace('.', ',');

function SetRow({ index, setData = {}, previous, onChange, onToggle, onUsePrevious, compact = false }) {
  const [focused, setFocused] = useState(null); // 'weight' | 'reps' | null
  const completed = !!setData.completed;

  // Affiche '' quand la valeur est 0 ou vide (champ "non rempli").
  const weight = setData.weight ? fmt(setData.weight) : '';
  const reps = setData.reps ? String(setData.reps) : '';

  // Retour visuel de validation : la coche « rebondit ».
  const pop = useRef(new Animated.Value(completed ? 1 : 0)).current;
  useEffect(() => {
    if (completed) {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, speed: 22, bounciness: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(pop, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [completed, pop]);

  const handleToggle = useCallback(() => {
    if (!completed) haptics.success(); else haptics.selection();
    if (onToggle) onToggle();
  }, [onToggle, completed]);

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

  const prevLabel = previous
    ? (previous.weight ? `${fmt(previous.weight)} × ${previous.reps}` : `${previous.reps} réps`)
    : '—';

  const checkScale = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.85, 1] });

  return (
    <View style={[styles.row, compact && styles.rowCompact, completed && styles.rowDone]}>
      <View style={styles.colSet}>
        <Text style={[styles.setIndex, completed && styles.setIndexDone]}>{index + 1}</Text>
      </View>

      <Pressable
        style={styles.colPrev}
        onPress={onUsePrevious}
        disabled={!previous || completed || !onUsePrevious}
        accessibilityRole="button"
        accessibilityLabel={previous ? `Reprendre la dernière performance : ${prevLabel}` : 'Pas de performance précédente'}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Text style={[styles.prevText, !previous && styles.prevEmpty]} numberOfLines={1}>{prevLabel}</Text>
      </Pressable>

      <View style={styles.colWeight}>
        <TextInput
          value={weight}
          onChangeText={handleWeight}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={previous && previous.weight ? fmt(previous.weight) : '0'}
          placeholderTextColor="rgba(154,160,174,0.45)"
          style={[styles.input, focused === 'weight' && styles.inputFocused, completed && styles.inputDone]}
          editable={!completed}
          selectTextOnFocus
          underlineColorAndroid="transparent"
          selectionColor={Colors.primary}
          onFocus={() => setFocused('weight')}
          onBlur={() => setFocused(null)}
          accessibilityLabel={`Poids de la série ${index + 1}, en kilos`}
        />
      </View>

      <View style={styles.colReps}>
        <TextInput
          value={reps}
          onChangeText={handleReps}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder={previous && previous.reps ? String(previous.reps) : '0'}
          placeholderTextColor="rgba(154,160,174,0.45)"
          style={[styles.input, focused === 'reps' && styles.inputFocused, completed && styles.inputDone]}
          editable={!completed}
          selectTextOnFocus
          underlineColorAndroid="transparent"
          selectionColor={Colors.primary}
          onFocus={() => setFocused('reps')}
          onBlur={() => setFocused(null)}
          accessibilityLabel={`Répétitions de la série ${index + 1}`}
        />
      </View>

      <View style={styles.colCheck}>
        <Pressable
          onPress={handleToggle}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
          accessibilityLabel={completed ? `Série ${index + 1} validée, toucher pour annuler` : `Valider la série ${index + 1}`}
        >
          <Animated.View style={[styles.check, completed && styles.checkDone, { transform: [{ scale: checkScale }] }]}>
            <Ionicons name="checkmark" size={22} color={completed ? '#fff' : Colors.textMuted} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  rowCompact: { minHeight: 56 },
  rowDone: { backgroundColor: 'rgba(34,197,94,0.08)' },

  colSet: { width: 34, alignItems: 'center' },
  colPrev: { flex: 1, paddingHorizontal: 6, justifyContent: 'center', minHeight: 44 },
  colWeight: { width: 74, paddingHorizontal: 4 },
  colReps: { width: 62, paddingHorizontal: 4 },
  colCheck: { width: 52, alignItems: 'flex-end' },

  setIndex: { color: Colors.textSecondary, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  setIndexDone: { color: Colors.valid },

  prevText: { color: Colors.textMuted, fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  prevEmpty: { color: 'rgba(126,132,148,0.5)' },

  input: {
    height: 42,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: 'rgba(254,116,57,0.08)' },
  inputDone: { backgroundColor: 'transparent', color: Colors.textPrimary },

  check: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: Colors.valid, borderColor: Colors.valid },
});

export default React.memo(SetRow);
