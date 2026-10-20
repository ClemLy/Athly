import {
  suggestDrillIds, groupsOfExercises, groupsOfSubMuscles, cleanPlan, routineFromPlan, PICKABLE_DRILLS, MAX_PLAN_DRILLS,
} from '../warmups';
import { WARMUP_DRILLS, ROUTINES } from '../calisthenics';
import { instantiateSavedWorkout } from '../../services/savedWorkouts.service';

describe('échauffement sur mesure', () => {
  test('la suggestion ne contient que des mouvements connus, sans doublon', () => {
    ['pectoraux', 'dos', 'epaules', 'bras', 'jambes', 'abdos'].forEach((g) => {
      const ids = suggestDrillIds([g]);
      expect(ids.length).toBeGreaterThanOrEqual(4);
      expect(ids.length).toBeLessThanOrEqual(MAX_PLAN_DRILLS);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(WARMUP_DRILLS[id]).toBeTruthy());
    });
  });

  test('elle suit les muscles travaillés', () => {
    expect(suggestDrillIds(['jambes'])).toContain('squat-profond');
    expect(suggestDrillIds(['jambes'])).not.toContain('pompes-scapula');
    expect(suggestDrillIds(['pectoraux'])).toContain('pompes-scapula');
  });

  test('séries d approche en salle, série légère en calisthénie', () => {
    expect(suggestDrillIds(['dos']).slice(-1)[0]).toBe('series-approche');
    expect(suggestDrillIds(['dos'], { cali: true }).slice(-1)[0]).toBe('serie-legere');
  });

  test('sans muscle connu, on propose un échauffement général', () => {
    expect(suggestDrillIds([]).length).toBeGreaterThanOrEqual(4);
  });

  test('plusieurs groupes : reste court', () => {
    const ids = suggestDrillIds(['pectoraux', 'dos', 'epaules', 'bras', 'jambes', 'abdos']);
    expect(ids.length).toBeLessThanOrEqual(10);
  });

  test('groupes depuis les sous-muscles et les exercices', () => {
    expect(groupsOfSubMuscles(['pectoraux-haut', 'quadriceps', 'pectoraux-bas'])).toEqual(['pectoraux', 'jambes']);
    expect(groupsOfExercises([{ name: 'Squat' }, { name: 'Développé couché' }]).length).toBeGreaterThan(0);
  });

  test('cleanPlan retire inconnus, doublons et limite la taille', () => {
    expect(cleanPlan(['chat-vache', 'nimporte', 'chat-vache', 'corde'])).toEqual(['chat-vache', 'corde']);
    expect(cleanPlan(null)).toEqual([]);
    expect(cleanPlan(Object.keys(WARMUP_DRILLS)).length).toBeLessThanOrEqual(MAX_PLAN_DRILLS);
  });

  test('routineFromPlan', () => {
    expect(routineFromPlan([])).toBeNull();
    const r = routineFromPlan(['chat-vache', 'corde']);
    expect(r.kind).toBe('warmup');
    expect(r.drills).toEqual(['chat-vache', 'corde']);
  });

  test('le retour au calme n est pas proposé dans les ajouts', () => {
    const ids = PICKABLE_DRILLS.map((d) => d.id);
    ROUTINES.calme.drills.forEach((id) => expect(ids).not.toContain(id));
  });

  test('une séance enregistrée emporte son échauffement au lancement', () => {
    const w = instantiateSavedWorkout({ name: 'A', exercises: [{ name: 'Squat', sets: [{}] }], warmup: ['corde', 'x'] });
    expect(w.warmupPlan).toEqual(['corde']);
    expect(instantiateSavedWorkout({ name: 'B', exercises: [{ name: 'Squat' }] }).warmupPlan).toEqual([]);
  });
});
