import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useCustomExercises } from '../../context/CustomExercisesContext';
import {
  pickExerciseIcon,
  primaryMuscleLabel,
  secondaryMusclesLabels,
  primaryEquipmentLabel,
} from '../../constants/exerciseFilters';

export default function CustomExercisesScreen({ navigation }) {
  const { items, loading, remove } = useCustomExercises();

  const onAdd = useCallback(() => {
    navigation && navigation.navigate('EditExercise', { mode: 'create' });
  }, [navigation]);

  const onEdit = useCallback((item) => {
    navigation && navigation.navigate('EditExercise', { mode: 'edit', exerciseId: item.id });
  }, [navigation]);

  const onDelete = useCallback((item) => {
    Alert.alert(
      'Supprimer',
      `Supprimer "${item.name}" ? Les séances qui l'utilisent ne seront pas affectées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try { await remove(item.id); } catch (e) {
              Alert.alert('Erreur', e && e.message ? e.message : 'Suppression impossible');
            }
          },
        },
      ],
    );
  }, [remove]);

  const renderItem = ({ item }) => {
    const icon = pickExerciseIcon(item);
    const primary = primaryMuscleLabel(item);
    const secondary = secondaryMusclesLabels(item);
    const equipment = primaryEquipmentLabel(item);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onEdit(item)}
        onLongPress={() => onDelete(item)}
        activeOpacity={0.85}
      >
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.muscleLine} numberOfLines={1}>
            {primary ? <Text style={styles.musclePrimary}>{primary}</Text> : null}
            {secondary.length > 0 ? (
              <Text style={styles.muscleSecondary}>{`  •  ${secondary.join(', ')}`}</Text>
            ) : null}
          </Text>
          {equipment ? <Text style={styles.equip}>{equipment}</Text> : null}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => onEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.actionDelete}>
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes exercices</Text>
        <TouchableOpacity onPress={onAdd} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chargement…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="library-outline" size={42} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucun exercice perso</Text>
          <Text style={styles.emptyText}>
            Crée tes propres exercices pour les retrouver dans le builder et les séances.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Créer un exercice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f27',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  sep: { height: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#0e0e12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 24 },
  content: { flex: 1 },
  name: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  muscleLine: { marginTop: 2 },
  musclePrimary: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  muscleSecondary: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  equip: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionDelete: { marginLeft: 14 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginTop: 22,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },
});
