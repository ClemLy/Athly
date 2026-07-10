'use strict';

// Mocks manuels : ce fichier tourne sous testEnvironment 'node' (voir
// jest.config.js — pas d'environnement React Native), donc AsyncStorage et
// l'instance axios (../api/api) doivent être entièrement remplacés, jamais
// réellement importés (ils dépendent de bindings natifs indisponibles ici).
const mockGetItem = jest.fn();
const mockSetItem = jest.fn().mockResolvedValue(undefined);
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
}));

const mockPost = jest.fn();
jest.mock('../../api/api', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

const XP_SYNCED_FLAG_KEY = 'athly:xp:isXpSynced:v1';

describe('xpSync.service — synchronisation XP locale → backend (Section X)', () => {
  let syncXp;
  let retryPendingXpSync;

  beforeEach(() => {
    // lastSyncedXp est un state de MODULE (mémoire) — reset complet entre
    // chaque test pour ne jamais laisser un test polluer le suivant.
    jest.resetModules();
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    ({ syncXp, retryPendingXpSync } = require('../xpSync.service'));
  });

  describe('syncXp — mode connecté', () => {
    it('✅ Envoie le total XP arrondi et marque isXpSynced à true', async () => {
      mockPost.mockResolvedValue({ data: { success: true, level: 12, xp: 1800, rank: 'Initié', newlyUnlockedTitles: [] } });

      const result = await syncXp(1799.6);

      expect(mockPost).toHaveBeenCalledWith('/users/me/sync-xp', { xp: 1800 });
      expect(result).toEqual({ success: true, level: 12, xp: 1800, rank: 'Initié', newlyUnlockedTitles: [] });
      expect(mockSetItem).toHaveBeenCalledWith(XP_SYNCED_FLAG_KEY, 'true');
    });

    it("✅ Renvoie les titres nouvellement débloqués par ce gain d'XP", async () => {
      mockPost.mockResolvedValue({ data: { success: true, level: 50, xp: 200000, rank: 'Compétiteur', newlyUnlockedTitles: ['PERFORM_LEVEL_50'] } });

      const result = await syncXp(200000);

      expect(result.newlyUnlockedTitles).toContain('PERFORM_LEVEL_50');
    });

    it('✅ Ne rappelle pas l\'API si la valeur est identique au dernier sync réussi (dédup mémoire)', async () => {
      mockPost.mockResolvedValue({ data: { success: true, level: 5, xp: 500, rank: 'Novice', newlyUnlockedTitles: [] } });

      await syncXp(500);
      await syncXp(500);

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('✅ Rappelle bien l\'API si la valeur a changé depuis le dernier sync', async () => {
      mockPost.mockResolvedValue({ data: { success: true, level: 5, xp: 500, rank: 'Novice', newlyUnlockedTitles: [] } });
      await syncXp(500);

      mockPost.mockResolvedValue({ data: { success: true, level: 6, xp: 600, rank: 'Novice', newlyUnlockedTitles: [] } });
      await syncXp(600);

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('❌ xp négatif ou non-fini : ne fait aucun appel réseau', async () => {
      await syncXp(-5);
      await syncXp(NaN);
      await syncXp(undefined);

      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('syncXp — mode déconnecté (offline)', () => {
    it("✅ Échec réseau : renvoie null et marque isXpSynced à false (sans lever d'exception)", async () => {
      mockPost.mockRejectedValue(new Error('Network Error'));

      const result = await syncXp(1000);

      expect(result).toBeNull();
      expect(mockSetItem).toHaveBeenCalledWith(XP_SYNCED_FLAG_KEY, 'false');
    });

    it("✅ Un échec n'active pas la dédup mémoire — le prochain appel retente vraiment", async () => {
      mockPost.mockRejectedValueOnce(new Error('Network Error'));
      mockPost.mockResolvedValueOnce({ data: { success: true, level: 3, xp: 300, rank: 'Novice', newlyUnlockedTitles: [] } });

      const first  = await syncXp(300);
      const second = await syncXp(300);

      expect(first).toBeNull();
      expect(second).not.toBeNull();
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryPendingXpSync — retente au retour réseau / prochain démarrage', () => {
    it('✅ Retente si isXpSynced === "false"', async () => {
      mockGetItem.mockResolvedValue('false');
      mockPost.mockResolvedValue({ data: { success: true, level: 4, xp: 400, rank: 'Novice', newlyUnlockedTitles: [] } });

      await retryPendingXpSync(400);

      expect(mockPost).toHaveBeenCalledWith('/users/me/sync-xp', { xp: 400 });
    });

    it('❌ Ne retente pas si isXpSynced === "true" (déjà à jour)', async () => {
      mockGetItem.mockResolvedValue('true');

      await retryPendingXpSync(400);

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("❌ Ne retente pas si le flag n'a jamais été écrit (premier lancement)", async () => {
      mockGetItem.mockResolvedValue(null);

      await retryPendingXpSync(400);

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('✅ Best-effort : une erreur AsyncStorage ne lève jamais', async () => {
      mockGetItem.mockRejectedValue(new Error('storage unavailable'));

      await expect(retryPendingXpSync(400)).resolves.toBeUndefined();
      expect(mockPost).not.toHaveBeenCalled();
    });
  });
});
