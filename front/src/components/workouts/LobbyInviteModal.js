import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── LobbyInviteModal ─────────────────────────────────────────────────────────
// Popup affichée quand une notification push `lobby_invite` est reçue pendant
// que l'app est au premier plan (voir LobbyInviteCheck) — remplace tout
// Alert.alert natif, cohérent avec le reste de l'app.
//
// Props :
//   visible     bool
//   fromPseudo  string
//   onJoin      () => void — rejoint le lobby
//   onDismiss   () => void — ignore l'invitation

export default function LobbyInviteModal({ visible, fromPseudo, onJoin, onDismiss }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={26} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Invitation Multi</Text>
          <Text style={styles.body}>
            {fromPseudo || 'Un ami'} t'invite à réaliser une séance ensemble !
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
              <Text style={styles.dismissBtnTxt}>Ignorer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.85}>
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
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    width:           '100%',
    backgroundColor: '#13131C',
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     `${Colors.primary}38`,
    padding:         28,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: `${Colors.primary}1A`,
    borderWidth: 1, borderColor: `${Colors.primary}45`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  btnRow: { flexDirection: 'row', width: '100%', gap: 10 },
  dismissBtn: {
    flex: 1, height: 50, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  dismissBtnTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  joinBtn: {
    flex: 1, height: 50, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  joinBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
