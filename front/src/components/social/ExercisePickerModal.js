import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { BUILTIN_CATALOG } from '../../data/exerciseCatalog';

// ─── ExercisePickerModal ──────────────────────────────────────────────────────
// Sélecteur d'exercice pour le classement par exercice (Section III) — la
// liste complète du catalogue (~100+ exercices) ne tient pas dans une simple
// rangée de chips : recherche par nom + regroupement par groupe musculaire,
// même esprit que AddExerciseSheet.js côté séance.
//
// Props :
//   visible   bool
//   value     string — nom de l'exercice actuellement sélectionné
//   onSelect  (name: string) => void
//   onClose   () => void

const GROUP_LABELS = {
  pectoraux: 'Pectoraux',
  dos:       'Dos',
  epaules:   'Épaules',
  bras:      'Bras',
  jambes:    'Jambes',
  abdos:     'Abdos',
};

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function ExercisePickerModal({ visible, value, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = BUILTIN_CATALOG.filter((ex) => !q || normalize(ex.name).includes(q));

    const byGroup = new Map();
    for (const ex of filtered) {
      const key = ex.targetMuscleGroup || 'autre';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(ex);
    }
    return Array.from(byGroup.entries()).map(([group, exercises]) => ({
      group,
      label: GROUP_LABELS[group] || group,
      exercises: exercises.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [query]);

  const handleSelect = (name) => {
    onSelect(name);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Choisir un exercice</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Chercher un exercice…"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoFocus
            />
          </View>

          <FlatList
            data={sections}
            keyExtractor={(s) => s.group}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={<Text style={styles.emptyTxt}>Aucun exercice ne correspond.</Text>}
            renderItem={({ item: section }) => (
              <View>
                <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                {section.exercises.map((ex) => {
                  const active = ex.name === value;
                  return (
                    <TouchableOpacity
                      key={ex.name}
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => handleSelect(ex.name)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.rowTxt, active && styles.rowTxtActive]}>{ex.name}</Text>
                      {active && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#13131C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    // Hauteur FIXE (pas maxHeight) : sinon la feuille ne prend que la
    // hauteur de son contenu et peut apparaître comme une petite boîte
    // collée en bas de l'écran. Même pattern que AddExerciseSheet.js.
    height: '78%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12, paddingHorizontal: 12, height: 44,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  list: { flex: 1 },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    marginTop: 14, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowActive: { backgroundColor: 'rgba(254,116,57,0.08)', borderRadius: 8 },
  rowTxt: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  rowTxtActive: { color: Colors.primary, fontWeight: '800' },
  emptyTxt: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 30 },
});
