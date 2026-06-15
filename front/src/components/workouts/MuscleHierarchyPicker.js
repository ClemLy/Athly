import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import {
  MUSCLE_GROUPS,
  ICON_FOR_MUSCLE_GROUP,
  DEFAULT_ICON,
} from '../../constants/exerciseFilters';
import SelectableChip from './SelectableChip';

// Sélecteur hiérarchique groupes ↔ sous-muscles partagé entre WorkoutBuilder et EditExercise.
//
// Props :
//   - mode : 'single' | 'multi'
//   - selected : string (single) ou string[] (multi) — labels de sous-muscles
//   - onChange : (newSelection) => void  — string en single, array en multi
//   - excludeLabels : string[] — labels à griser (ex. : muscle principal exclu des secondaires)
//   - showSelectAll : bool — affiche "Tout sélectionner / désélectionner" (multi only)
//   - autoExpandSelected : bool — auto-expand les groupes ayant une sélection au montage
//
function GroupRow({ group, expanded, onToggleExpand, mode, selected, onChange, excludeLabels, showSelectAll }) {
  const isMulti = mode === 'multi';
  const subLabels = group.subMuscles.map((s) => s.label);
  const selectedArr = isMulti ? (Array.isArray(selected) ? selected : []) : (selected ? [selected] : []);
  const inGroup = subLabels.filter((l) => selectedArr.includes(l));
  const hasSelection = inGroup.length > 0;
  const allSelected = isMulti && inGroup.length === subLabels.length;
  const icon = ICON_FOR_MUSCLE_GROUP[group.id] || DEFAULT_ICON;

  const handleToggleSub = (label) => {
    if (excludeLabels && excludeLabels.includes(label)) return;
    if (isMulti) {
      const set = new Set(selectedArr);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      onChange(Array.from(set));
    } else {
      // single : toggle
      onChange(selected === label ? '' : label);
    }
  };

  const selectAll = () => {
    if (!isMulti) return;
    const set = new Set(selectedArr);
    subLabels.forEach((l) => {
      if (!excludeLabels || !excludeLabels.includes(l)) set.add(l);
    });
    onChange(Array.from(set));
  };

  const clearAll = () => {
    if (!isMulti) return;
    const next = selectedArr.filter((l) => !subLabels.includes(l));
    onChange(next);
  };

  return (
    <View style={[styles.groupCard, hasSelection && styles.groupCardActive]}>
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={onToggleExpand}
        activeOpacity={0.85}
      >
        <View style={[styles.groupIconBox, hasSelection && styles.groupIconBoxActive]}>
          <Text style={styles.groupIcon}>{icon}</Text>
        </View>
        <View style={styles.groupHeaderContent}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          <Text style={styles.groupSubtitle}>
            {hasSelection
              ? isMulti
                ? `${inGroup.length}/${subLabels.length} sélectionné${inGroup.length > 1 ? 's' : ''}`
                : `${inGroup[0]}`
              : `${subLabels.length} sous-muscles`}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={hasSelection ? Colors.primary : Colors.chevron}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.groupBody}>
          {showSelectAll && isMulti ? (
            <View style={styles.groupActions}>
              <TouchableOpacity
                style={styles.groupActionBtn}
                onPress={allSelected ? clearAll : selectAll}
                activeOpacity={0.8}
              >
                <Text style={styles.groupActionText}>
                  {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.chipsWrap}>
            {group.subMuscles.map((s) => {
              const excluded = !!(excludeLabels && excludeLabels.includes(s.label));
              const isSelected = selectedArr.includes(s.label);
              return (
                <SelectableChip
                  key={s.id}
                  label={excluded ? `${s.label} (principal)` : s.label}
                  selected={isSelected && !excluded}
                  onPress={() => handleToggleSub(s.label)}
                  size="sm"
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function MuscleHierarchyPicker({
  mode = 'multi',
  selected,
  onChange,
  excludeLabels = [],
  showSelectAll = true,
  autoExpandSelected = false,
}) {
  const initialExpanded = useMemo(() => {
    if (!autoExpandSelected) return [];
    const arr = mode === 'multi' ? (Array.isArray(selected) ? selected : []) : (selected ? [selected] : []);
    if (arr.length === 0) return [];
    return MUSCLE_GROUPS
      .filter((g) => g.subMuscles.some((s) => arr.includes(s.label)))
      .map((g) => g.id);
  }, [mode, selected, autoExpandSelected]);

  const [expandedGroups, setExpandedGroups] = useState(initialExpanded);

  const toggleExpand = useCallback((groupId) => {
    setExpandedGroups((s) => (s.includes(groupId) ? s.filter((x) => x !== groupId) : [...s, groupId]));
  }, []);

  return (
    <View>
      {MUSCLE_GROUPS.map((g) => (
        <GroupRow
          key={g.id}
          group={g}
          expanded={expandedGroups.includes(g.id)}
          onToggleExpand={() => toggleExpand(g.id)}
          mode={mode}
          selected={selected}
          onChange={onChange}
          excludeLabels={excludeLabels}
          showSelectAll={showSelectAll}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f1f27',
  },
  groupCardActive: {
    borderColor: 'rgba(254, 116, 57, 0.5)',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  groupIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#0e0e12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupIconBoxActive: {
    backgroundColor: 'rgba(254, 116, 57, 0.15)',
  },
  groupIcon: { fontSize: 22 },
  groupHeaderContent: { flex: 1 },
  groupTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  groupSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  groupBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#23232b',
  },
  groupActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  groupActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  groupActionText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
