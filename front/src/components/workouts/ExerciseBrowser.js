import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, FlatList, Image, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MUSCLE_GROUP_COLORS } from '../../constants/theme';
import { MUSCLE_GROUPS, EQUIPMENTS, pickExerciseIcon } from '../../constants/exerciseFilters';
import { getExerciseDemo } from '../../data/exerciseMedia';
import {
  indexExercise, searchExercises, filterIndex, normalizeText, STAPLES,
} from '../../data/exerciseSearch';

// ─── ExerciseBrowser ──────────────────────────────────────────────────────────
//
// Recherche + exploration d'exercices, partagée par tous les sélecteurs
// (ajout à une séance, classement par exercice…).
//  - On peut chercher par nom, muscle (« pecs »), matériel (« haltères »,
//    « sans matériel »), nom anglais (« bench ») ; les fautes de frappe passent.
//  - Sans recherche, on s'inspire : exercices récents, incontournables, puis
//    tout le catalogue rangé par muscle.
//  - Puces de muscle et de matériel pour filtrer d'un geste.
//
// Props :
//   catalog        exercices ({ name, targetMuscle, targetMuscleGroup, equipment… })
//   recentNames    string[] — exercices faits récemment (plus récent en premier)
//   onPick         (exercise) => void
//   selectedName   string — exercice déjà choisi (coché)
//   accessory      'add' | 'check' — icône à droite des lignes
//   placeholder    string

const ROW_GROUPS = [{ id: null, label: 'Tous' }, ...MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label }))];

export default function ExerciseBrowser({
  catalog = [], recentNames = [], onPick, selectedName = null, accessory = 'add',
  placeholder = 'Exercice, muscle ou matériel…',
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [equipOpen, setEquipOpen] = useState(false);

  const index = useMemo(() => catalog.map(indexExercise), [catalog]);
  const byName = useMemo(() => new Map(catalog.map((e) => [normalizeText(e.name), e])), [catalog]);

  const browsing = !query.trim() && !group && !equipment;

  // Lignes de la liste : en-têtes de section + exercices.
  const rows = useMemo(() => {
    if (browsing) {
      const out = [];
      const recent = recentNames.map((n) => byName.get(normalizeText(n))).filter(Boolean).slice(0, 6);
      if (recent.length) {
        out.push({ type: 'header', key: 'h-recent', label: 'Tes exercices récents' });
        recent.forEach((e) => out.push({ type: 'ex', key: `r-${e.id || e.name}`, ex: e }));
      }
      const staples = STAPLES.map((n) => byName.get(normalizeText(n))).filter(Boolean)
        .filter((e) => !recent.includes(e));
      if (staples.length) {
        out.push({ type: 'header', key: 'h-staples', label: 'Les incontournables', hint: 'Les bases, efficaces pour tout le monde' });
        staples.forEach((e) => out.push({ type: 'ex', key: `s-${e.id || e.name}`, ex: e }));
      }
      const custom = catalog.filter((e) => e.isCustom);
      if (custom.length) {
        out.push({ type: 'header', key: 'h-custom', label: 'Tes exercices perso' });
        custom.forEach((e) => out.push({ type: 'ex', key: `c-${e.id || e.name}`, ex: e }));
      }
      for (const g of MUSCLE_GROUPS) {
        const list = index.filter((it) => it.group === g.id && !it.ex.isCustom).map((it) => it.ex)
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        if (!list.length) continue;
        out.push({ type: 'header', key: `h-${g.id}`, label: g.label, count: list.length, groupId: g.id });
        list.forEach((e) => out.push({ type: 'ex', key: `${g.id}-${e.id || e.name}`, ex: e }));
      }
      return out;
    }
    const pool = filterIndex(index, { group, equipment });
    const list = query.trim()
      ? searchExercises(pool, query)
      : pool.map((it) => it.ex).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return list.map((e) => ({ type: 'ex', key: `q-${e.id || e.name}`, ex: e }));
  }, [browsing, recentNames, byName, catalog, index, group, equipment, query]);

  const resultCount = browsing ? null : rows.length;

  const reset = useCallback(() => { setQuery(''); setGroup(null); setEquipment(null); }, []);

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.header}>
          <Text style={styles.headerTxt} accessibilityRole="header">
            {item.label}
            {item.count ? <Text style={styles.headerCount}>{`  ${item.count}`}</Text> : null}
          </Text>
          {item.hint ? <Text style={styles.headerHint}>{item.hint}</Text> : null}
        </View>
      );
    }
    return (
      <ExerciseRow
        ex={item.ex}
        selected={!!selectedName && normalizeText(selectedName) === normalizeText(item.ex.name)}
        accessory={accessory}
        onPress={() => onPick && onPick(item.ex)}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ── Recherche ── */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Rechercher un exercice"
          underlineColorAndroid="transparent"
        />
        {query ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Filtres ── */}
      <View style={styles.chips}>
        {ROW_GROUPS.map((g) => {
          const active = group === g.id;
          return (
            <Chip
              key={g.label}
              label={g.label}
              active={active}
              dot={g.id ? MUSCLE_GROUP_COLORS[g.id] : null}
              onPress={() => setGroup(active && g.id ? null : g.id)}
            />
          );
        })}
        <Chip
          label={equipment || 'Matériel'}
          icon={equipOpen ? 'chevron-up' : 'chevron-down'}
          active={!!equipment}
          onPress={() => setEquipOpen((v) => !v)}
        />
      </View>
      {equipOpen ? (
        <View style={[styles.chips, styles.chipsSub]}>
          {EQUIPMENTS.map((eq) => {
            const active = equipment === eq.label;
            return (
              <Chip key={eq.id} label={eq.label} active={active} small
                onPress={() => { setEquipment(active ? null : eq.label); setEquipOpen(false); }} />
            );
          })}
        </View>
      ) : null}

      {resultCount !== null ? (
        <View style={styles.resultBar}>
          <Text style={styles.resultTxt} accessibilityLiveRegion="polite">
            {resultCount === 0 ? 'Aucun résultat' : `${resultCount} exercice${resultCount > 1 ? 's' : ''}`}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.link}>Tout effacer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={14}
        windowSize={9}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Rien trouvé{query.trim() ? ` pour « ${query.trim()} »` : ''}</Text>
            <Text style={styles.emptyTxt}>Essaie un muscle ou un matériel :</Text>
            <View style={[styles.chips, { justifyContent: 'center', marginTop: 10 }]}>
              {['Pectoraux', 'Dos', 'Jambes', 'Haltères', 'Poids du corps'].map((s) => (
                <Chip key={s} label={s} small onPress={() => { reset(); setQuery(s); }} />
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function Chip({ label, active, onPress, dot, icon, small }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, small && styles.chipSmall, active && styles.chipOn]}
    >
      {dot && !active ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipTxt, active && styles.chipTxtOn]} numberOfLines={1}>{label}</Text>
      {icon ? <Ionicons name={icon} size={13} color={active ? Colors.primary : Colors.textSecondary} /> : null}
    </TouchableOpacity>
  );
}

const ExerciseRow = React.memo(({ ex, selected, accessory, onPress }) => {
  const demo = getExerciseDemo(ex);
  const [imgFailed, setImgFailed] = useState(false);
  const meta = [ex.targetMuscle, Array.isArray(ex.equipment) ? ex.equipment[0] : ex.equipment].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${ex.name}${meta ? `, ${meta}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.thumb}>
        {demo && !imgFailed ? (
          <Image source={{ uri: demo.frames[0] }} style={styles.thumbImg} resizeMode="cover" onError={() => setImgFailed(true)} />
        ) : (
          <Ionicons name={pickExerciseIcon(ex)} size={20} color={Colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameLine}>
          <Text style={[styles.name, selected && { color: Colors.primary }]} numberOfLines={2}>{ex.name}</Text>
          {ex.isCustom ? <View style={styles.badge}><Text style={styles.badgeTxt}>Perso</Text></View> : null}
        </View>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {accessory === 'check'
        ? (selected ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null)
        : <Ionicons name="add-circle" size={26} color={Colors.primary} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15.5, paddingVertical: 0 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chipsSub: { marginTop: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipSmall: { height: 32, paddingHorizontal: 11 },
  chipOn: { backgroundColor: 'rgba(254,116,57,0.14)', borderColor: Colors.primary },
  chipTxt: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
  chipTxtOn: { color: Colors.primary, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },

  resultBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  resultTxt: { color: Colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
  link: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },

  listContent: { paddingTop: 4, paddingBottom: 24 },
  header: { marginTop: 18, marginBottom: 6 },
  headerTxt: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  headerCount: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  headerHint: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12 },
  rowOn: { backgroundColor: 'rgba(254,116,57,0.08)' },
  thumb: {
    width: 48, height: 48, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardInner,
  },
  thumbImg: { width: '100%', height: '100%' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: Colors.textPrimary, fontSize: 15.5, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: 'rgba(254,116,57,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: Colors.primary, fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  emptyTxt: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
});
