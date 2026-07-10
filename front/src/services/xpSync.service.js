import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';

// ─── Synchronisation XP locale → backend (Section X) ───────────────────────────
// L'app reste local-first pour l'XP (AsyncStorage, réactif, jamais bloqué par
// le réseau) — mais le backend doit rester la Source de Vérité pour tout ce
// qui est gated côté serveur (coffres niveau 11+, conditions de titres comme
// "Le Titan"). Ce service pousse silencieusement le total XP local vers
// POST /api/users/me/sync-xp à chaque événement clé (voir WorkoutLogsContext.js
// et App.js) ; le backend applique un ratchet (n'accepte jamais une baisse),
// donc rejouer ce sync n'importe quand est toujours sans danger.
//
// Pas de détection réseau active (pas de NetInfo dans ce projet) : en cas
// d'échec, isXpSynced passe à false et CHAQUE prochain événement clé (dont le
// prochain démarrage de l'app) retente — cohérent avec le reste de l'app, qui
// n'observe jamais la connectivité activement (voir api.js, mode dégradé
// "tente et dégrade" plutôt que "surveille puis agit").

const XP_SYNCED_FLAG_KEY = 'athly:xp:isXpSynced:v1';

// Garde en mémoire (pas AsyncStorage) la dernière valeur réellement envoyée
// avec succès cette session — évite de spammer l'API à chaque log ajouté
// pendant une même séance si l'xp n'a pas bougé entre deux appels.
let lastSyncedXp = null;

/**
 * Pousse `totalXP` (cumul local total, jamais un delta) vers le backend.
 * Best-effort : ne lève jamais, best pour être appelée en fire-and-forget
 * depuis n'importe quel point d'action sans `await` bloquant l'UI.
 *
 * @param {number} totalXP
 * @returns {Promise<{level:number, xp:number, rank:string, newlyUnlockedTitles:string[]}|null>}
 */
export async function syncXp(totalXP) {
  if (!Number.isFinite(totalXP) || totalXP < 0) return null;
  const rounded = Math.round(totalXP);
  if (rounded === lastSyncedXp) return null; // rien de nouveau depuis le dernier sync réussi

  try {
    const res = await API.post('/users/me/sync-xp', { xp: rounded });
    lastSyncedXp = rounded;
    AsyncStorage.setItem(XP_SYNCED_FLAG_KEY, 'true').catch(() => {});
    return res.data ?? null;
  } catch (_) {
    AsyncStorage.setItem(XP_SYNCED_FLAG_KEY, 'false').catch(() => {});
    return null;
  }
}

/**
 * À appeler au démarrage de l'app (check-up de cohérence) : relit le flag
 * laissé par un échec précédent et retente si besoin. Comme `syncXp` est de
 * toute façon appelée à chaque événement clé, ceci n'est qu'un filet de
 * sécurité supplémentaire pour le cas "aucune action XP depuis le retour du
 * réseau" (ex: l'utilisateur rouvre juste l'app sans s'entraîner).
 *
 * @param {number} currentTotalXP — total XP local ACTUEL (pas la valeur figée
 *   au moment de l'échec — le ratchet backend prend de toute façon le max).
 */
export async function retryPendingXpSync(currentTotalXP) {
  try {
    const flag = await AsyncStorage.getItem(XP_SYNCED_FLAG_KEY);
    if (flag === 'false') {
      await syncXp(currentTotalXP);
    }
  } catch (_) {
    // best-effort
  }
}
