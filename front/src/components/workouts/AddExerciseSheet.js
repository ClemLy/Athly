import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import {
  pickExerciseIcon,
  primaryMuscleLabel,
  secondaryMusclesLabels,
  primaryEquipmentLabel,
  normalizeId,
} from '../../constants/exerciseFilters';
import { getCombinedCatalog } from '../../data/exerciseCatalog';
import { useCustomExercises } from '../../context/CustomExercisesContext';

// Bottom-sheet pour choisir un exercice à ajouter / remplacer dans la séance.
// Combine les exos custom (en haut, badge "Personnel") + catalogue built-in.
// Recherche full-text sur name/muscle/equipment.
//
// Props :
//   - visible (bool)
//   - mode : 'add' | 'replace' (juste pour le titre)
//   - onClose ()
//   - onSelect (exercise) : appelé avec l'exo brut du catalogue
//
export default function AddExerciseSheet({ visible, mode = 'add', onClose, onSelect }) {
  const { items: customExercises } = useCustomExercises();
  const [query, setQuery] = useState('');

  const fullCatalog = useMemo(() => getCombinedCatalog(customExercises), [customExercises]);

  const filtered = useMemo(() => {
    const q = normalizeId(query);
    if (!q) return fullCatalog;
    return fullCatalog.filter((ex) => {
      const fields = [
        ex.name,
        ex.targetMuscle,
        ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : []),
        ...(Array.isArray(ex.equipment) ? ex.equipment : []),
      ].map((s) => normalizeId(s || ''));
      return fields.some((f) => f.includes(q));
    });
  }, [fullCatalog, query]);

  const handleSelect = useCallback((exercise) => {
    if (onSelect) onSelect(exercise);
    if (onClose) onClose();
  }, [onSelect, onClose]);

  const renderItem = ({ item }) => {
    const icon = pickExerciseIcon(item);
    const primary = primaryMuscleLabel(item);
    const secondary = secondaryMusclesLabels(item);
    const equipment = primaryEquipmentLabel(item);
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleSelect(item)}
        activeOpacity={0.85}
      >
        <View style={styles.itemIcon}>
          <Text style={styles.itemEmoji}>{icon}</Text>
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            {item.isCustom ? (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Perso</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.itemMuscle} numberOfLines={1}>
            {primary}
            {secondary.length > 0 ? `  •  ${secondary.join(', ')}` : ''}
          </Text>
          {equipment ? (
            <Text style={styles.itemEquip}>{equipment}</Text>
          ) : null}
        </View>
        <Ionicons name="add-circle" size={24} color={Colors.primary} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {mode === 'replace' ? 'Remplacer par' : 'Ajouter un exercice'}
          </Text>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un exercice"
              placeholderTextColor={Colors.textMuted}
              style={styles.search}
              underlineColorAndroid="transparent"
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item, i) => item.id || `cat-${i}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={(
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Aucun exercice ne correspond.</Text>
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#16161c',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 22,
    height: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2a33',
    marginVertical: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  search: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sep: { height: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0e0e12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemEmoji: { fontSize: 22 },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  customBadge: {
    backgroundColor: 'rgba(254, 116, 57, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  customBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemMuscle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  itemEquip: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
