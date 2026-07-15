import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const STATUS_LABEL = {
  waiting:  'En cours…',
  ready:    'En cours…',
  finished: 'Terminé !',
};

// ─── LobbyWaitingOverlay ──────────────────────────────────────────────────────
// Écran de clôture synchrone (Section VII) : dès que l'utilisateur clique
// "Finir la séance", son statut passe 'finished' et l'app bloque son écran
// ici jusqu'à ce que TOUS les membres du lobby aient fini — moment où le
// parent (WorkoutScreen.js) détecte lobby.status === 'completed' et bascule
// vers MultiLootModal.
//
// Modale plein écran non-fermable (pas de bouton retour) — c'est voulu : la
// séance est déjà validée, il n'y a rien à annuler.

export default function LobbyWaitingOverlay({ visible, members = [] }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 18 }} />
          <Text style={styles.title}>En attente de tes partenaires...</Text>
          <Text style={styles.body}>
            Ta séance est enregistrée. Le butin d'équipe sera distribué dès que
            tout le monde aura terminé.
          </Text>

          <View style={styles.list}>
            {members.map((m) => (
              <View key={m.user._id} style={styles.row}>
                <Text style={styles.pseudo} numberOfLines={1}>{m.user.pseudo}</Text>
                <View style={styles.statusRow}>
                  {m.status === 'finished'
                    ? <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                    : <ActivityIndicator size="small" color={Colors.textMuted} />}
                  <Text style={[styles.statusTxt, m.status === 'finished' && { color: Colors.success }]}>
                    {STATUS_LABEL[m.status] ?? 'En cours…'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.bgDeep2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: `${Colors.primary}38`,
    padding: 28,
    alignItems: 'center',
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 22 },
  list: { width: '100%', gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  pseudo: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: '700', flex: 1, marginRight: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTxt: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
});
