import { buildPreview, describeExercise, estimateMinutes, lastDoneLabel } from '../workoutPreview';
import { CALI_TEMPLATES, TEMPLATES, instantiateWorkout } from '../workoutTemplates';

describe('détail d’une séance avant lancement', () => {
  it('un exercice de calisthénie affiche ses séries, sa fourchette et son niveau', () => {
    const info = describeExercise({ name: 'Pompes inclinées', sets: [{}, {}, {}] });
    expect(info.plan).toBe('3 × 8 à 12 réps');
    expect(info.level).toBe('debutant');
    expect(info.demo?.figure || info.demo?.frames).toBeTruthy();
  });

  it('une tenue se compte en secondes, un exercice unilatéral par côté', () => {
    expect(describeExercise({ name: 'Gainage', sets: [{}, {}] }).plan).toMatch(/^2 × \d+ à \d+ s$/);
    expect(describeExercise({ name: 'Squat bulgare', sets: [{}] }).plan).toMatch(/par côté$/);
  });

  it('un exercice de salle sans fourchette affiche le nombre de séries', () => {
    const tpl = TEMPLATES[0];
    const { infos } = buildPreview(instantiateWorkout(tpl).exercises);
    expect(infos[0].plan).toMatch(/^\d+ séries?$/);
    expect(infos[0].level).toBeNull();
  });

  it('chaque séance type se détaille : exercices, séries, durée et matériel', () => {
    for (const tpl of [...TEMPLATES, ...CALI_TEMPLATES]) {
      const p = buildPreview(tpl.buildExercises());
      expect(p.exercises.length).toBeGreaterThan(0);
      expect(p.sets).toBeGreaterThan(0);
      expect(p.minutes).toBeGreaterThan(0);
      expect(p.gear.every((g) => typeof g === 'string' && g.length > 0)).toBe(true);
    }
  });

  it('la durée estimée suit le nombre de séries', () => {
    expect(estimateMinutes([{ sets: [{}, {}, {}] }, { sets: [{}, {}, {}] }])).toBe(15);
    expect(estimateMinutes(24)).toBe(55);
    expect(estimateMinutes([])).toBe(0);
  });

  it('la dernière réalisation se lit en jours', () => {
    const now = new Date('2026-10-19T12:00:00Z').getTime();
    expect(lastDoneLabel(null, now)).toBeNull();
    expect(lastDoneLabel('2026-10-19T08:00:00Z', now)).toBe("Faite aujourd'hui");
    expect(lastDoneLabel('2026-10-18T12:00:00Z', now)).toBe('Faite hier');
    expect(lastDoneLabel('2026-10-16T12:00:00Z', now)).toBe('Faite il y a 3 j');
  });
});
