const { PRESETS, activePresetId, groupState, toggleGroup, swapExercise } = require('../workoutBuilder');
const { generateWorkout, exerciseCountFor } = require('../exerciseCatalog');

describe('préréglages', () => {
  test('chaque préréglage produit une séance non vide', () => {
    for (const p of PRESETS) {
      const w = generateWorkout({ subMuscles: p.subMuscles, durationMin: 60, customExercises: [] });
      expect(w.exercises.length).toBeGreaterThanOrEqual(3);
    }
  });
  test('un préréglage est reconnu comme actif, pas après modification', () => {
    const push = PRESETS.find((p) => p.id === 'push').subMuscles;
    expect(activePresetId(push)).toBe('push');
    expect(activePresetId(push.slice(1))).toBeNull();
  });
});

describe('sélection par groupe', () => {
  test('tout sélectionner puis tout retirer', () => {
    const all = toggleGroup('dos', []);
    expect(groupState('dos', all)).toMatchObject({ state: 'all', count: 4, total: 4 });
    expect(toggleGroup('dos', all)).toEqual([]);
  });
  test('un groupe partiel se complète au lieu de se vider', () => {
    const partial = ['Biceps'];
    expect(groupState('bras', partial).state).toBe('partial');
    expect(groupState('bras', toggleGroup('bras', partial)).state).toBe('all');
  });
  test('ne touche pas aux autres groupes', () => {
    expect(toggleGroup('dos', ['Quadriceps'])).toContain('Quadriceps');
  });
});

describe('remplacement d\'un exercice', () => {
  const criteria = { subMuscles: ['Pectoraux haut', 'Pectoraux milieu', 'Pectoraux bas'], equipment: [], level: '' };
  test('donne un autre exercice, du même muscle si possible, sans doublon', () => {
    const w = generateWorkout({ ...criteria, durationMin: 45, customExercises: [] });
    const next = swapExercise(w.exercises, 0, criteria, []);
    expect(next).not.toBeNull();
    expect(w.exercises.map((e) => e.id)).not.toContain(next.id);
    expect(next.sets).toHaveLength(w.exercises[0].sets.length);
  });
  test('renvoie null quand il n\'y a pas d\'alternative', () => {
    const only = { subMuscles: ['Pectoraux haut'], equipment: ['Poids du corps'], level: 'debutant' };
    const w = generateWorkout({ ...only, durationMin: 30, customExercises: [] });
    const all = swapExercise(w.exercises, 0, only, []);
    if (all) expect(w.exercises.map((e) => e.id)).not.toContain(all.id);
  });
  test('nombre d\'exercices selon la durée', () => {
    expect(exerciseCountFor(30)).toBe(3);
    expect(exerciseCountFor(60)).toBe(7);
    expect(exerciseCountFor(90)).toBe(10);
  });
});
