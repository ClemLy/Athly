import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import ExerciseDemoModal from './ExerciseDemoModal';
import { getExerciseDemo } from '../../data/exerciseMedia';

// ─── ExerciseDemoCard ─────────────────────────────────────────────────────────
// Carte « Voir le mouvement » de l'écran d'exercice : la photo de départ de la
// démonstration en vignette (on voit tout de suite de quel mouvement il s'agit),
// et un geste pour ouvrir la démo en boucle. Sans démo, on propose YouTube.
//
// Props : exercise (nom, muscles, videoUrl)

export default function ExerciseDemoCard({ exercise }) {
  const [open, setOpen] = useState(false);
  const demo = getExerciseDemo(exercise);
  const videoUrl = exercise?.videoUrl || null;
  if (!demo && !videoUrl) return null;

  const onPress = () => {
    if (demo) { setOpen(true); return; }
    Linking.openURL(videoUrl).catch(() => {});
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={demo ? 'Voir la démonstration du mouvement' : 'Voir une vidéo sur YouTube'}
      >
        <View style={styles.thumb}>
          {demo ? (
            <Image source={{ uri: demo.frames[0] }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Ionicons name="logo-youtube" size={26} color={Colors.textPrimary} />
          )}
          <View style={styles.playBadge}>
            <Ionicons name="play" size={12} color="#fff" style={{ marginLeft: 1 }} />
          </View>
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{demo ? 'Voir le mouvement' : 'Voir une vidéo'}</Text>
          <Text style={styles.sub}>{demo ? 'Démonstration en boucle' : 'Ouvre une recherche YouTube'}</Text>
        </View>
        <Ionicons name={demo ? 'chevron-forward' : 'open-outline'} size={18} color={Colors.textMuted} />
      </Pressable>

      {demo ? (
        <ExerciseDemoModal visible={open} exercise={exercise} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    padding: 10,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: Colors.cardDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  thumb: {
    width: 72,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(254,116,57,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  sub: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
});
