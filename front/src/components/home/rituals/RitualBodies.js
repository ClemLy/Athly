import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, ScrollView, useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/theme';
import { haptics } from '../../../services';
import { FOCUS_ARTICLES } from '../../../data/focusArticles';
import {
  formatClock, breathPhaseAt, guidedStepAt, BREATH_IN, BREATH_OUT, BREATH_CYCLE,
} from '../../../utils/ritualTimer';

// ─── Contenus des rituels ─────────────────────────────────────────────────────
// Chaque corps reçoit l'horloge du rituel (useRitualClock) et n'affiche que
// l'état : les boutons d'action vivent dans RitualSheet.

// ─── Anneau de progression ────────────────────────────────────────────────────

function ProgressRing({ size, stroke, progress, color, children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`${color}2E`} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

function DoneMark({ size = 40 }) {
  return <Ionicons name="checkmark-circle" size={size} color={Colors.valid} />;
}

// ─── Chrono simple (marche) ───────────────────────────────────────────────────

export function CountdownBody({ ritual, clock }) {
  const done = clock.status === 'done';
  const shown = clock.status === 'idle' ? ritual.durationSeconds : clock.remaining;
  const caption = done ? 'Terminé' : clock.status === 'paused' ? 'En pause' : clock.status === 'idle' ? 'au total' : 'restantes';
  return (
    <View style={s.center}>
      <ProgressRing
        size={196}
        stroke={10}
        progress={clock.progress}
        color={done ? Colors.valid : ritual.color}
        label={done ? 'Rituel terminé' : `${formatClock(shown)} ${caption}`}
      >
        {done ? <DoneMark size={48} /> : (
          <>
            <Text style={s.clockBig}>{formatClock(shown)}</Text>
            <Text style={s.clockCaption}>{caption}</Text>
          </>
        )}
      </ProgressRing>
      {ritual.runningHint && !done ? (
        <View style={s.hint}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.hintText}>{ritual.runningHint}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Rituel guidé par étapes (mobilité, automassage) ──────────────────────────

export function GuidedStepsBody({ ritual, clock }) {
  const steps = ritual.steps || [];
  const done = clock.status === 'done';
  const started = clock.status !== 'idle';
  const { index, stepLeft, stepDuration } = guidedStepAt(clock.elapsed, steps.length, ritual.durationSeconds);
  const current = steps[index];

  // Petite vibration à chaque changement de zone, pour pouvoir suivre sans regarder.
  const lastIndex = useRef(index);
  useEffect(() => {
    if (clock.status === 'running' && index !== lastIndex.current) haptics.selection();
    lastIndex.current = index;
  }, [index, clock.status]);

  const ringProgress = done ? 1 : started ? 1 - stepLeft / stepDuration : 0;

  return (
    <View style={s.center}>
      <ProgressRing
        size={148}
        stroke={8}
        progress={ringProgress}
        color={done ? Colors.valid : ritual.color}
        label={done ? 'Rituel terminé' : started ? `${formatClock(stepLeft)} pour cette étape` : `${formatClock(ritual.durationSeconds)} au total`}
      >
        {done ? <DoneMark /> : (
          <>
            <Text style={s.clockMid}>{formatClock(started ? stepLeft : ritual.durationSeconds)}</Text>
            <Text style={s.clockCaption}>{clock.status === 'paused' ? 'En pause' : started ? 'cette étape' : 'au total'}</Text>
          </>
        )}
      </ProgressRing>

      {started && !done && current ? (
        <View style={s.stepNow}>
          <Text style={[s.stepKicker, { color: ritual.color }]}>Étape {index + 1} sur {steps.length}</Text>
          <Text style={s.stepTitle}>{current.name}</Text>
          <Text style={s.stepTip}>{current.tip}</Text>
        </View>
      ) : null}

      <View style={s.stepList}>
        {steps.map((step, i) => {
          const isDone = done || (started && i < index);
          const isCurrent = started && !done && i === index;
          return (
            <View key={step.name} style={[s.stepRow, isCurrent && { backgroundColor: `${ritual.color}14`, borderColor: `${ritual.color}40` }]}>
              <Ionicons
                name={isDone ? 'checkmark-circle' : isCurrent ? 'radio-button-on' : 'ellipse-outline'}
                size={18}
                color={isDone ? Colors.valid : isCurrent ? ritual.color : Colors.textMuted}
              />
              <Text
                style={[s.stepRowText, (isCurrent || !started) && { color: Colors.textPrimary }]}
                numberOfLines={2}
              >
                {step.name}
              </Text>
              <Text style={s.stepRowTime}>{formatClock(stepDuration)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Respiration guidée ───────────────────────────────────────────────────────

const BREATH_MIN = 0.62;

export function BreathingBody({ ritual, clock, reducedMotion }) {
  const done = clock.status === 'done';
  const running = clock.status === 'running';
  const { inhale, phaseLeft, phaseRemaining, cycle, phaseKey } = breathPhaseAt(clock.elapsed);
  const totalCycles = Math.round(ritual.durationSeconds / BREATH_CYCLE);
  const scale = useRef(new Animated.Value(BREATH_MIN)).current;

  // Une animation par phase, calée sur le temps restant réel de la phase.
  useEffect(() => {
    if (!running) {
      scale.stopAnimation();
      if (clock.status === 'idle') scale.setValue(BREATH_MIN);
      if (done) Animated.timing(scale, { toValue: 0.82, duration: 300, useNativeDriver: true }).start();
      return;
    }
    haptics.selection();
    if (reducedMotion) {
      scale.setValue(0.82);
      return;
    }
    Animated.timing(scale, {
      toValue: inhale ? 1 : BREATH_MIN,
      duration: Math.max(200, phaseRemaining * 1000),
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }).start();
    // phaseRemaining est volontairement lu une seule fois par phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey, running, reducedMotion, done]);

  let label = 'Prêt ?';
  if (done) label = '';
  else if (clock.status === 'paused') label = 'En pause';
  else if (running) label = inhale ? 'Inspire' : 'Expire';

  return (
    <View style={s.center}>
      <View
        style={s.breathStage}
        accessible
        accessibilityRole="timer"
        accessibilityLabel={done ? 'Respiration terminée' : running ? `${label}, ${phaseLeft} secondes` : label}
      >
        <View style={[s.breathGuide, { borderColor: `${ritual.color}33` }]} />
        <Animated.View
          style={[
            s.breathCircle,
            {
              backgroundColor: done ? `${Colors.valid}1F` : `${ritual.color}26`,
              borderColor: done ? `${Colors.valid}80` : ritual.color,
              transform: [{ scale }],
            },
          ]}
        />
        <View style={s.breathLabel} pointerEvents="none">
          {done ? <DoneMark size={44} /> : (
            <>
              <Text style={[s.breathWord, { color: running ? Colors.textPrimary : Colors.textSecondary }]}>{label}</Text>
              {running ? <Text style={s.breathCount}>{phaseLeft}</Text> : null}
            </>
          )}
        </View>
      </View>

      <Text style={s.breathInfo}>
        {clock.status === 'idle'
          ? `Inspire ${BREATH_IN} s, expire ${BREATH_OUT} s. ${totalCycles} cycles, environ ${Math.round(ritual.durationSeconds / 60)} min.`
          : done
            ? `${totalCycles} cycles terminés.`
            : `Cycle ${Math.min(cycle, totalCycles)} sur ${totalCycles} · ${formatClock(clock.remaining)} restantes`}
      </Text>
    </View>
  );
}

// ─── Lecture du jour ──────────────────────────────────────────────────────────

export function FocusBody({ ritual, clock }) {
  const { height } = useWindowDimensions();
  const [article] = useState(() => FOCUS_ARTICLES[Math.floor(Math.random() * FOCUS_ARTICLES.length)]);
  const done = clock.status === 'done';
  return (
    <View style={s.focusWrap}>
      <View style={[s.focusChip, { borderColor: done ? `${Colors.valid}55` : `${ritual.color}40` }]}>
        <Ionicons name={done ? 'checkmark-circle' : 'time-outline'} size={14} color={done ? Colors.valid : ritual.color} />
        <Text style={[s.focusChipText, { color: done ? Colors.valid : Colors.textSecondary }]}>
          {done ? 'Lecture terminée, tu peux valider' : `Validation possible dans ${formatClock(clock.remaining)}`}
        </Text>
      </View>
      <View style={[s.article, { maxHeight: Math.max(220, height * 0.42) }]}>
        <ScrollView showsVerticalScrollIndicator nestedScrollEnabled contentContainerStyle={s.articleContent}>
          <Text style={s.articleTitle} accessibilityRole="header">{article.title}</Text>
          <Text style={s.articleBody}>{article.content}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center: { width: '100%', alignItems: 'center', gap: 16 },

  clockBig: {
    color: Colors.textPrimary, fontSize: 40, fontWeight: '800',
    fontVariant: ['tabular-nums'], letterSpacing: -1,
  },
  clockMid: {
    color: Colors.textPrimary, fontSize: 30, fontWeight: '800',
    fontVariant: ['tabular-nums'], letterSpacing: -0.5,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  hintText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', flexShrink: 1 },
  clockCaption: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },

  stepNow: { width: '100%', alignItems: 'center', gap: 4 },
  stepKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  stepTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  stepTip: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 340 },

  stepList: { width: '100%', gap: 6 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  stepRowText: { flex: 1, color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  stepRowTime: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },

  breathStage: { width: 208, height: 208, alignItems: 'center', justifyContent: 'center' },
  breathGuide: { position: 'absolute', width: 208, height: 208, borderRadius: 104, borderWidth: 1, borderStyle: 'dashed' },
  breathCircle: { position: 'absolute', width: 208, height: 208, borderRadius: 104, borderWidth: 2 },
  breathLabel: { alignItems: 'center' },
  breathWord: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  breathCount: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  breathInfo: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', fontVariant: ['tabular-nums'] },

  focusWrap: { width: '100%', gap: 12 },
  focusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  focusChipText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  article: {
    width: '100%', borderRadius: 16, borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden',
  },
  articleContent: { padding: 16, gap: 10 },
  articleTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', lineHeight: 23 },
  articleBody: { color: Colors.textSecondary, fontSize: 15, lineHeight: 23 },
});
