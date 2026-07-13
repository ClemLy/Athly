import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// ─── SaveWorkoutPromptModal ───────────────────────────────────────────────────
// Interception du lancement d'une séance sur-mesure (WorkoutBuilderScreen) :
// avant d'ouvrir le chrono, propose de sauvegarder la séance générée comme
// template réutilisable. Deux CTA de poids égal (contrairement à
// ConfirmModal/InfoModal qui n'ont qu'une seule action principale) + une
// icône de fermeture pour annuler sans choisir.
//
// Props :
//   visible             bool
//   onSaveAndLaunch     () => void   — sauvegarde le template PUIS lance la séance
//   onLaunchWithoutSave () => void   — lance directement, aucun template créé
//   onDismiss           () => void   — ferme la popup sans lancer la séance
//   saving              bool         — désactive les actions pendant la sauvegarde

export default function SaveWorkoutPromptModal({
  visible, onSaveAndLaunch, onLaunchWithoutSave, onDismiss, saving = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="bookmark-outline" size={28} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Sauvegarder cette séance ?</Text>
          <Text style={styles.body}>
            Souhaites-tu sauvegarder cette séance sur-mesure pour la retrouver plus tard ?
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={onSaveAndLaunch}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryTxt}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder et lancer la séance'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, saving && styles.btnDisabled]}
            onPress={onLaunchWithoutSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="play-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryTxt}>Lancer sans sauvegarder</Text>
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
    backgroundColor: Colors.bgDeep2,
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
  closeBtn: {
    position: 'absolute',
    top:      16,
    right:    16,
    width:    28,
    height:   28,
    borderRadius: 14,
    backgroundColor: Colors.glassBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconWrap: {
    width:            60,
    height:           60,
    borderRadius:     18,
    borderWidth:      1,
    borderColor:      `${Colors.primary}45`,
    backgroundColor:  `${Colors.primary}1A`,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     18,
  },
  title: {
    color:          Colors.textPrimary,
    fontSize:       18,
    fontWeight:     '800',
    letterSpacing:  -0.3,
    marginBottom:   10,
    textAlign:      'center',
  },
  body: {
    color:        Colors.textSecondary,
    fontSize:     14,
    lineHeight:   21,
    textAlign:    'center',
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection:    'row',
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    marginBottom:     10,
    backgroundColor:  Colors.primary,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 6 },
    shadowOpacity:    0.40,
    shadowRadius:     12,
    elevation:        6,
  },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  secondaryBtn: {
    flexDirection:    'row',
    width:            '100%',
    height:           50,
    borderRadius:     13,
    justifyContent:   'center',
    alignItems:       'center',
    backgroundColor:  'transparent',
    borderWidth:      1,
    borderColor:      Colors.borderDim,
  },
  secondaryTxt: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.5 },
});
