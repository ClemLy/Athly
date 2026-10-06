import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { BUILTIN_CATALOG } from '../../data/exerciseCatalog';
import { useRecentExerciseNames } from '../../hooks/useRecentExerciseNames';
import ExerciseBrowser from '../workouts/ExerciseBrowser';

// ─── ExercisePickerModal ──────────────────────────────────────────────────────
// Choix de l'exercice du classement « Records » (écran Social). Même
// recherche et même exploration que l'ajout d'exercice en séance
// (ExerciseBrowser) : par nom, muscle, matériel, avec fautes de frappe.
//
// Props :
//   visible   bool
//   value     string — nom de l'exercice actuellement sélectionné
//   onSelect  (name: string) => void
//   onClose   () => void

export default function ExercisePickerModal({ visible, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const recentNames = useRecentExerciseNames();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable accessible={false} style={styles.backdrop} onPress={onClose}>
        <Pressable accessible={false} style={[styles.sheet, { paddingBottom: 8 + insets.bottom }]} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">Choisir un exercice</Text>
            <TouchableOpacity accessibilityLabel="Fermer" accessibilityRole="button" style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <ExerciseBrowser
              catalog={BUILTIN_CATALOG}
              recentNames={recentNames}
              selectedName={value}
              accessory="check"
              onPick={(ex) => { onSelect(ex.name); onClose(); }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.backgroundDeep, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 8, height: '90%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingBottom: 10 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
