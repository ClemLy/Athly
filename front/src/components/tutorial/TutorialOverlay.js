import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTutorial } from '../../context/TutorialContext';
import { Colors } from '../../constants/theme';

// Padding visuel autour du spotlight (léger, ne perturbe pas les coordonnées)
const SPOTLIGHT_PADDING  = 8;
// Marge gauche/droite du tooltip
const TOOLTIP_MARGIN     = 16;
// Hauteur max estimée du tooltip — sert uniquement au calcul de placement
const TOOLTIP_HEIGHT_EST = 220;
// Seuil vertical (px) : si pageY de l'élément < THRESHOLD → tooltip en-dessous
// sinon → tooltip au-dessus (algorithme strict demandé, indépendant de `position`)
const ELEMENT_Y_THRESHOLD = 250;
// Écart gap entre le bord du spotlight et le tooltip
const TOOLTIP_GAP        = 15;
// Marge de sécurité minimale par rapport aux bords de l'écran
const SCREEN_SAFE        = 12;
const GLOW_COLOR         = 'rgba(254,116,57,0.55)';

// ─── ProgressDots ─────────────────────────────────────────────────────────────

function ProgressDots({ total, current, color }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            dots.dot,
            i === current
              ? [dots.dotActive, { backgroundColor: color }]
              : dots.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  dotActive:   { width: 10, height: 6, borderRadius: 3 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.22)' },
});

// ─── ChapterBadge ─────────────────────────────────────────────────────────────

function ChapterBadge({ chapter }) {
  return (
    <View style={[badge.wrap, { borderColor: Colors.primary + '50' }]}>
      <Ionicons name={chapter.icon} size={10} color={Colors.primary} />
      <Text style={badge.text}>{chapter.subtitle} · {chapter.title}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(254,116,57,0.12)',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10,
  },
  text: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── TutorialOverlay ──────────────────────────────────────────────────────────

export default function TutorialOverlay({ navigation }) {
  const {
    isActive, activeChapter, activeStep, stepIndex,
    isLastStep, targets, nextStep, dismiss,
  } = useTutorial();

  const { height: H } = useWindowDimensions();

  const slideY  = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    slideY.setValue(24);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, tension: 120, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [slideY, opacity]);

  useEffect(() => {
    if (isActive && activeStep) animateIn();
  }, [isActive, stepIndex, animateIn]);

  if (!isActive || !activeChapter || !activeStep) return null;

  // ─── Spotlight geometry ──────────────────────────────────────────────────
  const targetRect = activeStep.targetKey ? targets[activeStep.targetKey] : null;
  const hasSpot    = !!targetRect;

  const sp = hasSpot ? {
    x: targetRect.x - SPOTLIGHT_PADDING,
    y: targetRect.y - SPOTLIGHT_PADDING,
    w: targetRect.width  + SPOTLIGHT_PADDING * 2,
    h: targetRect.height + SPOTLIGHT_PADDING * 2,
  } : null;

  // ─── Positionnement du tooltip (algorithme strict basé sur pageY) ─────────
  //
  // Règle absolue :
  //   • Pas de cible OU position === 'center'  → centré verticalement
  //   • pageY de l'élément < ELEMENT_Y_THRESHOLD (250 px)
  //       → tooltip EN-DESSOUS  : top = pageY + height + GAP
  //   • pageY ≥ ELEMENT_Y_THRESHOLD
  //       → tooltip AU-DESSUS   : top = pageY - TOOLTIP_HEIGHT_EST - GAP
  //
  // Les coordonnées utilisées sont celles de l'élément brut (targetRect),
  // pas les valeurs paddées du spotlight, pour un placement pixel-perfect.
  const tooltipStyle = (() => {
    const base = { position: 'absolute', left: TOOLTIP_MARGIN, right: TOOLTIP_MARGIN };

    if (!hasSpot || activeStep.position === 'center') {
      return { ...base, top: Math.max(SCREEN_SAFE, H / 2 - TOOLTIP_HEIGHT_EST / 2) };
    }

    const elemY = targetRect.y;      // pageY réel de l'élément (coordonnée native)
    const elemH = targetRect.height; // hauteur réelle de l'élément

    if (elemY < ELEMENT_Y_THRESHOLD) {
      // Élément dans la partie HAUTE de l'écran → tooltip en-dessous
      const topBelow = elemY + elemH + TOOLTIP_GAP;
      return { ...base, top: Math.min(topBelow, H - TOOLTIP_HEIGHT_EST - SCREEN_SAFE) };
    } else {
      // Élément dans la partie BASSE/MILIEU → tooltip au-dessus
      const topAbove = elemY - TOOLTIP_HEIGHT_EST - TOOLTIP_GAP;
      return { ...base, top: Math.max(SCREEN_SAFE, topAbove) };
    }
  })();

  const chapterColor = Colors.primary;
  const totalSteps   = activeChapter.steps.length;
  const isEndCard    = !!activeStep.isLast;
  const isAction     = !!activeStep.actionRequired;

  const handleNext = () => nextStep(navigation);

  const nextLabel = isEndCard  ? 'Terminer le tutoriel ✓'
    : isLastStep ? 'Chapitre suivant'
    : 'Suivant';

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      {/* ── Backdrop ── */}
      {hasSpot ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {/* Quand actionRequired, les dims passent en "none" pour laisser les touches
              traverser le Modal et atteindre les éléments derrière le spotlight. */}
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: sp.y }]}             pointerEvents={isAction ? 'none' : 'auto'} />
          <View style={[styles.dim, { top: sp.y, left: 0, width: sp.x, height: sp.h }]}       pointerEvents={isAction ? 'none' : 'auto'} />
          <View style={[styles.dim, { top: sp.y, left: sp.x + sp.w, right: 0, height: sp.h }]} pointerEvents={isAction ? 'none' : 'auto'} />
          <View style={[styles.dim, { top: sp.y + sp.h, left: 0, right: 0, bottom: 0 }]}      pointerEvents={isAction ? 'none' : 'auto'} />
          {/* Le spotBorder est toujours non-interactif : c'est un décor visuel pur. */}
          <View style={[styles.spotBorder, { top: sp.y, left: sp.x, width: sp.w, height: sp.h }]} pointerEvents="none" />
        </View>
      ) : (
        <View style={styles.fullDim} pointerEvents="none" />
      )}

      {/* Tap outside spotlight → avance (sauf si actionRequired) */}
      {hasSpot && !isAction && (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleNext} />
      )}

      {/* ── Tooltip ── */}
      <Animated.View
        style={[styles.tooltip, tooltipStyle, { opacity, transform: [{ translateY: slideY }] }]}
        pointerEvents="box-none"
      >
        <ChapterBadge chapter={activeChapter} />
        <Text style={styles.stepTitle}>{activeStep.title}</Text>
        <Text style={styles.stepBody}>{activeStep.body}</Text>

        <View style={styles.footer}>
          <ProgressDots total={totalSteps} current={stepIndex} color={chapterColor} />

          {isAction ? (
            // Step actionRequired : bouton désactivé, hint animé
            <View style={styles.actionHintWrap}>
              <Ionicons name="finger-print-outline" size={14} color={Colors.primary} />
              <Text style={styles.actionHint}>{activeStep.hint || 'Effectue l\'action pour continuer'}</Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={dismiss} activeOpacity={0.75}>
                <Text style={styles.skipTxt}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: '#6E6AF0' }]}
                onPress={handleNext}
                activeOpacity={0.82}
              >
                <Text style={styles.nextTxt}>{nextLabel}</Text>
                {!isEndCard && isLastStep && (
                  <Ionicons name="arrow-forward" size={13} color="#fff" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bouton Passer toujours accessible même en actionRequired */}
        {isAction && (
          <TouchableOpacity style={styles.skipBtnBottom} onPress={dismiss} activeOpacity={0.7}>
            <Text style={styles.skipTxt}>Passer le tutoriel</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fullDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' },
  dim:      { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.78)' },
  spotBorder: {
    position: 'absolute',
    borderWidth: 2, borderColor: GLOW_COLOR, borderRadius: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85, shadowRadius: 16, elevation: 0,
  },
  tooltip: {
    backgroundColor: 'rgba(14,14,22,0.97)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderTopColor: 'rgba(255,255,255,0.20)',
    padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55, shadowRadius: 28, elevation: 24,
  },
  stepTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  stepBody:  { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btnRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skipBtn:   { paddingVertical: 8, paddingHorizontal: 12 },
  skipTxt:   { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  nextBtn:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 },
  nextTxt:   { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },

  // Action required
  actionHintWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(254,116,57,0.10)',
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.28)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    flex: 1,
  },
  actionHint:    { color: Colors.primary, fontSize: 12, fontWeight: '700', flex: 1 },
  skipBtnBottom: { alignSelf: 'center', paddingTop: 10 },
});
