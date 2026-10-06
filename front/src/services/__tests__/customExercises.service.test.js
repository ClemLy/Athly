jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addCustomExercise, updateCustomExercise, listCustomExercises, removeCustomExercise,
} from '../customExercises.service';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('exercices perso', () => {
  it('crée un exercice avec du matériel (groupe et indicateurs déduits)', async () => {
    const item = await addCustomExercise({
      name: 'Squat bulgare lesté',
      targetMuscle: 'Quadriceps',
      secondaryMuscles: ['Fessiers', 'Ischios'],
      equipment: ['Haltères'],
      level: 'intermediaire',
    });
    expect(item.targetMuscleGroup).toBe('jambes');
    expect(item.isFreeWeight).toBe(true);
    expect(item.isMachine).toBe(false);
    expect(item.isCompound).toBe(true);
    expect(await listCustomExercises()).toHaveLength(1);
  });

  it('modifie puis supprime', async () => {
    const item = await addCustomExercise({ name: 'Curl poulie', targetMuscle: 'Biceps', equipment: ['Câble'] });
    expect(item.isMachine).toBe(true);
    const upd = await updateCustomExercise(item.id, { ...item, equipment: ['Barre'], level: 'avance' });
    expect(upd.isFreeWeight).toBe(true);
    expect(upd.level).toBe('avance');
    await removeCustomExercise(item.id);
    expect(await listCustomExercises()).toEqual([]);
  });

  it('refuse un exercice sans nom ou sans muscle principal', async () => {
    await expect(addCustomExercise({ name: '', targetMuscle: 'Biceps' })).rejects.toThrow();
    await expect(addCustomExercise({ name: 'Truc', targetMuscle: '' })).rejects.toThrow();
  });
});
