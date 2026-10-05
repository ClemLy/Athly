jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateAccountScope, clearAccountScope, userIdFromToken } from '../accountScope.service';

const LOGS = 'athly:workoutLogs:v1';
const UNITS = 'athly:unit:weight:v1';

// JWT factice : seule la partie centrale (payload) est lue
const tokenFor = (id) => `x.${Buffer.from(JSON.stringify({ id })).toString('base64url')}.y`;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('userIdFromToken', () => {
  it("lit l'identifiant du compte dans le JWT", () => {
    expect(userIdFromToken(tokenFor('abc123'))).toBe('abc123');
  });

  it('renvoie null pour un token illisible', () => {
    expect(userIdFromToken('pas-un-jwt')).toBeNull();
  });
});

describe('activateAccountScope', () => {
  it("attribue les données existantes au premier compte connecté (mise à jour de l'app)", async () => {
    await AsyncStorage.setItem(LOGS, '["log-A"]');
    const changed = await activateAccountScope('A');
    expect(changed).toBe(false);
    expect(await AsyncStorage.getItem(LOGS)).toBe('["log-A"]');
  });

  it("isole l'historique de deux comptes sur le même appareil", async () => {
    await activateAccountScope('A');
    await AsyncStorage.setItem(LOGS, '["log-A"]');

    // B se connecte : il ne voit pas l'historique de A
    expect(await activateAccountScope('B')).toBe(true);
    expect(await AsyncStorage.getItem(LOGS)).toBeNull();
    await AsyncStorage.setItem(LOGS, '["log-B"]');

    // A revient : il retrouve son historique, celui de B est mis de côté
    expect(await activateAccountScope('A')).toBe(true);
    expect(await AsyncStorage.getItem(LOGS)).toBe('["log-A"]');

    await activateAccountScope('B');
    expect(await AsyncStorage.getItem(LOGS)).toBe('["log-B"]');
  });

  it("ne touche pas aux réglages de l'appareil", async () => {
    await activateAccountScope('A');
    await AsyncStorage.setItem(UNITS, 'lbs');
    await activateAccountScope('B');
    expect(await AsyncStorage.getItem(UNITS)).toBe('lbs');
  });
});

describe('clearAccountScope', () => {
  it("efface les données du compte supprimé sans toucher à celles d'un autre", async () => {
    await activateAccountScope('A');
    await AsyncStorage.setItem(LOGS, '["log-A"]');
    await activateAccountScope('B');
    await AsyncStorage.setItem(LOGS, '["log-B"]');

    await clearAccountScope('B');
    expect(await AsyncStorage.getItem(LOGS)).toBeNull();

    await activateAccountScope('A');
    expect(await AsyncStorage.getItem(LOGS)).toBe('["log-A"]');
  });
});
