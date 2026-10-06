import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { getCombinedCatalog } from '../../data/exerciseCatalog';
import { useCustomExercises } from '../../context/CustomExercisesContext';
import { useRecentExerciseNames } from '../../hooks/useRecentExerciseNames';
import ExerciseBrowser from './ExerciseBrowser';

// Feuille pour ajouter / remplacer un exercice dans une séance.
// Recherche intelligente + exploration (voir ExerciseBrowser).
// En mode « ajout », la feuille reste ouverte : on enchaîne plusieurs
// exercices, puis « Terminé ».
//
// Props :
//   - visible (bool)
//   - mode : 'add' | 'replace'
//   - onClose ()
//   - onSelect (exercise) : appelé avec l'exo brut du catalogue
//
export default function AddExerciseSheet({ visible, mode = 'add', onClose, onSelect }) {
  const insets = useSafeAreaInsets();
  const { items: customExercises } = useCustomExercises();
  const recentNames = useRecentExerciseNames();
  const catalog = useMemo(() => getCombinedCatalog(customExercises), [customExercises]);
  const [added, setAdded] = useState([]);

  useEffect(() => { if (visible) setAdded([]); }, [visible]);

  const handlePick = useCallback((exercise) => {
    if (onSelect) onSelect(exercise);
    if (mode === 'replace') { if (onClose) onClose(); return; }
    setAdded((list) => [...list, exercise.name]);
  }, [onSelect, onClose, mode]);

  const last = added[added.length - 1];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable accessible={false} style={styles.backdrop} onPress={onClose}>
        <Pressable accessible={false} style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              {mode === 'replace' ? 'Remplacer par' : 'Ajouter des exercices'}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer" style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <ExerciseBrowser catalog={catalog} recentNames={recentNames} onPick={handlePick} accessory="add" />
          </View>

          {mode === 'add' && added.length > 0 ? (
            <View style={styles.doneBar}>
              <Text style={styles.doneTxt} numberOfLines={1} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={15} color={Colors.valid} />
                {`  ${last} ajouté${added.length > 1 ? ` · ${added.length} au total` : ''}`}
              </Text>
              <TouchableOpacity accessibilityRole="button" style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.doneBtnTxt}>Terminé</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingBottom: 10 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  doneBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  doneTxt: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  doneBtn: { height: 46, paddingHorizontal: 22, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  doneBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
