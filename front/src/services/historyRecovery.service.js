import AsyncStorage from '@react-native-async-storage/async-storage';
import { logsCloud, computeXP, computeWorkoutStats } from './stats.service';
import { BUILTIN_CATALOG } from '../data/exerciseCatalog';
import { resolveMuscleGroup } from '../constants/exerciseFilters';
import { normalizeText } from '../data/exerciseSearch';

// ─── Récupération d'un historique perdu avant la sauvegarde du compte ─────────
// Avant la sauvegarde du compte, l'historique ne vivait que sur le téléphone :
// un téléphone changé ou réinitialisé l'avait perdu. Le serveur, lui, a gardé
// chaque séance terminée (exercices, séries, durée, date) et le total d'XP.
//
//  1. Séances : celles du serveur plus anciennes que la plus ancienne séance
//     présente sur le téléphone sont reconstruites (id "log-srv-…"). Jamais
//     au milieu de l'historique existant : une séance supprimée volontairement
//     ne revient pas.
//  2. Doublons : si la vraie séance arrive plus tard (un autre appareil envoie
//     enfin son historique), la séance reconstruite est retirée.
//  3. XP : les quêtes, rituels et bonus perdus ne peuvent pas être
//     reconstruits un par un. Le serveur fournit l'XP acquise avant la
//     sauvegarde (xpFloor) ; l'écart avec l'historique devient une entrée
//     "XP déjà gagnée sur ton compte" (id fixe, jamais une séance).

export const RESTORED_PREFIX = 'log-srv-';
export const ACCOUNT_XP_ID = 'log-account-xp';
const STATE_KEY = 'athly:history:recovery:v1';   // { done, xpFloor } (propre au compte)
const MATCH_WINDOW_MS = 30 * 60 * 1000;          // log local ↔ séance serveur
const MAX_XP_SESSIONS_PER_DAY = 2;               // même règle que addLog

const isSession = (l) => l && l.type !== 'ritual' && l.type !== 'quest_reward' && l.type !== 'item_bonus';
const isRestored = (l) => String(l?.id || '').startsWith(RESTORED_PREFIX);
const time = (d) => new Date(d).getTime() || 0;
const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

const catalogByName = new Map(BUILTIN_CATALOG.map((e) => [normalizeText(e.name), e]));

// Log d'historique (même forme que buildLogFromWorkout) à partir d'une séance serveur.
export function logFromServerWorkout(w) {
  const exercises = (w.exercises || []).map((ex, i) => {
    const known = catalogByName.get(normalizeText(ex.name || ''));
    return {
      id: known ? known.id : `srv-${i}`,
      name: ex.name || '',
      targetMuscleGroup: known?.targetMuscleGroup || resolveMuscleGroup(ex.targetMuscle) || null,
      targetMuscle: ex.targetMuscle || known?.targetMuscle || '',
      isCompound: !!known?.isCompound,
      sets: (ex.sets || []).map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, completed: !!s.completed })),
    };
  });
  const stats = computeWorkoutStats({ exercises });
  const duration = Number(w.durationSeconds) || 0;
  const short = !!w.shortSession || duration < 300;
  let xp = short ? 0 : computeXP({ exercises });
  if (!short && duration < 900) xp = Math.round(xp / 10);
  return {
    id: `${RESTORED_PREFIX}${w.id}`,
    serverWorkoutId: w.id,
    restoredFromAccount: true,
    date: new Date(w.finishedAt).toISOString(),
    name: w.name || 'Séance',
    exercises,
    totalVolume: stats.totalVolume,
    setsCompleted: stats.setsCompleted,
    totalSets: exercises.reduce((n, ex) => n + ex.sets.length, 0),
    muscleDistribution: stats.muscleDistribution,
    xpEarned: xp,
    durationSeconds: duration,
    notes: '',
    ...(short ? { shortSession: true } : {}),
  };
}

/**
 * Calcule le nouvel historique. Pure, testée dans __tests__.
 * @param {object[]} logs — historique local actuel
 * @param {object[]|null} workouts — séances du serveur (null : pas de reconstruction)
 * @param {number|null} xpFloor — XP acquise avant la sauvegarde (null : inconnue)
 * @returns {object[]} historique complet à enregistrer
 */
export function planRecovery(logs, workouts, xpFloor) {
  let next = (logs || []).filter(Boolean);

  // 1. Reconstruction des séances antérieures à l'historique présent
  if (Array.isArray(workouts) && workouts.length) {
    const realSessions = next.filter((l) => isSession(l) && !isRestored(l));
    const known = new Set(next.map((l) => l.serverWorkoutId).filter(Boolean));
    const ids = new Set(next.map((l) => l.id));
    const oldest = realSessions.length ? Math.min(...realSessions.map((l) => time(l.date))) : Infinity;
    const added = [];
    for (const w of workouts) {
      const at = time(w.finishedAt);
      if (!at || known.has(w.id) || ids.has(`${RESTORED_PREFIX}${w.id}`)) continue;
      if (at >= oldest - MATCH_WINDOW_MS) continue;
      added.push(logFromServerWorkout(w));
    }
    // Plafond quotidien (2 séances avec XP par jour), dans l'ordre chronologique
    const perDay = {};
    for (const l of next) {
      if (isSession(l) && (Number(l.xpEarned) || 0) > 0) perDay[dayOf(l.date)] = (perDay[dayOf(l.date)] || 0) + 1;
    }
    added.sort((a, b) => time(a.date) - time(b.date)).forEach((l) => {
      if (l.xpEarned <= 0) return;
      const d = dayOf(l.date);
      if ((perDay[d] || 0) >= MAX_XP_SESSIONS_PER_DAY) l.xpEarned = 0;
      else perDay[d] = (perDay[d] || 0) + 1;
    });
    next = [...next, ...added];
  }

  // 2. Doublons : une vraie séance proche d'une séance reconstruite l'emporte
  const real = next.filter((l) => isSession(l) && !isRestored(l));
  next = next.filter((l) => {
    if (!isRestored(l)) return true;
    if (real.some((r) => r.serverWorkoutId && r.serverWorkoutId === l.serverWorkoutId)) return false;
    return !real.some((r) => Math.abs(time(r.date) - time(l.date)) <= MATCH_WINDOW_MS);
  });

  // 3. XP déjà gagnée sur le compte (quêtes, rituels, bonus d'avant)
  if (xpFloor != null) {
    const others = next.filter((l) => l.id !== ACCOUNT_XP_ID);
    const sum = others.reduce((s, l) => s + Math.max(0, Number(l.xpEarned) || 0), 0);
    const gap = Math.round(xpFloor - sum);
    // Petit écart : imprécision de l'estimation, pas une perte réelle.
    const meaningful = gap > Math.max(200, xpFloor * 0.02);
    const oldestDate = others.length ? Math.min(...others.map((l) => time(l.date))) : Date.now();
    next = meaningful
      ? [...others, {
        id: ACCOUNT_XP_ID,
        type: 'item_bonus',
        name: 'XP déjà gagnée sur ton compte',
        date: new Date(oldestDate - 1000).toISOString(),
        exercises: [], totalVolume: 0, setsCompleted: 0, totalSets: 0, muscleDistribution: {},
        durationSeconds: 0, notes: '',
        xpEarned: gap,
      }]
      : others;
  }

  return next.sort((a, b) => time(b.date) - time(a.date));
}

async function readState() {
  try { return JSON.parse((await AsyncStorage.getItem(STATE_KEY)) || 'null') || {}; } catch (_) { return {}; }
}

/**
 * À appeler après une récupération réussie de la sauvegarde du compte.
 * La première fois sur cet appareil, interroge le serveur ; ensuite, ne fait
 * que retirer les doublons et ajuster l'XP déjà gagnée (sans réseau).
 * @returns {Promise<boolean>} true si l'historique a changé
 */
export async function maintainHistory() {
  const state = await readState();
  let workouts = null;
  let xpFloor = state.xpFloor ?? null;
  if (!state.done) {
    try {
      const res = await require('../api/api').default.get('/cloud/recovery');
      if (res.fromCache || !Array.isArray(res.data?.workouts)) return false;
      workouts = res.data.workouts;
      xpFloor = Number.isFinite(res.data.xpFloor) ? res.data.xpFloor : null;
    } catch (_) {
      return false; // hors ligne : nouvel essai au prochain démarrage
    }
  }

  const changed = await logsCloud.transaction(async ({ read, write }) => {
    const current = await read();
    const next = planRecovery(current, workouts, xpFloor);
    const differs = JSON.stringify(next) !== JSON.stringify(current);
    if (differs) await write(next);
    return differs;
  });
  if (!state.done) {
    try { await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ done: true, xpFloor })); } catch (_) {}
  }
  return changed;
}
