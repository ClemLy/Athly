import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated, Easing, ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/theme';
import { haptics } from '../../../services';
import { useRitualClock } from '../../../hooks/useRitualClock';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { formatClock, readableOn } from '../../../utils/ritualTimer';
import {
  CountdownBody, GuidedStepsBody, BreathingBody, FocusBody,
} from './RitualBodies';

// ─── Feuille d'un rituel ──────────────────────────────────────────────────────
// Monte depuis le bas (fondu seul si "Réduire les animations" est actif).
// Fermer un rituel commencé demande une confirmation : le chrono serait perdu.

function bodyFor(ritual) {
  if (ritual.id === 'breathing') return BreathingBody;
  if (ritual.id === 'focus') return FocusBody;
  if (Array.isArray(ritual.steps) && ritual.steps.length > 0) return GuidedStepsBody;
  return CountdownBody;
}

export default function RitualSheet({ ritual, onClose, onValidate }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const isReading = ritual.id === 'focus';
  const clock = useRitualClock(ritual.durationSeconds, { autoStart: isReading });
  const [confirmStop, setConfirmStop] = useState(false);
  const leaving = useRef(false);
  const xp = ritual.xpEarned || 20;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [anim]);

  const leave = useCallback((then) => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(anim, {
      toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => then());
  }, [anim]);

  useEffect(() => {
    if (clock.status === 'done') haptics.success();
  }, [clock.status]);

  const inProgress = (clock.status === 'running' || clock.status === 'paused') && clock.elapsed >= 5;
  const requestClose = useCallback(() => {
    if (inProgress) setConfirmStop(true);
    else leave(onClose);
  }, [inProgress, leave, onClose]);

  const validate = useCallback(() => leave(() => onValidate(ritual)), [leave, onValidate, ritual]);

  const Body = bodyFor(ritual);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 40, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <View style={st.root}>
        <Animated.View style={[st.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessible={false} />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            st.sheet,
            {
              maxHeight: height * 0.94,
              paddingBottom: insets.bottom + 16,
              opacity: anim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={st.handle} />

          <View style={st.header}>
            <View style={[st.iconBox, { backgroundColor: `${ritual.color}1F` }]}>
              <Ionicons name={ritual.icon} size={22} color={ritual.color} />
            </View>
            <View style={st.headerText}>
              <Text style={st.title} accessibilityRole="header">{ritual.name}</Text>
              <Text style={st.subtitle}>{ritual.timerLabel} · +{xp} XP</Text>
            </View>
            <Pressable
              onPress={requestClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={({ pressed }) => [st.closeBtn, pressed && st.closeBtnPressed]}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={st.scroll}
            contentContainerStyle={st.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {clock.status === 'idle' || isReading ? (
              <Text style={st.desc}>{ritual.description}</Text>
            ) : null}
            <Body ritual={ritual} clock={clock} reducedMotion={reducedMotion} />
          </ScrollView>

          {confirmStop ? (
            <View style={st.confirm}>
              <Text style={st.confirmTitle}>Arrêter le rituel ?</Text>
              <Text style={st.confirmBody}>Ton chrono sera perdu et le rituel ne sera pas validé.</Text>
              <View style={st.confirmRow}>
                <ActionButton label="Arrêter" variant="danger" onPress={() => leave(onClose)} style={st.flex1} />
                <ActionButton label="Continuer" color={ritual.color} onPress={() => setConfirmStop(false)} style={st.flex1} />
              </View>
            </View>
          ) : (
            <Controls ritual={ritual} clock={clock} xp={xp} isReading={isReading} onValidate={validate} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Barre d'action ───────────────────────────────────────────────────────────

function Controls({ ritual, clock, xp, isReading, onValidate }) {
  if (clock.status === 'done') {
    return (
      <ActionButton
        icon="checkmark"
        label={`Valider le rituel · +${xp} XP`}
        color={Colors.valid}
        onPress={onValidate}
      />
    );
  }
  if (isReading) {
    return (
      <ActionButton
        icon="lock-closed-outline"
        label={`Valider dans ${formatClock(clock.remaining)}`}
        disabled
        accessibilityHint="Le bouton s'active à la fin du temps de lecture."
      />
    );
  }
  if (clock.status === 'running') {
    return <ActionButton icon="pause" label="Mettre en pause" variant="outline" color={ritual.color} onPress={clock.pause} />;
  }
  if (clock.status === 'paused') {
    return <ActionButton icon="play" label="Reprendre" color={ritual.color} onPress={clock.resume} />;
  }
  return <ActionButton icon="play" label="Démarrer" color={ritual.color} onPress={() => { haptics.selection(); clock.start(); }} />;
}

function ActionButton({ icon, label, color = Colors.primary, variant = 'fill', disabled, onPress, style, accessibilityHint }) {
  const fill = variant === 'fill' && !disabled;
  const fg = disabled
    ? Colors.textMuted
    : variant === 'danger' ? Colors.destructive
      : variant === 'outline' ? color
        : readableOn(color);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        st.btn,
        fill && { backgroundColor: color },
        variant === 'outline' && { borderColor: `${color}66`, backgroundColor: `${color}12` },
        variant === 'danger' && { borderColor: `${Colors.destructive}55` },
        disabled && st.btnDisabled,
        pressed && !disabled && st.btnPressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[st.btnText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeBtnPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },

  scroll: { flexGrow: 0 },
  scrollContent: { gap: 18, paddingBottom: 20 },
  desc: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22 },

  confirm: { gap: 6 },
  confirmTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  confirmBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  confirmRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },

  btn: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: Colors.glassBorder },
  btnPressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  btnText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
