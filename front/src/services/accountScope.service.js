import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bigStorage from '../utils/bigStorage';

// ─── Cloisonnement des données locales par compte ─────────────────────────────
// Athly est "local-first" : l'historique des séances, les quêtes, les séances
// enregistrées… vivent sur l'appareil. Sans cloisonnement, un second compte
// connecté sur le même téléphone (ou navigateur) voyait l'historique du premier,
// et synchronisait même son XP vers le mauvais compte.
//
// Principe : un seul jeu de données "actif" (les clés habituelles, lues par
// tous les services), rattaché à un propriétaire. À la connexion d'un autre
// compte, les données actives sont archivées sous l'identifiant de l'ancien
// propriétaire, puis celles du nouveau compte (s'il en a) sont restaurées.
//
// Les réglages d'appareil (unités, notifications, outils de dev) ne sont pas
// concernés : ils restent partagés.

const OWNER_KEY = 'athly:local-owner:v1';
const ARCHIVE_PREFIX = 'athly:archive:';
// Propriétaire fictif après une suppression de compte : le prochain compte
// connecté récupère ses propres données archivées (et non un jeu vide hérité).
const NO_OWNER = '__none__';

// Petites valeurs, dans AsyncStorage.
export const ACCOUNT_SCOPED_KEYS = [
  '@athly_daily_quests',
  'athly:workout:inprogress:v1',
  'athly:xp:isXpSynced:v1',
  'athly:pref:featuredTrophies:v1',
  'athly:pref:profileTheme:v1',
  'athly:avatarColor:v1',
  'athly:avatarShape:v1',
  'athly:birthday:shown_date:v1',
  'athly:weight:reminder:dismissed_at:v1',
  'athly:tutorial:completed:v1',
  'athly:tutorial:pendingChapter:v1',
  'athly:history:recovery:v1',
];

// Grosses valeurs, dans le stockage dédié (utils/bigStorage.js : morceaux sur
// iOS / Android, IndexedDB sur le web) : déplacées une par une.
export const ACCOUNT_SCOPED_BIG_KEYS = [
  'athly:workoutLogs:v1',
  'athly:customExercises:v1',
  'athly:savedWorkouts:v1',
  // Modifications pas encore envoyées à la sauvegarde du compte (cloudCollection.js)
  'athly:cloud:pending:logs:v1',
  'athly:cloud:pending:savedWorkouts:v1',
  'athly:cloud:pending:customExercises:v1',
  'athly:cloud:pending:prefs:v1',
];

const archiveKey = (userId, key) => `${ARCHIVE_PREFIX}${userId}:${key}`;

// Déplace une grosse valeur (to = null : la supprime simplement).
async function moveBig(from, to) {
  const value = await bigStorage.getItem(from);
  if (value == null) return;
  if (to) await bigStorage.setItem(to, value);
  await bigStorage.removeItem(from);
}

// Lecture de l'identifiant du compte dans le JWT (partie publique, non vérifiée
// ici : la vérification est faite par le serveur à chaque requête).
export function userIdFromToken(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === 'function'
      ? atob(padded)
      : globalThis.Buffer?.from(padded, 'base64').toString('utf8');
    const id = JSON.parse(json || '{}').id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * Active les données locales du compte `userId`.
 * @returns {Promise<boolean>} true si les données actives ont changé
 */
export async function activateAccountScope(userId) {
  if (!userId) return false;
  try {
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (owner === userId) return false;

    // Première connexion depuis cette mise à jour : les données déjà présentes
    // appartiennent à ce compte (aucun autre propriétaire connu).
    if (!owner) {
      await AsyncStorage.setItem(OWNER_KEY, userId);
      return false;
    }

    // 1. Mise de côté des données de l'ancien propriétaire
    const current = await AsyncStorage.multiGet(ACCOUNT_SCOPED_KEYS);
    const toArchive = current
      .filter(([, value]) => value != null)
      .map(([key, value]) => [archiveKey(owner, key), value]);
    if (toArchive.length > 0 && owner !== NO_OWNER) await AsyncStorage.multiSet(toArchive);
    await AsyncStorage.multiRemove(ACCOUNT_SCOPED_KEYS);

    // 2. Restauration des données du nouveau compte, s'il en a sur cet appareil
    const archived = await AsyncStorage.multiGet(ACCOUNT_SCOPED_KEYS.map((k) => archiveKey(userId, k)));
    const toRestore = archived
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key.slice(archiveKey(userId, '').length), value]);
    if (toRestore.length > 0) await AsyncStorage.multiSet(toRestore);
    await AsyncStorage.multiRemove(archived.map(([key]) => key));

    // 3. Même chose pour les grosses valeurs
    for (const key of ACCOUNT_SCOPED_BIG_KEYS) {
      await moveBig(key, owner !== NO_OWNER ? archiveKey(owner, key) : null);
      await moveBig(archiveKey(userId, key), key);
    }

    await AsyncStorage.setItem(OWNER_KEY, userId);
    return true;
  } catch {
    // En cas d'échec du stockage, on ne bloque jamais la connexion
    return false;
  }
}

/**
 * Efface toutes les données locales du compte `userId` (suppression de compte).
 */
export async function clearAccountScope(userId) {
  try {
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    const keys = [...ACCOUNT_SCOPED_KEYS.map((k) => (userId ? archiveKey(userId, k) : null)).filter(Boolean)];
    const isActive = !userId || owner === userId;
    if (isActive) keys.push(...ACCOUNT_SCOPED_KEYS);
    await AsyncStorage.multiRemove(keys);
    for (const key of ACCOUNT_SCOPED_BIG_KEYS) {
      if (userId) await bigStorage.removeItem(archiveKey(userId, key));
      if (isActive) await bigStorage.removeItem(key);
    }
    if (isActive) await AsyncStorage.setItem(OWNER_KEY, NO_OWNER);
  } catch {
    // best effort
  }
}
