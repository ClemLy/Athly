import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, useWindowDimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTutorial } from '../../context/TutorialContext';
import { CHAPTER_IDS } from '../../data/tutorialChapters';
import { haptics } from '../../services/haptics.service';
import { Colors } from '../../constants/theme';

// Padding visuel autour du spotlight (léger, ne perturbe pas les coordonnées)
const SPOTLIGHT_PADDING  = 8;
// Marge gauche/droite du tooltip
const TOOLTIP_MARGIN     = 16;
// Hauteur estimée du tooltip AVANT sa première mesure (remplacée par la vraie
// hauteur via onLayout dès le premier rendu)
const TOOLTIP_HEIGHT_EST = 220;
// Écart gap entre le bord du spotlight et le tooltip
const TOOLTIP_GAP        = 15;
// Marge de sécurité minimale par rapport aux bords de l'écran
const SCREEN_SAFE        = 12;
// Insets approximés : barre de statut/encoche en haut, indicateur/onglets en bas.
// Gardent le tooltip lisible et cliquable hors des zones système.
const SAFE_INSET_TOP     = 44;
const SAFE_INSET_BOTTOM  = 28;
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

function ChapterBadge({ chapter, index, total }) {
  return (
    <View style={[badge.wrap, { borderColor: Colors.primary + '50' }]}>
      <Ionicons name={chapter.icon} size={10} color={Colors.primary} />
      <Text style={badge.counter}>Chapitre {index}/{total}</Text>
      <View style={badge.sep} />
      <Text style={badge.text} numberOfLines={1}>{chapter.title}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', maxWidth: '100%',
    backgroundColor: 'rgba(254,116,57,0.12)',
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10,
  },
  counter: { color: Colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  sep:     { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.primary, opacity: 0.6 },
  text:    { color: Colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.3, flexShrink: 1 },
});

// ─── TutorialOverlay ──────────────────────────────────────────────────────────

export default function TutorialOverlay({ navigation }) {
  const {
    isActive, activeChapter, activeStep, stepIndex,
    isLastStep, targets, nextStep, dismiss,
  } = useTutorial();

  const { width: W, height: H } = useWindowDimensions();
  // Sur web desktop, le portail Modal est recadré à 430 px centré (CSS dans index.js).
  // Les coordonnées renvoyées par measure() sont en coords viewport, donc on soustrait
  // l'offset gauche du conteneur pour obtenir des coordonnées locales au portail.
  const modalLeft = Platform.OS === 'web' && W > 430 ? (W - 430) / 2 : 0;

  const slideY  = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // Hauteur réelle du tooltip, mesurée au rendu (onLayout). Sert au calcul de
  // placement : avec une estimation fixe, un texte long débordait sous l'écran
  // et le bouton "Suivant" devenait inatteignable.
  const [tooltipH, setTooltipH] = useState(TOOLTIP_HEIGHT_EST);

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
    x: (targetRect.x - modalLeft) - SPOTLIGHT_PADDING,
    y: targetRect.y - SPOTLIGHT_PADDING,
    w: targetRect.width  + SPOTLIGHT_PADDING * 2,
    h: targetRect.height + SPOTLIGHT_PADDING * 2,
  } : null;

  // ─── Positionnement du tooltip (espace réel + intention du design) ────────
  //
  // Règles :
  //   • Pas de cible OU position === 'center' → centré verticalement.
  //   • Sinon on respecte le côté voulu par le design (position 'top' → tooltip
  //     AU-DESSUS de la cible, 'bottom' → EN-DESSOUS), MAIS on bascule sur
  //     l'autre côté s'il n'y a pas la place (cible trop haute/basse ou trop
  //     grande). On mesure la hauteur RÉELLE du tooltip (tooltipH) pour ne
  //     jamais le laisser déborder hors de l'écran : sans ça, un texte long
  //     poussait le bouton "Suivant" sous le bord bas, illisible et incliquable.
  //
  // Les bornes verticales tiennent compte des marges hautes/basses de sécurité
  // (SCREEN_SAFE + insets approximés) pour rester sous la barre d'onglets.
  const tooltipStyle = (() => {
    const base = { position: 'absolute', left: TOOLTIP_MARGIN, right: TOOLTIP_MARGIN };

    const safeTop    = SCREEN_SAFE + SAFE_INSET_TOP;
    const safeBottom = H - SCREEN_SAFE - SAFE_INSET_BOTTOM;
    const maxTop     = Math.max(safeTop, safeBottom - tooltipH);

    if (!hasSpot || activeStep.position === 'center') {
      const centered = (safeTop + safeBottom) / 2 - tooltipH / 2;
      return { ...base, top: Math.min(Math.max(safeTop, centered), maxTop) };
    }

    const spotTop    = targetRect.y - SPOTLIGHT_PADDING;
    const spotBottom = targetRect.y + targetRect.height + SPOTLIGHT_PADDING;
    const need       = tooltipH + TOOLTIP_GAP;
    const roomAbove  = spotTop - safeTop;
    const roomBelow  = safeBottom - spotBottom;

    // Côté souhaité par le design, conservé tant qu'il y a la place ; à défaut
    // on prend le côté le plus spacieux (jamais par-dessus la cible).
    const prefersAbove = activeStep.position === 'top';
    const placeAbove   = prefersAbove
      ? (roomAbove >= need || roomAbove >= roomBelow)
      : (roomBelow >= need ? false : roomAbove > roomBelow);

    const rawTop = placeAbove
      ? spotTop - TOOLTIP_GAP - tooltipH
      : spotBottom + TOOLTIP_GAP;

    return { ...base, top: Math.min(Math.max(safeTop, rawTop), maxTop) };
  })();

  const chapterColor = Colors.primary;
  const totalSteps   = activeChapter.steps.length;
  const isEndCard    = !!activeStep.isLast;
  const isAction     = !!activeStep.actionRequired;

  // Position globale du chapitre courant (pour l'indicateur "Chapitre X/N").
  const chapterIndex = CHAPTER_IDS.indexOf(activeChapter.id) + 1;
  const totalChapters = CHAPTER_IDS.length;

  const handleNext = () => {
    // Retour haptique : lourd et marquant à la toute fin du tutoriel,
    // léger sur une simple avance (étape ou chapitre suivant).
    if (isEndCard) haptics.heavy();
    else haptics.selection();
    nextStep(navigation);
  };

  const handleSkip = () => {
    // "Passer" ferme le tutoriel : léger retour haptique de confirmation.
    haptics.selection();
    dismiss();
  };

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
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          // Ne met à jour que sur variation nette (>1px) pour éviter les
          // boucles de re-rendu dues aux arrondis sub-pixel.
          if (h > 0 && Math.abs(h - tooltipH) > 1) setTooltipH(h);
        }}
      >
        <ChapterBadge chapter={activeChapter} index={chapterIndex} total={totalChapters} />
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
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.75}>
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
          <TouchableOpacity style={styles.skipBtnBottom} onPress={handleSkip} activeOpacity={0.7}>
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
