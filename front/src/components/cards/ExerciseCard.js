import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import {
  pickExerciseIcon,
  primaryMuscleLabel,
  secondaryMusclesLabels,
  primaryEquipmentLabel,
} from '../../constants/exerciseFilters';
import InfoModal from '../common/InfoModal';
import ActionSheetModal from '../common/ActionSheetModal';
import ExerciseDemoModal from '../workouts/ExerciseDemoModal';
import { getExerciseDemo } from '../../data/exerciseMedia';

// Carte d'exercice de la séance en cours.
//
// Vignette = la photo du mouvement (on reconnaît l'exercice d'un coup d'œil ;
// la toucher ouvre la démo), puis le nom, les muscles et l'avancement des
// séries. Appui long → Remplacer / Superset / Supprimer.
//
// Props :
//   - item : exercice (Workout.exercises[])
//   - onPress : tap → écran de l'exercice
//   - onReplace, onRemove, onToggleSuperset : actions du menu (appui long)
//   - inSuperset : retire les marges pour s'imbriquer dans <SupersetGroup>

function ExerciseCard({
  item,
  onPress,
  onReplace,
  onRemove,
  onToggleSuperset,
  inSuperset = false,
}) {
  const [infoModal, setInfoModal] = useState(null); // { title, body }
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);

  const name = item && (item.name || item.title);
  const videoUrl = item && item.videoUrl ? item.videoUrl : null;
  const demo = getExerciseDemo(item);

  // Démo dans l'app si elle existe, sinon recherche YouTube (secours).
  const openVideo = useCallback(async () => {
    if (demo) { setDemoVisible(true); return; }
    if (!videoUrl) {
      setInfoModal({ title: 'Vidéo indisponible', body: "Aucun lien vidéo n'est associé à cet exercice." });
      return;
    }
    try {
      const can = await Linking.canOpenURL(videoUrl);
      if (can) await Linking.openURL(videoUrl);
      else setInfoModal({ title: 'Lien invalide', body: "Impossible d'ouvrir cette vidéo." });
    } catch (e) {
      setInfoModal({ title: 'Vidéo indisponible', body: "La vidéo n'a pas pu s'ouvrir. Vérifie ta connexion puis réessaie." });
    }
  }, [videoUrl, demo]);

  const showActions = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (e) {}
    setActionSheetVisible(true);
  }, []);

  if (!name) return null;

  const icon = pickExerciseIcon(item);
  const primary = primaryMuscleLabel(item);
  const secondary = secondaryMusclesLabels(item);
  const equipment = primaryEquipmentLabel(item);
  const sets = Array.isArray(item.sets) ? item.sets : [];
  const doneSets = sets.filter((s) => s && s.completed).length;
  const isDone = !!item.done || (sets.length > 0 && doneSets === sets.length);
  const started = doneSets > 0 && !isDone;

  const actionOptions = [
    ...(videoUrl || demo ? [{ label: demo ? 'Voir la démonstration' : 'Voir la vidéo', onPress: openVideo }] : []),
    ...(onReplace ? [{ label: 'Remplacer', onPress: () => onReplace(item) }] : []),
    ...(onToggleSuperset ? [{
      label: inSuperset ? 'Sortir du superset' : 'Superset avec le suivant',
      onPress: () => onToggleSuperset(item),
    }] : []),
    ...(onRemove ? [{ label: 'Supprimer', destructive: true, onPress: () => onRemove(item) }] : []),
  ];

  const status = isDone ? 'Terminé' : sets.length ? `${doneSets}/${sets.length} séries` : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${status ? `, ${status}` : ''}`}
      accessibilityHint="Appui long pour plus d'options"
      style={({ pressed }) => [
        styles.card,
        inSuperset && styles.cardInSuperset,
        started && styles.cardStarted,
        isDone && styles.cardDone,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      onLongPress={showActions}
      delayLongPress={280}
    >
      <View style={styles.row}>
        <Pressable
          onPress={demo || videoUrl ? openVideo : undefined}
          disabled={!demo && !videoUrl}
          style={styles.thumb}
          accessibilityRole="button"
          accessibilityLabel={demo ? `Voir le mouvement : ${name}` : `Voir une vidéo : ${name}`}
          hitSlop={4}
        >
          {demo ? (
            <Image source={{ uri: demo.frames[0] }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name={icon} size={24} color={Colors.primary} />
          )}
          {isDone ? (
            <View style={styles.doneOverlay}>
              <Ionicons name="checkmark" size={26} color="#fff" />
            </View>
          ) : demo ? (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={10} color="#fff" style={{ marginLeft: 1 }} />
            </View>
          ) : null}
        </Pressable>

        <View style={styles.content}>
          <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={1}>{name}</Text>

          {(primary || secondary.length > 0) ? (
            <Text style={styles.muscleLine} numberOfLines={1}>
              {primary ? <Text style={styles.musclePrimary}>{primary}</Text> : null}
              {primary && secondary.length > 0 ? <Text style={styles.muscleDot}>{'  ·  '}</Text> : null}
              {secondary.length > 0 ? <Text style={styles.muscleSecondary}>{secondary.join(', ')}</Text> : null}
            </Text>
          ) : null}

          {/* Avancement : un segment par série, vert quand elle est faite. */}
          {sets.length > 0 ? (
            <View style={styles.progressRow}>
              <View style={styles.segments}>
                {sets.map((s, i) => (
                  <View key={i} style={[styles.segment, s && s.completed && styles.segmentDone]} />
                ))}
              </View>
              <Text style={[styles.progressText, isDone && styles.progressTextDone]}>{status}</Text>
              {equipment ? <Text style={styles.equipment} numberOfLines={1}>{`·  ${equipment}`}</Text> : null}
            </View>
          ) : equipment ? (
            <Text style={[styles.equipment, { marginTop: 8 }]}>{equipment}</Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={20} color={Colors.chevron} />
      </View>

      <ActionSheetModal
        visible={actionSheetVisible}
        title={name}
        options={actionOptions}
        onClose={() => setActionSheetVisible(false)}
      />
      <InfoModal
        visible={!!infoModal}
        icon="videocam-off-outline"
        title={infoModal?.title}
        body={infoModal?.body}
        onClose={() => setInfoModal(null)}
      />
      {demo ? <ExerciseDemoModal visible={demoVisible} exercise={item} onClose={() => setDemoVisible(false)} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardDeep,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardInSuperset: {
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: Colors.card,
  },
  cardStarted: { borderColor: 'rgba(254,116,57,0.35)' },
  cardDone: { opacity: 0.62 },
  cardPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.cardInner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(254,116,57,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,197,94,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { flex: 1, justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  titleDone: { color: Colors.textSecondary },
  muscleLine: { marginTop: 3, fontSize: 13.5 },
  musclePrimary: { color: Colors.primary, fontWeight: '600' },
  muscleDot: { color: Colors.textMuted },
  muscleSecondary: { color: Colors.textSecondary },

  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 8 },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { width: 14, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  segmentDone: { backgroundColor: Colors.valid },
  progressText: { flexShrink: 0, color: Colors.textSecondary, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressTextDone: { color: Colors.valid },
  equipment: { flexShrink: 1, color: Colors.textMuted, fontSize: 12.5 },
});

export default React.memo(ExerciseCard);
