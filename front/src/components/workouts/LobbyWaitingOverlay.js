import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import UserAvatar from '../social/UserAvatar';

// ─── LobbyWaitingOverlay ──────────────────────────────────────────────────────
// Fin de séance en Multi : j'ai terminé, on attend les partenaires pour
// distribuer le bonus d'équipe (WorkoutScreen.js bascule vers MultiLootModal
// quand le salon passe 'completed').
//
// On n'est JAMAIS bloqué : « Enregistrer sans attendre » valide ma séance
// tout de suite (sans le bonus d'équipe). Avant, un partenaire parti ou hors
// réseau laissait l'écran figé et la séance non enregistrée.
//
// Props :
//   visible       bool
//   members       Array<{ user, status }>
//   myId          string
//   bonusPercent  number
//   onStopWaiting () => void

export default function LobbyWaitingOverlay({ visible, members = [], myId, bonusPercent = 0, onStopWaiting }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) { setElapsed(0); return undefined; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const others = members.filter((m) => m.user?._id !== myId);
  const remaining = others.filter((m) => m.status !== 'finished');
  const bonus = Math.round(bonusPercent * 100);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">Bien joué, tu as terminé !</Text>
          <Text style={styles.body}>
            {remaining.length > 0
              ? `On attend ${remaining.map((m) => m.user?.pseudo).join(', ')} pour distribuer le bonus d'équipe${bonus ? ` (+${bonus} % d'XP)` : ''}.`
              : 'Distribution du bonus d\'équipe…'}
          </Text>

          <View style={styles.list}>
            {others.map((m) => {
              const done = m.status === 'finished';
              return (
                <View key={m.user?._id} style={styles.row}>
                  <UserAvatar user={m.user} size={36} />
                  <Text style={styles.pseudo} numberOfLines={1}>{m.user?.pseudo}</Text>
                  {done ? (
                    <View style={styles.status}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.valid} />
                      <Text style={[styles.statusTxt, { color: Colors.valid }]}>Terminé</Text>
                    </View>
                  ) : (
                    <View style={styles.status}>
                      <ActivityIndicator size="small" color={Colors.textMuted} />
                      <Text style={styles.statusTxt}>En séance</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity accessibilityRole="button" style={styles.stopBtn} onPress={onStopWaiting} activeOpacity={0.8}>
            <Text style={styles.stopBtnTxt}>Enregistrer sans attendre</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            {elapsed >= 120
              ? 'Ça prend du temps ? Ta séance sera enregistrée, mais sans le bonus d\'équipe.'
              : 'Ta séance sera enregistrée, mais sans le bonus d\'équipe.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(5,6,10,0.94)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', maxWidth: 440, backgroundColor: Colors.cardDeep, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 22, alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.14)', marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  list: { width: '100%' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  pseudo: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTxt: { color: Colors.textMuted, fontSize: 13.5, fontWeight: '600' },
  stopBtn: {
    alignSelf: 'stretch', height: 48, borderRadius: 14, marginTop: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  stopBtnTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
