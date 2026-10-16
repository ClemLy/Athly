jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bigStorage from '../bigStorage';
import { activateAccountScope, clearAccountScope } from '../../services/accountScope.service';

const KEY = 'athly:workoutLogs:v1';
const logs = (n, tag = 'A') => Array.from({ length: n }, (_, i) => ({ id: `log-${tag}-${i}`, name: 'Séance Push', xpEarned: 400 }));

beforeAll(() => bigStorage.configureBigStorage({ chunkSize: 200 }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('bigStorage (iOS / Android)', () => {
  it('découpe une grosse valeur en morceaux et la relit à l’identique', async () => {
    const value = logs(30);
    await bigStorage.setJson(KEY, value);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((k) => k.startsWith(`${KEY}::`)).length).toBeGreaterThan(5);
    expect(await bigStorage.getJson(KEY, [])).toEqual(value);
  });

  it('relit les données stockées avant la mise à jour (une seule valeur)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(logs(30)));
    expect(await bigStorage.getJson(KEY, [])).toHaveLength(30);
  });

  it("ne laisse pas de morceaux orphelins quand l'historique change de taille", async () => {
    await bigStorage.setJson(KEY, logs(30));
    await bigStorage.setJson(KEY, logs(40));
    await bigStorage.setJson(KEY, logs(1));
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toEqual([KEY]);
    expect(await bigStorage.getJson(KEY, [])).toHaveLength(1);
  });

  it('une coupure en pleine écriture laisse l’ancienne version lisible', async () => {
    await bigStorage.setJson(KEY, logs(30));
    const multiSet = AsyncStorage.multiSet;
    AsyncStorage.multiSet = jest.fn().mockRejectedValueOnce(new Error('coupure'));
    await expect(bigStorage.setJson(KEY, logs(50, 'B'))).rejects.toThrow('coupure');
    AsyncStorage.multiSet = multiSet;
    const back = await bigStorage.getJson(KEY, []);
    expect(back).toHaveLength(30);
    expect(back[0].id).toBe('log-A-0');
  });

  it("renvoie la valeur par défaut si un morceau manque (plutôt qu'un JSON tronqué)", async () => {
    await bigStorage.setJson(KEY, logs(30));
    const part = (await AsyncStorage.getAllKeys()).find((k) => k.startsWith(`${KEY}::`));
    await AsyncStorage.removeItem(part);
    expect(await bigStorage.getJson(KEY, [])).toEqual([]);
  });

  it('supprime la valeur et tous ses morceaux', async () => {
    await bigStorage.setJson(KEY, logs(30));
    await bigStorage.removeItem(KEY);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});

describe('cloisonnement par compte avec un gros historique', () => {
  it("échange les historiques découpés de deux comptes sans rien mélanger", async () => {
    await activateAccountScope('A');
    await bigStorage.setJson(KEY, logs(30, 'A'));

    expect(await activateAccountScope('B')).toBe(true);
    expect(await bigStorage.getJson(KEY, [])).toEqual([]);
    await bigStorage.setJson(KEY, logs(25, 'B'));

    await activateAccountScope('A');
    const a = await bigStorage.getJson(KEY, []);
    expect(a).toHaveLength(30);
    expect(a.every((l) => l.id.startsWith('log-A-'))).toBe(true);

    await activateAccountScope('B');
    expect(await bigStorage.getJson(KEY, [])).toHaveLength(25);
  });

  it("la suppression d'un compte efface son historique découpé et son archive", async () => {
    await activateAccountScope('A');
    await bigStorage.setJson(KEY, logs(30, 'A'));
    await activateAccountScope('B');
    await clearAccountScope('A');
    await activateAccountScope('A');
    expect(await bigStorage.getJson(KEY, [])).toEqual([]);
    const leftovers = (await AsyncStorage.getAllKeys()).filter((k) => k.includes('log') || k.includes('archive:A'));
    expect(leftovers).toEqual([]);
  });
});
