import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import EquipmentTag from '../workouts/EquipmentTag';
import InfoModal from '../common/InfoModal';
import ActionSheetModal from '../common/ActionSheetModal';

// ExerciseCard pixel-perfect (maquette 1).
//
// Props :
//   - item : exercice (Workout.exercises[] ou catalogue)
//   - onPress : tap → navigation détail
//   - onReplace, onRemove, onToggleSuperset : actions menu (long-press)
//   - inSuperset : retire les marges horizontales pour s'imbriquer dans <SupersetGroup>
//
function ExerciseCard({
  item,
  onPress,
  onReplace,
  onRemove,
  onToggleSuperset,
  inSuperset = false,
}) {
  const name = item && (item.name || item.title);
  const [infoModal, setInfoModal] = useState(null); // { title, body }
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  if (!name) return null;

  const icon = pickExerciseIcon(item);
  const primary = primaryMuscleLabel(item);
  const secondary = secondaryMusclesLabels(item);
  const equipment = primaryEquipmentLabel(item);
  const videoUrl = item && item.videoUrl ? item.videoUrl : null;

  const openVideo = useCallback(async () => {
    if (!videoUrl) {
      setInfoModal({ title: 'Vidéo indisponible', body: "Aucun lien vidéo n'est associé à cet exercice." });
      return;
    }
    try {
      const can = await Linking.canOpenURL(videoUrl);
      if (can) await Linking.openURL(videoUrl);
      else setInfoModal({ title: 'Lien invalide', body: "Impossible d'ouvrir cette vidéo." });
    } catch (e) {
      setInfoModal({ title: 'Erreur', body: "Impossible d'ouvrir la vidéo." });
    }
  }, [videoUrl]);

  const showActions = useCallback(() => {
    try { Haptics.selectionAsync(); } catch (e) {}
    setActionSheetVisible(true);
  }, []);

  const actionOptions = [
    ...(videoUrl ? [{ label: 'Voir la vidéo', onPress: openVideo }] : []),
    ...(onReplace ? [{ label: 'Remplacer', onPress: () => onReplace(item) }] : []),
    ...(onToggleSuperset ? [{
      label: inSuperset ? 'Sortir du superset' : 'Superset avec le suivant',
      onPress: () => onToggleSuperset(item),
    }] : []),
    ...(onRemove ? [{ label: 'Supprimer', destructive: true, onPress: () => onRemove(item) }] : []),
  ];

  return (
    <TouchableOpacity
      style={[styles.card, inSuperset && styles.cardInSuperset]}
      onPress={onPress}
      onLongPress={showActions}
      activeOpacity={0.85}
      delayLongPress={280}
    >
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={22} color={Colors.primary} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>

          {(primary || secondary.length > 0) ? (
            <Text style={styles.muscleLine} numberOfLines={1}>
              {primary ? <Text style={styles.musclePrimary}>{primary}</Text> : null}
              {primary && secondary.length > 0 ? <Text style={styles.muscleDot}>{'  •  '}</Text> : null}
              {secondary.length > 0 ? (
                <Text style={styles.muscleSecondary}>{secondary.join(', ')}</Text>
              ) : null}
            </Text>
          ) : null}

          {equipment ? <EquipmentTag label={equipment} /> : null}
        </View>

        <View style={styles.actionArea}>
          {videoUrl ? (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={openVideo}
              style={styles.playBtn}
            >
              <Ionicons name="play-circle" size={22} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="chevron-forward" size={20} color={Colors.chevron} style={styles.chevron} />
        </View>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardInSuperset: {
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: Colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.cardInner,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 26,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  muscleLine: {
    marginTop: 4,
    fontSize: 13,
  },
  musclePrimary: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  muscleDot: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  muscleSecondary: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  actionArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  playBtn: {
    marginRight: 6,
  },
  chevron: {
    marginLeft: 2,
  },
});

export default React.memo(ExerciseCard);
