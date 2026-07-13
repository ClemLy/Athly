import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/theme';

// ─── ActionSheetModal ─────────────────────────────────────────────────────────
// Menu d'actions à choix multiples (3+ options) — remplace
// Alert.alert(title, message, [{text, onPress, style}, ...]) quand il y a
// plus qu'un simple confirmer/annuler (ex: "Voir la vidéo" / "Remplacer" /
// "Supprimer" sur une carte d'exercice).
//
// Props :
//   visible      bool
//   title        string
//   options      Array<{ label: string, onPress?: () => void, destructive?: bool }>
//   cancelLabel  string (défaut "Annuler")
//   onClose      () => void — appelé après tout choix (y compris Annuler)

export default function ActionSheetModal({ visible, title, options = [], cancelLabel = 'Annuler', onClose }) {
  const handlePress = (opt) => {
    onClose?.();
    opt.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {!!title && <Text style={styles.title} numberOfLines={2}>{title}</Text>}

          {options.map((opt, i) => (
            <TouchableOpacity
              key={`${opt.label}-${i}`}
              style={[styles.optionBtn, i === options.length - 1 && styles.optionBtnLast]}
              onPress={() => handlePress(opt)}
              activeOpacity={0.75}
            >
              <Text style={[styles.optionTxt, opt.destructive && styles.optionTxtDestructive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelTxt}>{cancelLabel}</Text>
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
    justifyContent:  'flex-end',
    padding:         12,
  },
  card: {
    width:           '100%',
    backgroundColor: Colors.bgDeep2,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    paddingTop:      18,
    paddingHorizontal: 8,
    paddingBottom:   8,
    marginBottom:    8,
  },
  title: {
    color:         Colors.textMuted,
    fontSize:      12.5,
    fontWeight:    '700',
    textAlign:     'center',
    marginBottom:  10,
    paddingHorizontal: 16,
  },
  optionBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  optionBtnLast: { marginBottom: 8 },
  optionTxt: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: '600' },
  optionTxtDestructive: { color: Colors.destructive },
  cancelBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cancelTxt: { color: Colors.primary, fontSize: 15.5, fontWeight: '700' },
});
