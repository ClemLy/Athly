import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const LOGO = require('../../../assets/minimalist-logo-orange.png');

// Header de l'exercice : logo centré, chrono pill à droite, gros bouton play.
//
// Props :
//   - timer : string formaté ("M:SS")
//   - videoUrl : url YouTube — tap = Linking.openURL
//
function ChronoPill({ timer }) {
  return (
    <View style={styles.chrono}>
      <Ionicons name="stopwatch-outline" size={16} color={Colors.primary} />
      <Text style={styles.chronoText}>{timer}</Text>
    </View>
  );
}

export default function ExerciseHeader({ timer = '0:00', videoUrl }) {
  const onPlayPress = async () => {
    if (!videoUrl) {
      Alert.alert('Vidéo indisponible', "Aucun lien vidéo n'est associé à cet exercice.");
      return;
    }
    try {
      await Linking.openURL(videoUrl);
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'ouvrir la vidéo.");
    }
  };

  return (
    <View style={styles.frame}>
      <View style={styles.topRow}>
        <View style={styles.flex} />
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <View style={styles.flex}>
          <View style={styles.chronoWrap}>
            <ChronoPill timer={timer} />
          </View>
        </View>
      </View>

      <View style={styles.playWrap}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={onPlayPress}
          activeOpacity={0.8}
          accessibilityLabel="Lire la vidéo de l'exercice"
        >
          <Ionicons name="play" size={28} color={Colors.primary} style={styles.playIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f27',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  flex: { flex: 1 },
  chronoWrap: {
    alignItems: 'flex-end',
  },
  logo: {
    height: 38,
    width: 110,
  },
  chrono: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chronoText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  playWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  playBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(254, 116, 57, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 4,
  },
});
