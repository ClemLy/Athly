import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

// Chip de filtre multi-sélection. Ouvre une Modal native (pas de dépendance externe).
//
// Props :
//   - label : label affiché (ex. "Muscle")
//   - options : [{ id, label }]
//   - values : tableau d'ids sélectionnés
//   - onChange : (newValues) => void
//
export default function FilterChip({ label, options = [], values = [], onChange }) {
  const [open, setOpen] = useState(false);
  const count = Array.isArray(values) ? values.length : 0;
  const active = count > 0;

  const toggle = useCallback((id) => {
    const set = new Set(values);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange && onChange(Array.from(set));
  }, [values, onChange]);

  const clear = useCallback(() => {
    onChange && onChange([]);
  }, [onChange]);

  return (
    <>
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}{active ? ` · ${count}` : ''}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={active ? '#fff' : Colors.textSecondary}
          style={styles.chipIcon}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label}</Text>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {options.map((opt) => {
                const selected = values.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={styles.option}
                    onPress={() => toggle(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {opt.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    ) : (
                      <View style={styles.checkPlaceholder} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity onPress={clear} style={styles.clearBtn} activeOpacity={0.7}>
                <Text style={styles.clearText}>Tout effacer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.applyBtn} activeOpacity={0.85}>
                <Text style={styles.applyText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: '#23232b',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipIcon: {
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#16161c',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2a33',
    marginVertical: 8,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  list: {
    paddingHorizontal: 8,
  },
  listContent: {
    paddingBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  optionText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  checkPlaceholder: {
    width: 20,
    height: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#23232b',
  },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  clearText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  applyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
