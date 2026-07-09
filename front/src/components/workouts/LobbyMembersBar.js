import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const STATUS_META = {
  waiting:  { icon: 'time-outline',     color: Colors.textMuted },
  ready:    { icon: 'flash',            color: '#FBBF24' },
  finished: { icon: 'checkmark-circle', color: Colors.success },
};

// ─── LobbyMembersBar ──────────────────────────────────────────────────────────
// Bulles des participants connectés au lobby (Section VII), affichées en haut
// de l'écran de séance pendant l'effort — chacun gère ses séries de son côté
// (résilience réseau), cette barre est juste un indicateur de présence/statut,
// rafraîchie par polling (voir WorkoutScreen.js).
//
// Props : members Array<{ user: {_id, pseudo}, status }>

export default function LobbyMembersBar({ members = [] }) {
  if (members.length === 0) return null;

  return (
    <View style={styles.row}>
      <Ionicons name="people" size={13} color={Colors.textMuted} style={{ marginRight: 6 }} />
      {members.map((m) => {
        const meta = STATUS_META[m.status] ?? STATUS_META.waiting;
        return (
          <View key={m.user._id} style={styles.bubble}>
            <Text style={styles.bubbleTxt}>{(m.user.pseudo ?? '?').charAt(0).toUpperCase()}</Text>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bubble: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(254,116,57,0.16)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6, borderWidth: 1.5, borderColor: Colors.background,
  },
  bubbleTxt: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  dot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1, borderColor: Colors.background,
  },
});
