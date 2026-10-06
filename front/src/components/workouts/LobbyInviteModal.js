import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── LobbyInviteModal ─────────────────────────────────────────────────────────
// Invitation à une séance Multi (voir LobbyInviteCheck). Dit clairement qui
// invite, combien sont déjà là et ce qu'on y gagne.
//
// Props :
//   visible      bool
//   fromPseudo   string
//   memberCount  number | undefined — joueurs déjà dans le salon
//   onJoin       () => void
//   onDismiss    () => void

export default function LobbyInviteModal({ visible, fromPseudo, memberCount, onJoin, onDismiss }) {
  const who = fromPseudo || 'Un ami';
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={26} color={Colors.primary} />
          </View>

          <Text style={styles.title} accessibilityRole="header">{who} t'invite à s'entraîner</Text>
          <Text style={styles.body}>
            {memberCount ? `${memberCount} joueur${memberCount > 1 ? 's' : ''} dans le salon. ` : ''}
            Chacun fait sa séance, vous démarrez ensemble et tout le monde gagne un bonus d'XP.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
              <Text style={styles.dismissBtnTxt}>Pas maintenant</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.joinBtn} onPress={onJoin} activeOpacity={0.85}>
              <Text style={styles.joinBtnTxt}>Rejoindre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(5,6,10,0.85)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: Colors.cardDeep, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(254,116,57,0.3)', padding: 24, alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(254,116,57,0.14)', marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  btnRow: { flexDirection: 'row', width: '100%', gap: 10 },
  dismissBtn: {
    flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  dismissBtnTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  joinBtn: {
    flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  joinBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
