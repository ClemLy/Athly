// Non-régression : chaque exercice (catalogue ET séances types) doit être
// rattaché à un groupe musculaire. Sinon il tombe dans « Autre » et fausse la
// répartition musculaire des stats et la séance recommandée de l'accueil.

const { resolveMuscleGroup } = require('../../constants/exerciseFilters');
const { BUILTIN_CATALOG } = require('../exerciseCatalog');
const { TEMPLATES } = require('../workoutTemplates');

describe('resolveMuscleGroup', () => {
  test('comprend sous-muscles, groupes et précisions entre parenthèses', () => {
    expect(resolveMuscleGroup('Pectoraux haut')).toBe('pectoraux');
    expect(resolveMuscleGroup('Pectoraux')).toBe('pectoraux');
    expect(resolveMuscleGroup('Dos (large)')).toBe('dos');
    expect(resolveMuscleGroup('Épaules (arrière)')).toBe('epaules');
    expect(resolveMuscleGroup('Biceps')).toBe('bras');
    expect(resolveMuscleGroup('')).toBeNull();
    expect(resolveMuscleGroup('Inconnu')).toBeNull();
  });

  test('tous les exercices des séances types ont un groupe', () => {
    const missing = TEMPLATES.flatMap((t) => t.buildExercises())
      .filter((e) => !resolveMuscleGroup(e.targetMuscle))
      .map((e) => `${e.name} (${e.targetMuscle})`);
    expect(missing).toEqual([]);
  });

  test('tous les exercices du catalogue ont un groupe', () => {
    const missing = BUILTIN_CATALOG.filter((e) => !resolveMuscleGroup(e.targetMuscle)).map((e) => e.name);
    expect(missing).toEqual([]);
  });
});

describe('repairMuscleDistribution', () => {
  const { repairMuscleDistribution } = require('../../services/stats.service');

  test("reclasse les séances passées tombées dans « Autre »", () => {
    const log = {
      muscleDistribution: { other: 700 },
      exercises: [
        { name: 'Développé couché', targetMuscle: 'Pectoraux', sets: [{ weight: 35, reps: 10, completed: true }] },
        { name: 'Rowing barre', targetMuscle: 'Dos', targetMuscleGroup: 'other', sets: [{ weight: 35, reps: 10, completed: true }] },
      ],
    };
    expect(repairMuscleDistribution(log).muscleDistribution).toEqual({ pectoraux: 350, dos: 350 });
  });

  test('laisse intactes les séances déjà correctes', () => {
    const log = { muscleDistribution: { jambes: 100 }, exercises: [] };
    expect(repairMuscleDistribution(log)).toBe(log);
  });
});
