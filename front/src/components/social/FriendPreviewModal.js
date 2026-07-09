import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import HeroLevelCard from '../profile/HeroLevelCard';

// ─── FriendPreviewModal ────────────────────────────────────────────────────────
// Carte "Preview" (Section III) : affichée après une recherche par tag exact
// "Pseudo#1234" AVANT tout envoi d'invitation — confirme qu'il s'agit bien de
// la bonne personne (avatar, cadre équipé, niveau, rang) plutôt que d'envoyer
// une demande à l'aveugle.
//
// Props :
//   visible   bool
//   result    { user: {pseudo, discriminator, xp, equippedFrame}, relationStatus, requestId } | null
//   onSend    () => Promise<void> — "Envoyer la demande d'ami"
//   onClose   () => void

export default function FriendPreviewModal({ visible, result, onSend, onClose }) {
  const [sending, setSending] = useState(false);
  if (!result) return null;

  const { user, relationStatus } = result;
  const frame = user.equippedFrame || { shapeId: 'circle', colorId: 'none' };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.eyebrow}>C'EST BIEN LUI / ELLE ?</Text>

          <View style={styles.heroWrap}>
            <HeroLevelCard
              name={user.pseudo}
              initial={(user.pseudo ?? '?').charAt(0).toUpperCase()}
              totalXP={user.xp}
              shapeId={frame.shapeId}
              colorId={frame.colorId}
            />
          </View>

          <Text style={styles.tag}>{user.pseudo}#{user.discriminator}</Text>

          {relationStatus === 'none' && (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Ionicons name="person-add" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.sendBtnTxt}>Envoyer la demande d'ami</Text>
                  </>
                )}
            </TouchableOpacity>
          )}
          {relationStatus === 'pending_sent' && (
            <View style={styles.statusChip}>
              <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.statusChipTxt}>Invitation déjà envoyée</Text>
            </View>
          )}
          {relationStatus === 'pending_received' && (
            <View style={styles.statusChip}>
              <Ionicons name="mail-unread-outline" size={14} color={Colors.gold} />
              <Text style={styles.statusChipTxt}>Vous a envoyé une invitation - vois l'onglet Demandes</Text>
            </View>
          )}
          {relationStatus === 'accepted' && (
            <View style={styles.statusChip}>
              <Ionicons name="people" size={14} color={Colors.success} />
              <Text style={styles.statusChipTxt}>Déjà ami</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelTxt}>Fermer</Text>
          </TouchableOpacity>
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
    padding:         24,
    paddingTop:      36,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 16 },
    shadowOpacity:   0.65,
    shadowRadius:    32,
    elevation:       20,
  },
  closeIcon: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  eyebrow: {
    color:         Colors.textMuted,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.5,
    marginBottom:  16,
    textAlign:     'center',
  },
  heroWrap: { width: '100%', marginBottom: 12 },
  tag: {
    color:        Colors.textSecondary,
    fontSize:     13,
    fontWeight:   '700',
    marginBottom: 20,
  },
  sendBtn: {
    flexDirection:    'row',
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    backgroundColor:  Colors.primary,
    marginBottom:     10,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  sendBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  statusChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth:     1,
    borderColor:     Colors.borderSubtle,
    borderRadius:    12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width:           '100%',
    justifyContent:  'center',
    marginBottom:    10,
  },
  statusChipTxt: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  cancelBtn: { width: '100%', height: 44, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
});
