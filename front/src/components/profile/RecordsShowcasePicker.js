import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { getMyRecords } from '../../services';
import { updateRecordsShowcase } from '../../services';

const MAX_SHOWCASED = 6;

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ─── RecordsShowcasePicker ─────────────────────────────────────────────────────
// Sélection de jusqu'à 6 records d'exercices à mettre en avant sur le profil
// (Section III) — recherche parmi TOUS les exercices déjà pratiqués (peuvent
// être très nombreux), pas seulement les 7 "phares".
//
// Props :
//   visible   bool
//   current   string[] — noms actuellement mis en avant (présélectionnés)
//   onSaved   (names: string[]) => void — appelé après sauvegarde réussie
//   onClose   () => void

export default function RecordsShowcasePicker({ visible, current = [], onSaved, onClose }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [records, setRecords]   = useState([]);
  const [selected, setSelected] = useState([]);
  const [query, setQuery]       = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected(current);
    setQuery('');
    setLoading(true);
    getMyRecords()
      .then((res) => setRecords(Array.isArray(res.records) ? res.records : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return records;
    return records.filter((r) => normalize(r.exercice).includes(q));
  }, [records, query]);

  const toggle = (name) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_SHOWCASED) return prev;
      return [...prev, name];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateRecordsShowcase(selected);
      onSaved?.(res.showcasedRecords ?? selected);
      onClose?.();
    } catch (_) {
      // Best-effort : la modale reste ouverte pour réessayer.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Records mis en avant</Text>
              <Text style={styles.subtitle}>{selected.length}/{MAX_SHOWCASED} sélectionnés</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="small" color={Colors.primary} /></View>
          ) : records.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="trophy-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun record pour l'instant</Text>
              <Text style={styles.emptyTxt}>
                Termine des séances avec des poids enregistrés pour pouvoir en mettre en avant ici.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Chercher parmi tes records…"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />
              </View>

              <FlatList
                data={filtered}
                keyExtractor={(r) => r.exercice}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={<Text style={styles.emptyTxt}>Aucun exercice ne correspond.</Text>}
                renderItem={({ item }) => {
                  const active = selected.includes(item.exercice);
                  const disabled = !active && selected.length >= MAX_SHOWCASED;
                  return (
                    <TouchableOpacity
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => toggle(item.exercice)}
                      disabled={disabled}
                      activeOpacity={0.75}
                    >
                      <View style={styles.rowContent}>
                        <Text style={[styles.rowName, disabled && styles.rowNameDisabled]} numberOfLines={1}>
                          {item.exercice}
                        </Text>
                        <Text style={styles.rowValue}>{item.maxPoids} kg × {item.maxReps}</Text>
                      </View>
                      <Ionicons
                        name={active ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={active ? Colors.primary : (disabled ? Colors.textMuted : Colors.chevron)}
                      />
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnTxt}>Enregistrer</Text>}
              </TouchableOpacity>
            </>
          )}
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
    backgroundColor: Colors.bgDeep2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    // Hauteur FIXE (pas maxHeight) : sans ça, la feuille ne prend que la
    // hauteur de son contenu et peut apparaître comme une toute petite boîte
    // collée en bas de l'écran quand la liste est courte. Même pattern que
    // AddExerciseSheet.js.
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
  subtitle: { color: Colors.textMuted, fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12, paddingHorizontal: 12, height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowActive: { backgroundColor: 'rgba(254,116,57,0.08)', borderRadius: 8 },
  rowContent: { flex: 1, marginRight: 10 },
  rowName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowNameDisabled: { color: Colors.textMuted },
  rowValue: { color: Colors.textMuted, fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  saveBtn: {
    height: 50, borderRadius: 13, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary, marginTop: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 6 },
  emptyTxt: { color: Colors.textMuted, fontSize: 12.5, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },
});
