import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, Modal, Pressable, TouchableOpacity, StyleSheet,
  Animated, Easing, Linking, AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { primaryMuscleLabel, secondaryMusclesLabels } from '../../constants/exerciseFilters';
import { getExerciseDemo } from '../../data/exerciseMedia';
import { catalogEntryFor } from '../../data/exerciseCatalog';
import ExerciseFigure, { useFigureClock } from '../figure/ExerciseFigure';

// ─── ExerciseDemoModal ────────────────────────────────────────────────────────
// Démonstration du mouvement DANS l'app : les deux photos de la démo (départ /
// arrivée) s'enchaînent en boucle avec un fondu — départ, pause, arrivée,
// pause — ce qui suffit à lire l'amplitude et la trajectoire. YouTube reste
// accessible en lien secondaire pour ceux qui veulent plus de détail.
//
// Si l'appareil demande de réduire les animations, les deux positions sont
// affichées côte à côte, sans boucle.
//
// Props : visible, exercise (nom, muscles, videoUrl), onClose

const HOLD = 650;   // pause sur chaque position (ms)
const FADE = 420;   // fondu entre les deux positions (ms)

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduced(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

// Silhouette qui pulse pendant le chargement (pas de roue qui tourne).
function StagePlaceholder() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.placeholder, { opacity }]}>
      <Ionicons name="barbell-outline" size={34} color={Colors.textMuted} />
    </Animated.View>
  );
}

function LoopingDemo({ frames, onReady, onError, ready }) {
  // phase : 0 = départ visible, 1 = arrivée visible.
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(HOLD),
      Animated.timing(phase, { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(HOLD),
      Animated.timing(phase, { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [ready, phase]);

  const loaded = useRef(0);
  const handleLoad = () => { loaded.current += 1; if (loaded.current >= 2) onReady(); };

  const startLabel = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 0.35] });
  const endLabel = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.35, 1] });
  const fill = phase.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <>
      <View style={styles.stage}>
        <Image source={{ uri: frames[0] }} style={styles.frame} resizeMode="contain" onLoad={handleLoad} onError={onError} />
        <Animated.Image
          source={{ uri: frames[1] }}
          style={[styles.frame, StyleSheet.absoluteFill, { opacity: phase }]}
          resizeMode="contain"
          onLoad={handleLoad}
          onError={onError}
        />
        {!ready && <StagePlaceholder />}
      </View>

      {/* Indicateur de phase synchronisé avec le fondu. */}
      <View style={styles.phaseRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.Text style={[styles.phaseLabel, { opacity: startLabel }]}>Départ</Animated.Text>
        <View style={styles.phaseTrack}>
          <Animated.View style={[styles.phaseFill, { transform: [{ scaleX: fill }] }]} />
        </View>
        <Animated.Text style={[styles.phaseLabel, { opacity: endLabel }]}>Arrivée</Animated.Text>
      </View>
    </>
  );
}

function SideBySideDemo({ frames, onReady, onError, ready }) {
  const loaded = useRef(0);
  const handleLoad = () => { loaded.current += 1; if (loaded.current >= 2) onReady(); };
  return (
    <View style={styles.sideRow}>
      {frames.map((uri, i) => (
        <View key={uri} style={styles.sideCell}>
          <View style={[styles.stage, styles.sideStage]}>
            <Image source={{ uri }} style={styles.frame} resizeMode="contain" onLoad={handleLoad} onError={onError} />
            {!ready && <StagePlaceholder />}
          </View>
          <Text style={styles.sideLabel}>{i === 0 ? 'Départ' : 'Arrivée'}</Text>
        </View>
      ))}
    </View>
  );
}

// Mannequin animé : même phrasé que les photos (départ, pause, arrivée).
function FigureDemo({ spec, reduced, labels }) {
  const t = useFigureClock(!reduced, spec);
  const [a, b] = labels || ['Départ', 'Arrivée'];
  if (reduced) {
    return (
      <View style={styles.sideRow}>
        {[0, 1].map((k) => (
          <View key={k} style={styles.sideCell}>
            <ExerciseFigure spec={spec} t={k} style={styles.figureStage} />
            <Text style={styles.sideLabel}>{k === 0 ? a : b}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <>
      <ExerciseFigure spec={spec} t={t} style={styles.figureStage} />
      <View style={styles.phaseRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.phaseLabel, { opacity: 1 - 0.65 * t }]}>{a}</Text>
        <View style={styles.phaseTrack}>
          <View style={[styles.phaseFill, { transform: [{ scaleX: t }] }]} />
        </View>
        <Text style={[styles.phaseLabel, { opacity: 0.35 + 0.65 * t }]}>{b}</Text>
      </View>
    </>
  );
}

export default function ExerciseDemoModal({ visible, exercise, onClose }) {
  const reduced = useReducedMotion();
  // Marge basse = zone sûre réelle (barre de navigation Android en bord à
  // bord, barre d'accueil iOS) : sinon le dernier bouton passe dessous.
  const insets = useSafeAreaInsets();
  const demo = getExerciseDemo(exercise);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Nouvelle ouverture / nouvel exercice : on repart d'un état propre.
  useEffect(() => {
    if (!visible) return;
    setReady(false);
    setFailed(false);
    demo?.frames?.forEach((uri) => { Image.prefetch(uri).catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, exercise?.name]);

  if (!exercise) return null;
  const entry = catalogEntryFor(exercise);
  const cues = (exercise.cues && exercise.cues.length ? exercise.cues : entry?.cues) || (exercise.cue ? [exercise.cue] : []);
  const name = exercise.name || exercise.title || 'Exercice';
  const primary = primaryMuscleLabel(exercise);
  const secondary = secondaryMusclesLabels(exercise);
  const videoUrl = exercise.videoUrl || null;

  const openYoutube = async () => {
    if (!videoUrl) return;
    try { await Linking.openURL(videoUrl); } catch (_) {}
  };

  const Demo = reduced ? SideBySideDemo : LoopingDemo;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer la démonstration" />
      <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{name}</Text>
            {primary ? (
              <Text style={styles.muscles} numberOfLines={2}>
                <Text style={styles.musclePrimary}>{primary}</Text>
                {secondary.length > 0 ? <Text>{`  ·  ${secondary.join(', ')}`}</Text> : null}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {demo?.figure ? (
          <FigureDemo spec={demo.figure} reduced={reduced} />
        ) : demo && !failed ? (
          <Demo
            key={`${name}-${reduced}`}
            frames={demo.frames}
            ready={ready}
            onReady={() => setReady(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={[styles.stage, styles.emptyStage]}>
            <Ionicons name="cloud-offline-outline" size={30} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {failed ? 'La démonstration n\'a pas pu se charger' : 'Pas encore de démonstration pour cet exercice'}
            </Text>
            <Text style={styles.emptyBody}>
              {failed ? 'Vérifie ta connexion, ou regarde une vidéo sur YouTube.' : 'Tu peux regarder une vidéo sur YouTube en attendant.'}
            </Text>
          </View>
        )}

        {cues.length > 0 ? (
          <View style={styles.cues}>
            <Text style={styles.cuesTitle}>Points clés</Text>
            {cues.map((cue, i) => (
              <View key={i} style={styles.cueRow}>
                <View style={styles.cueDot} />
                <Text style={styles.cueText}>{cue}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {videoUrl ? (
          <TouchableOpacity
            style={styles.youtubeBtn}
            onPress={openYoutube}
            activeOpacity={0.8}
            accessibilityRole="link"
          >
            <Ionicons name="logo-youtube" size={18} color={Colors.textPrimary} />
            <Text style={styles.youtubeTxt}>Voir des vidéos sur YouTube</Text>
            <Ionicons name="open-outline" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)', alignSelf: 'center', marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  muscles: { color: Colors.textSecondary, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  musclePrimary: { color: Colors.primary, fontWeight: '700' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },

  stage: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#000',
  },
  frame: { width: '100%', height: '100%' },
  figureStage: { borderRadius: 18 },
  cues: { marginTop: 18, gap: 8 },
  cuesTitle: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  cueRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  cueText: { flex: 1, color: Colors.textPrimary, fontSize: 14.5, lineHeight: 21 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardDeep },

  phaseRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  phaseLabel: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: '700' },
  phaseTrack: {
    flex: 1, height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // scaleX depuis le bord gauche : la barre se remplit vers « Arrivée ».
  phaseFill: { width: '100%', height: '100%', backgroundColor: Colors.primary, transformOrigin: 'left' },

  sideRow: { flexDirection: 'row', gap: 10 },
  sideCell: { flex: 1 },
  sideStage: { aspectRatio: 3 / 4 },
  sideLabel: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700', textAlign: 'center', marginTop: 8 },

  emptyStage: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: Colors.cardDeep },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  emptyBody: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  youtubeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 18, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  youtubeTxt: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: '700' },
});
