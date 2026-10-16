jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { planRecovery, logFromServerWorkout, RESTORED_PREFIX, ACCOUNT_XP_ID } from '../historyRecovery.service';

const day = (n, h = 18) => new Date(Date.UTC(2026, 8, n, h, 0, 0)).toISOString();
const workout = (id, finishedAt, overrides = {}) => ({
  id, name: 'Séance Push', finishedAt, durationSeconds: 3600, shortSession: false,
  exercises: [{ name: 'Développé couché', targetMuscle: 'Pectoraux', sets: [{ weight: 80, reps: 10, completed: true }] }],
  ...overrides,
});
const log = (id, date, xp = 300, extra = {}) => ({ id, date, name: 'Séance', xpEarned: xp, exercises: [], ...extra });

describe('logFromServerWorkout', () => {
  it("reconstruit une séance lisible par l'app (catalogue, volume, XP)", () => {
    const l = logFromServerWorkout(workout('w1', day(1)));
    expect(l.id).toBe(`${RESTORED_PREFIX}w1`);
    expect(l.exercises[0].targetMuscleGroup).toBe('pectoraux');
    expect(l.totalVolume).toBe(800);
    expect(l.xpEarned).toBeGreaterThan(0);
  });

  it("applique l'anti-triche de durée : courte 0, moins de 15 min divisé par 10", () => {
    expect(logFromServerWorkout(workout('w', day(1), { durationSeconds: 200 })).xpEarned).toBe(0);
    const full = logFromServerWorkout(workout('w', day(1))).xpEarned;
    expect(logFromServerWorkout(workout('w', day(1), { durationSeconds: 600 })).xpEarned).toBe(Math.round(full / 10));
  });
});

describe('planRecovery', () => {
  it("nouveau téléphone vide : toutes les séances du serveur reviennent", () => {
    const out = planRecovery([], [workout('w1', day(1)), workout('w2', day(3))], null);
    expect(out.map((l) => l.id)).toEqual([`${RESTORED_PREFIX}w2`, `${RESTORED_PREFIX}w1`]);
  });

  it("ne reconstruit que ce qui précède l'historique présent (une suppression ne revient pas)", () => {
    const logs = [log('log-a', day(10)), log('log-b', day(12))];
    const out = planRecovery(logs, [workout('old', day(2)), workout('deleted', day(11)), workout('a', day(10, 18))], null);
    const ids = out.map((l) => l.id);
    expect(ids).toContain(`${RESTORED_PREFIX}old`);
    expect(ids).not.toContain(`${RESTORED_PREFIX}deleted`);
    expect(ids).not.toContain(`${RESTORED_PREFIX}a`);
  });

  it('ne recrée jamais deux fois la même séance', () => {
    const once = planRecovery([], [workout('w1', day(1))], null);
    const twice = planRecovery(once, [workout('w1', day(1))], null);
    expect(twice).toHaveLength(1);
  });

  it("retire une séance reconstruite quand la vraie arrive d'un autre appareil", () => {
    const restored = planRecovery([], [workout('w1', day(1))], null);
    const withReal = [...restored, log('log-real', new Date(Date.parse(day(1)) - 60000).toISOString())];
    const out = planRecovery(withReal, null, null);
    expect(out.map((l) => l.id)).toEqual(['log-real']);
  });

  it('respecte le plafond de 2 séances avec XP par jour', () => {
    const out = planRecovery([], [workout('a', day(1, 8)), workout('b', day(1, 12)), workout('c', day(1, 20))], null);
    expect(out.filter((l) => l.xpEarned > 0)).toHaveLength(2);
  });

  it("rend l'XP des quêtes et rituels perdus sous une seule entrée", () => {
    const out = planRecovery([log('log-a', day(10), 1000)], null, 6000);
    const account = out.find((l) => l.id === ACCOUNT_XP_ID);
    expect(account.xpEarned).toBe(5000);
    expect(account.type).toBe('item_bonus');
    expect(out.reduce((s, l) => s + l.xpEarned, 0)).toBe(6000);
  });

  it("n'ajoute rien quand l'historique couvre déjà l'XP du compte (ou presque)", () => {
    expect(planRecovery([log('log-a', day(10), 5950)], null, 6000).find((l) => l.id === ACCOUNT_XP_ID)).toBeUndefined();
    expect(planRecovery([log('log-a', day(10), 9000)], null, 6000).find((l) => l.id === ACCOUNT_XP_ID)).toBeUndefined();
  });

  it("réduit l'entrée d'XP quand de vraies séances arrivent, sans jamais compter deux fois", () => {
    const first = planRecovery([log('log-a', day(10), 1000)], null, 6000);
    const later = planRecovery([...first, log('log-b', day(5), 3000)], null, 6000);
    expect(later.find((l) => l.id === ACCOUNT_XP_ID).xpEarned).toBe(2000);
    expect(later.reduce((s, l) => s + l.xpEarned, 0)).toBe(6000);
  });
});
