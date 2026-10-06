// Recherche d'exercices : synonymes, muscles, matériel, fautes de frappe.
const { BUILTIN_CATALOG } = require('../exerciseCatalog');
const { indexExercise, searchExercises, tokenize, filterIndex, STAPLES } = require('../exerciseSearch');

const index = BUILTIN_CATALOG.map(indexExercise);
const names = (q) => searchExercises(index, q).map((e) => e.name);
const top = (q, n = 5) => names(q).slice(0, n);

describe('recherche par nom', () => {
  test('le nom exact arrive en premier', () => {
    expect(names('Développé couché')[0]).toBe('Développé couché');
    expect(names('squat')[0]).toBe('Squat');
  });
  test('accents et majuscules ignorés', () => {
    expect(names('developpe couche')[0]).toBe('Développé couché');
    expect(names('ÉLÉVATIONS LATÉRALES')[0]).toBe('Élévations latérales');
  });
  test('début de mot', () => {
    expect(top('hip thr')).toContain('Hip thrust');
  });
});

describe('quand on ne connaît pas le nom', () => {
  test('par muscle, en langage courant', () => {
    const pecs = searchExercises(index, 'pecs');
    expect(pecs.length).toBeGreaterThan(20);
    expect(pecs.slice(0, 10).every((e) => e.targetMuscleGroup === 'pectoraux')).toBe(true);
    expect(top('fessiers', 15)).toContain('Hip thrust');
    expect(searchExercises(index, 'mollets').every((e) => [e.targetMuscle, ...e.secondaryMuscles].includes('Mollets'))).toBe(true);
  });
  test('par matériel, y compris « sans matériel »', () => {
    const bw = searchExercises(index, 'sans matériel');
    expect(bw.length).toBeGreaterThan(10);
    expect(bw.every((e) => e.equipment.includes('Poids du corps'))).toBe(true);
  });
  test('muscle + matériel combinés', () => {
    const res = searchExercises(index, 'pecs haltères');
    expect(res.length).toBeGreaterThan(3);
    expect(res.every((e) => e.equipment.includes('Haltères'))).toBe(true);
    expect(res.slice(0, 5).every((e) => e.targetMuscleGroup === 'pectoraux')).toBe(true);
  });
  test('noms anglais courants', () => {
    expect(top('bench')).toContain('Développé couché');
    expect(top('deadlift')).toContain('Soulevé de terre');
    expect(top('pull-up')).toContain('Tractions');
    expect(top('push up')).toContain('Pompes');
    expect(top('abs', 30).length).toBeGreaterThan(5);
  });
});

describe('fautes de frappe', () => {
  test('une lettre en trop, en moins ou inversée', () => {
    expect(top('dévelopé couché')).toContain('Développé couché');
    expect(top('squatt')).toContain('Squat');
    expect(top('tracitons')).toContain('Tractions');
  });
  test('pas de faux positifs sur une requête absurde', () => {
    expect(names('zzzzqqq')).toEqual([]);
  });
});

describe('outils', () => {
  test('mots vides retirés, expressions reconnues', () => {
    expect(tokenize('exercice pour les pecs')).toEqual(['pecs']);
    expect(tokenize('poids du corps')).toEqual(['pdc']);
  });
  test('filtres groupe et matériel', () => {
    const res = filterIndex(index, { group: 'dos', equipment: 'Câble' });
    expect(res.length).toBeGreaterThan(3);
    expect(res.every((it) => it.group === 'dos' && it.equipment.includes('Câble'))).toBe(true);
  });
  test('les incontournables existent tous dans le catalogue', () => {
    const all = new Set(BUILTIN_CATALOG.map((e) => e.name));
    expect(STAPLES.filter((n) => !all.has(n))).toEqual([]);
  });
});
