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

// Ligne de série : Série | Précédent | kg (ou Lest) | Réps (ou Secondes) | ✓
//
// Props :
//   - index           : 0-based, on affiche index+1
//   - setData         : { weight, reps, seconds, warmup, completed }
//   - previous        : { weight, reps, seconds } | null — la même série la dernière fois
//   - tracking        : 'reps' | 'time' (tenue chronométrée : gainage, skills)
//   - bodyweight      : true si le poids du corps est la charge (colonne « Lest »)
//   - target          : [min, max] visés (affichés en fantôme quand il n'y a pas d'historique)
//   - onChange        : (patch) => void
//   - onToggle        : () => void
//   - onUsePrevious   : () => void — recopie la performance précédente
//   - onToggleWarmup  : () => void — marque / démarque une série d'échauffement
//
// Les champs vides montrent la dernière performance en fantôme : valider une
// série vide la reprend telle quelle (voir useSetLogging.toggle).

const fmt = (n) => String(n).replace('.', ',');

// Chronomètre de tenue : compte les secondes, s'arrête au toucher.
function useHoldTimer(onStop, target) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const notified = useRef(false);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (target && s >= target && !notified.current) { notified.current = true; haptics.success(); }
    }, 200);
    return () => clearInterval(id);
  }, [running, target]);
  const toggle = useCallback(() => {
    if (running) {
      setRunning(false);
      haptics.selection();
      onStop(Math.floor((Date.now() - startedAt.current) / 1000));
    } else {
      startedAt.current = Date.now();
      notified.current = false;
      setElapsed(0);
      setRunning(true);
      haptics.selection();
    }
  }, [running, onStop]);
  return { running, elapsed, toggle };
}

function SetRow({
  index, setData = {}, previous, onChange, onToggle, onUsePrevious, onToggleWarmup,
  tracking = 'reps', bodyweight = false, target = null, compact = false,
}) {
  const [focused, setFocused] = useState(null); // 'weight' | 'reps' | 'seconds' | null
  const completed = !!setData.completed;
  const warmup = !!setData.warmup;
  const timed = tracking === 'time';

  // Affiche '' quand la valeur est 0 ou vide (champ "non rempli").
  const weight = setData.weight ? fmt(setData.weight) : '';
  const reps = setData.reps ? String(setData.reps) : '';
  const seconds = setData.seconds ? String(setData.seconds) : '';

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
    if (onChange) onChange({ weight: value });
  }, [onChange, completed]);

  const handleReps = useCallback((text) => {
    if (completed) return;
    const value = text === '' ? '' : Number(text) || 0;
    if (onChange) onChange({ reps: value });
  }, [onChange, completed]);

  const handleSeconds = useCallback((text) => {
    if (completed) return;
    const value = text === '' ? '' : Math.min(3600, Number(text) || 0);
    if (onChange) onChange({ seconds: value });
  }, [onChange, completed]);

  const timer = useHoldTimer(
    useCallback((s) => { if (onChange && s > 0) onChange({ seconds: s }); }, [onChange]),
    target ? target[0] : null,
  );

  let prevLabel = '–';
  if (previous) {
    if (timed) prevLabel = previous.seconds ? `${previous.seconds} s` : '–';
    else if (previous.weight) prevLabel = `${fmt(previous.weight)} × ${previous.reps}`;
    else prevLabel = `${previous.reps} réps`;
  } else if (target) {
    prevLabel = timed ? `${target[0]} à ${target[1]} s` : `${target[0]} à ${target[1]}`;
  }
  const isTargetHint = !previous && !!target;

  const checkScale = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.85, 1] });

  const inputProps = (field) => ({
    placeholderTextColor: 'rgba(154,160,174,0.45)',
    editable: !completed,
    selectTextOnFocus: true,
    underlineColorAndroid: 'transparent',
    selectionColor: Colors.primary,
    onFocus: () => setFocused(field),
    onBlur: () => setFocused(null),
  });

  return (
    <View style={[styles.row, compact && styles.rowCompact, completed && styles.rowDone, warmup && styles.rowWarmup]}>
      <Pressable
        style={styles.colSet}
        onPress={onToggleWarmup}
        disabled={!onToggleWarmup || completed}
        hitSlop={{ top: 8, bottom: 8 }}
        accessibilityRole="button"
        accessibilityLabel={warmup
          ? `Série ${index + 1}, échauffement. Toucher pour en faire une série normale`
          : `Série ${index + 1}. Toucher pour la marquer comme série d'échauffement`}
      >
        {warmup ? (
          <View style={styles.warmBadge}><Text style={styles.warmBadgeText}>É</Text></View>
        ) : (
          <Text style={[styles.setIndex, completed && styles.setIndexDone]}>{index + 1}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.colPrev}
        onPress={onUsePrevious}
        disabled={!previous || completed || !onUsePrevious}
        accessibilityRole="button"
        accessibilityLabel={previous ? `Reprendre la dernière performance : ${prevLabel}` : isTargetHint ? `Objectif : ${prevLabel}` : 'Pas de performance précédente'}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Text style={[styles.prevText, !previous && !isTargetHint && styles.prevEmpty, isTargetHint && styles.prevTarget]} numberOfLines={1}>{prevLabel}</Text>
      </Pressable>

      {timed ? (
        <View style={styles.colSeconds}>
          <TextInput
            value={timer.running ? String(timer.elapsed) : seconds}
            onChangeText={handleSeconds}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder={previous && previous.seconds ? String(previous.seconds) : '0'}
            style={[styles.input, styles.inputSeconds, focused === 'seconds' && styles.inputFocused, completed && styles.inputDone, timer.running && styles.inputRunning]}
            accessibilityLabel={`Durée de la série ${index + 1}, en secondes`}
            {...inputProps('seconds')}
            editable={!completed && !timer.running}
          />
          {!completed ? (
            <Pressable
              onPress={timer.toggle}
              style={({ pressed }) => [styles.chronoBtn, timer.running && styles.chronoBtnOn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={timer.running ? 'Arrêter le chrono et noter la durée' : 'Lancer le chrono de la tenue'}
            >
              <Ionicons name={timer.running ? 'stop' : 'stopwatch-outline'} size={18} color={timer.running ? '#fff' : Colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.colWeight}>
            <TextInput
              value={weight}
              onChangeText={handleWeight}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={previous && previous.weight ? fmt(previous.weight) : bodyweight ? 'PDC' : '0'}
              style={[styles.input, focused === 'weight' && styles.inputFocused, completed && styles.inputDone]}
              accessibilityLabel={bodyweight ? `Lest de la série ${index + 1}, en kilos. Vide : poids du corps` : `Poids de la série ${index + 1}, en kilos`}
              {...inputProps('weight')}
            />
          </View>

          <View style={styles.colReps}>
            <TextInput
              value={reps}
              onChangeText={handleReps}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder={previous && previous.reps ? String(previous.reps) : '0'}
              style={[styles.input, focused === 'reps' && styles.inputFocused, completed && styles.inputDone]}
              accessibilityLabel={`Répétitions de la série ${index + 1}`}
              {...inputProps('reps')}
            />
          </View>
        </>
      )}

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
  rowWarmup: { backgroundColor: 'rgba(242,184,75,0.06)' },

  colSet: { width: 34, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  colPrev: { flex: 1, paddingHorizontal: 6, justifyContent: 'center', minHeight: 44 },
  colWeight: { width: 74, paddingHorizontal: 4 },
  colReps: { width: 62, paddingHorizontal: 4 },
  colSeconds: { width: 136, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  colCheck: { width: 52, alignItems: 'flex-end' },

  setIndex: { color: Colors.textSecondary, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  setIndexDone: { color: Colors.valid },
  warmBadge: {
    width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(242,184,75,0.16)', borderWidth: 1, borderColor: 'rgba(242,184,75,0.45)',
  },
  warmBadgeText: { color: '#F2B84B', fontSize: 12.5, fontWeight: '900' },

  prevText: { color: Colors.textMuted, fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  prevEmpty: { color: 'rgba(126,132,148,0.5)' },
  prevTarget: { color: 'rgba(254,116,57,0.75)' },

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
  // Largeur fixe : sur le web, un champ texte a une largeur minimale par
  // défaut qui pousserait le bouton chrono hors de la ligne.
  inputSeconds: { width: 80, minWidth: 0 },
  inputFocused: { borderColor: Colors.primary, backgroundColor: 'rgba(254,116,57,0.08)' },
  inputDone: { backgroundColor: 'transparent', color: Colors.textPrimary },
  inputRunning: { borderColor: Colors.primary, color: Colors.primary },

  chronoBtn: {
    width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.1)', borderWidth: 1, borderColor: 'rgba(254,116,57,0.3)',
  },
  chronoBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },

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
