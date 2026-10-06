import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import UserAvatar from '../social/UserAvatar';

// ─── LobbyMembersBar ──────────────────────────────────────────────────────────
// Bandeau de la séance Multi, sous le chrono : qui s'entraîne avec moi, qui a
// déjà terminé, et le bonus d'équipe en jeu. Chacun gère ses séries de son
// côté (résilience réseau) ; le bandeau est rafraîchi par polling
// (voir WorkoutScreen.js).
//
// Props :
//   members      Array<{ user: {_id, pseudo, equippedFrame}, status }>
//   myId         string
//   bonusPercent number (0..0.5)

export default function LobbyMembersBar({ members = [], myId, bonusPercent = 0 }) {
  if (members.length === 0) return null;
  const finished = members.filter((m) => m.status === 'finished').length;

  return (
    <View style={styles.wrap} accessibilityLabel={`Séance Multi, ${members.length} joueurs, ${finished} ont terminé`}>
      <View style={styles.head}>
        <Ionicons name="people" size={14} color={Colors.primary} />
        <Text style={styles.headTxt}>Séance Multi</Text>
        {bonusPercent > 0 ? (
          <Text style={styles.bonus}>{`+${Math.round(bonusPercent * 100)} % XP à la fin`}</Text>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {members.map((m) => {
          const done = m.status === 'finished';
          const me = m.user?._id === myId;
          return (
            <View key={m.user?._id} style={[styles.chip, done && styles.chipDone]}>
              <UserAvatar user={m.user} size={26} />
              <Text style={styles.chipName} numberOfLines={1}>{me ? 'Toi' : m.user?.pseudo}</Text>
              <Ionicons
                name={done ? 'checkmark-circle' : 'flash'}
                size={14}
                color={done ? Colors.valid : '#FBBF24'}
                accessibilityLabel={done ? 'a terminé' : 'en séance'}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 6 },
  headTxt: { color: Colors.primary, fontSize: 13.5, fontWeight: '800' },
  bonus: { marginLeft: 'auto', color: Colors.gold, fontSize: 13, fontWeight: '700' },
  row: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 38, paddingLeft: 6, paddingRight: 10, borderRadius: 19,
    backgroundColor: Colors.cardDeep, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipDone: { borderColor: 'rgba(34,197,94,0.35)' },
  chipName: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '700', maxWidth: 90 },
});
