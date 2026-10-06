// Tests de non-régression des démonstrations d'exercices (exerciseMedia.js).
// Une correspondance qui ne pointe plus vers un exercice existant (exercice
// renommé dans le catalogue, faute de frappe…) ferait disparaître sa démo sans
// la moindre erreur : ces tests la font échouer bruyamment.

const { getExerciseDemo, __DEMOS, __ALIASES } = require('../exerciseMedia');
const { BUILTIN_CATALOG } = require('../exerciseCatalog');
const { TEMPLATES } = require('../workoutTemplates');

const catalogKeys = new Set(BUILTIN_CATALOG.map((e) => e.id.replace(/^bx-/, '')));

describe('exerciseMedia', () => {
  test('chaque clé correspond à un exercice du catalogue', () => {
    const unknown = Object.keys(__DEMOS).filter((k) => !catalogKeys.has(k));
    expect(unknown).toEqual([]);
  });

  test('chaque alias pointe vers une démo existante', () => {
    const broken = Object.entries(__ALIASES).filter(([, target]) => !__DEMOS[target]);
    expect(broken).toEqual([]);
  });

  test('les identifiants de démo ont le format attendu', () => {
    const bad = Object.values(__DEMOS).filter((slug) => !/^[A-Za-z0-9_\-]+$/.test(slug));
    expect(bad).toEqual([]);
  });

  test('une démo renvoie deux images (départ, arrivée) servies par jsDelivr', () => {
    const demo = getExerciseDemo({ name: 'Développé couché' });
    expect(demo.frames).toHaveLength(2);
    demo.frames.forEach((url) => expect(url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[0-9a-f]{40}\/exercises\/.+\/[01]\.jpg$/));
  });

  test('tous les exercices des séances types ont une démo', () => {
    const names = new Set();
    TEMPLATES.forEach((t) => {
      const list = t.exercises || (typeof t.buildExercises === 'function' ? t.buildExercises() : []);
      list.forEach((e) => names.add(e.name));
    });
    const missing = [...names].filter((n) => !getExerciseDemo({ name: n }));
    expect(missing).toEqual([]);
  });

  test('un exercice inconnu ou personnalisé n\'a pas de démo', () => {
    expect(getExerciseDemo({ name: 'Mon exercice maison' })).toBeNull();
    expect(getExerciseDemo(null)).toBeNull();
  });
});
