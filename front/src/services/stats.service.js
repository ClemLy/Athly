import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUBMUSCLE_TO_GROUP, normalizeId } from '../constants/exerciseFilters';

// ─────────────────────────────────────────────────────────────────────────────
// Service de statistiques (100% local AsyncStorage).
// Fournit :
//   1. CRUD des logs de séances finalisées
//   2. Calculs purs (memo-friendly) : totalVolume, distribution musculaire, XP
//   3. Agrégats globaux (par période) et par exercice
//   4. Suggestion de progression (+2.5 / +1 kg)
//   5. Conversion XP ↔ niveau + multiplicateurs de streak
//
// Toutes les fonctions d'agrégat sont **pures** : on les memoïse côté composant
// avec useMemo(deps = logs + period). Aucun calcul implicite côté UI.
//
// XP curve rebalancée (v2) : taux 1.03, base 4665
//   Niveau 1 : ~140 XP / Niveau 100 : ~85 000 XP (≈ 1 an d'effort soutenu)
//   Niveau 200 : ~1.72 M XP (≈ 20 ans avec streak max — Graal absolu)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'athly:workoutLogs:v1';

function genId() {
  return `log-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function writeAll(items) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ─── XP & Niveaux ────────────────────────────────────────────────────────────

// Courbe exponentielle (v2) : taux 1.03, accroissement modéré entre niveaux.
//   L1: ~140 XP / L10: ~1 604 / L30: ~6 657 / L100: ~85 000 / L200: ~1.72 M
// Objectif : niveau 100 atteignable en ~1 an avec entraînement soutenu + streaks.
const BASE_LEVEL_XP = 4665;
const XP_RATE       = 1.03;

export function xpForLevel(n) {
  if (n <= 0) return 0;
  const lvl = Math.min(200, n);
  return Math.round(BASE_LEVEL_XP * (Math.pow(XP_RATE, lvl) - 1));
}

// ─── Streak & Multiplicateurs ────────────────────────────────────────────────

// Paliers du multiplicateur — interpolation linéaire entre chaque jalons.
//   0j   : ×1.0     7j  : ×1.2     30j : ×1.5
//   90j  : ×2.0    180j : ×3.0    365j : ×4.5     730j+ : ×7.0 (cap)
export const STREAK_MILESTONES = [
  { days: 0,   multiplier: 1.0, label: null,               color: null,      tier: 'base'      },
  { days: 3,   multiplier: 1.1, label: 'On Fire',          color: '#FE7439', tier: 'fire'      },
  { days: 7,   multiplier: 1.2, label: 'Week Warrior',     color: '#FE7439', tier: 'fire'      },
  { days: 30,  multiplier: 1.5, label: 'Godly Streak',     color: '#FFD700', tier: 'godly'     },
  { days: 90,  multiplier: 2.0, label: '3 Mois de Feu',    color: '#8B5CF6', tier: 'quarter'   },
  { days: 180, multiplier: 3.0, label: 'Semi-Annuel',      color: '#A855F7', tier: 'halfyear'  },
  { days: 365, multiplier: 4.5, label: 'Streak Annuel',    color: '#C084FC', tier: 'annual'    },
  { days: 730, multiplier: 7.0, label: 'Streak Légendaire',color: '#FFD700', tier: 'legendary' },
];

const _PTS = STREAK_MILESTONES.map((m) => [m.days, m.multiplier]);

export function getStreakMultiplier(streak) {
  const s = Math.max(0, Math.floor(streak));

  let rawMult = 1.0;
  if (s >= _PTS[_PTS.length - 1][0]) {
    rawMult = _PTS[_PTS.length - 1][1];
  } else {
    for (let i = 0; i < _PTS.length - 1; i++) {
      const [s0, v0] = _PTS[i];
      const [s1, v1] = _PTS[i + 1];
      if (s >= s0 && s < s1) {
        rawMult = v0 + ((s - s0) / (s1 - s0)) * (v1 - v0);
        break;
      }
    }
  }
  const multiplier = Math.round(rawMult * 10) / 10;

  // Trouver le palier atteint (le plus haut dont days <= s)
  let reached = STREAK_MILESTONES[0];
  for (const m of STREAK_MILESTONES) {
    if (s >= m.days) reached = m;
  }

  return {
    multiplier,
    label:  reached.days >= 3 ? reached.label : null,
    color:  reached.color,
    tier:   reached.tier,
  };
}

// Convertit un XP total cumulé en { level, currentInLevel, neededForNext, progress }.
// Retour identique à l'ancienne API — drop-in replacement.
export function xpToLevel(totalXP) {
  const xp = Math.max(0, Number(totalXP) || 0);
  let level = 0;
  let lo = 0;
  let hi = 200;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (xpForLevel(mid) <= xp) { level = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  const totalForLevel = xpForLevel(level);
  const totalForNext  = xpForLevel(level + 1);
  const rangeSize     = totalForNext - totalForLevel;
  return {
    level,
    currentInLevel : xp - totalForLevel,
    neededForNext  : rangeSize,
    totalForLevel,
    totalForNext,
    progress       : rangeSize > 0 ? (xp - totalForLevel) / rangeSize : 1,
  };
}

// Rang visuel associé à un niveau (1-200).
export function getRank(level) {
  const lvl = Math.max(0, Math.min(200, Number(level) || 0));
  if (lvl >= 200) return { name: 'ATHLY GOD',   tier: 'god',         color: '#FFD700', glowColor: 'rgba(255,215,0,0.55)',    shimmer: true };
  if (lvl >= 171) return { name: 'Légende',      tier: 'legend',      color: '#C084FC', glowColor: 'rgba(192,132,252,0.50)', shimmer: true };
  if (lvl >= 141) return { name: 'Grand Maître', tier: 'grandmaster', color: '#A855F7', glowColor: 'rgba(168,85,247,0.40)',  shimmer: false };
  if (lvl >= 111) return { name: 'Maître',       tier: 'master',      color: '#8B5CF6', glowColor: 'rgba(139,92,246,0.35)', shimmer: false };
  if (lvl >= 91)  return { name: 'Élite',        tier: 'elite',       color: '#6E6AF0', glowColor: 'rgba(110,106,240,0.30)', shimmer: false };
  if (lvl >= 71)  return { name: 'Warrior',      tier: 'warrior',     color: '#6E6AF0', glowColor: 'rgba(110,106,240,0.25)', shimmer: false };
  if (lvl >= 51)  return { name: 'Compétiteur',  tier: 'competitor',  color: '#3B82F6', glowColor: null,                    shimmer: false };
  if (lvl >= 31)  return { name: 'Athlète',      tier: 'athlete',     color: '#22C55E', glowColor: null,                    shimmer: false };
  if (lvl >= 11)  return { name: 'Initié',       tier: 'initiate',    color: '#FBBF24', glowColor: null,                    shimmer: false };
  return           { name: 'Novice',             tier: 'novice',      color: '#FE7439', glowColor: null,                    shimmer: false };
}

// Formule : par exercice, XP = setsCompleted × 10 + (volume × multiplier) / 20
//   - multiplier = 1.2 si isCompound, 1 sinon
// Bodyweight (volume=0) : 10 XP/set. Session ~10 sets ≈ 100–250 XP de base.
export function computeXP(log) {
  let xp = 0;
  if (!log || !Array.isArray(log.exercises)) return 0;
  for (const ex of log.exercises) {
    if (!Array.isArray(ex.sets)) continue;
    let exVolume = 0;
    let exSetsCompleted = 0;
    for (const s of ex.sets) {
      if (!s) continue;
      if (s.completed) {
        exSetsCompleted += 1;
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        if (w && r) exVolume += w * r;
      }
    }
    const multiplier = ex.isCompound ? 1.2 : 1;
    xp += exSetsCompleted * 10 + (exVolume * multiplier) / 20;
  }
  return Math.round(xp);
}


// ─── Calculs locaux d'un workout en cours ────────────────────────────────────

// Calcule volume / sets / distribution musculaire / XP pour un workout en cours.
export function computeWorkoutStats(workout) {
  let totalVolume = 0;
  let setsCompleted = 0;
  const muscleDistribution = {};
  if (!workout || !Array.isArray(workout.exercises)) {
    return { totalVolume: 0, setsCompleted: 0, muscleDistribution: {}, xpEarned: 0 };
  }
  for (const ex of workout.exercises) {
    if (!Array.isArray(ex.sets)) continue;
    let exVolume = 0;
    let exCompletedReps = 0;
    for (const s of ex.sets) {
      if (!s || !s.completed) continue;
      const w = Number(s.weight) || 0;
      const r = Number(s.reps) || 0;
      if (w && r) {
        exVolume += w * r;
        totalVolume += w * r;
      }
      if (r > 0) exCompletedReps += r;
      setsCompleted += 1;
    }
    // Inclure aussi les exercices poids du corps (weight=0) si des reps ont été effectuées
    if (exVolume > 0 || exCompletedReps > 0) {
      const groupId = ex.targetMuscleGroup
        || SUBMUSCLE_TO_GROUP[normalizeId(ex.targetMuscle || '')]
        || 'other';
      muscleDistribution[groupId] = (muscleDistribution[groupId] || 0) + exVolume;
    }
  }
  const xpEarned = computeXP(workout);
  return { totalVolume, setsCompleted, muscleDistribution, xpEarned };
}

// Construit un log à partir d'un workout state. Attaché à AsyncStorage par addLog().
// prevLogs : logs existants (avant cette séance) — sert à calculer le streak actif
// et appliquer le multiplicateur XP correspondant.
export function buildLogFromWorkout(workout, prevLogs = []) {
  const stats = computeWorkoutStats(workout);
  const duration = Number((workout && workout.durationSeconds) || 0);

  // Streak & multiplicateur — basé sur les séances précédentes uniquement
  const streak = computeStreak(Array.isArray(prevLogs) ? prevLogs : []);
  const streakData = getStreakMultiplier(streak);

  // Anti-cheat temporel : séance < 15 min → XP ÷ 10
  let xpEarned = Math.round(stats.xpEarned * streakData.multiplier);
  if (duration > 0 && duration < 900) {
    xpEarned = Math.round(xpEarned / 10);
  }

  return {
    id: genId(),
    date: new Date().toISOString(),
    name: (workout && workout.name) || 'Séance',
    exercises: Array.isArray(workout && workout.exercises)
      ? workout.exercises.map((ex) => ({
          id: ex.id || null,
          name: ex.name || '',
          targetMuscleGroup: ex.targetMuscleGroup
            || SUBMUSCLE_TO_GROUP[normalizeId(ex.targetMuscle || '')]
            || null,
          targetMuscle: ex.targetMuscle || '',
          isCompound: !!ex.isCompound,
          sets: Array.isArray(ex.sets)
            ? ex.sets.map((s) => ({
                weight: Number((s && s.weight) || 0),
                reps: Number((s && s.reps) || 0),
                completed: !!(s && s.completed),
              }))
            : [],
        }))
      : [],
    totalVolume: stats.totalVolume,
    setsCompleted: stats.setsCompleted,
    totalSets: (Array.isArray(workout && workout.exercises) ? workout.exercises : []).reduce(
      (n, ex) => n + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0,
    ),
    muscleDistribution: stats.muscleDistribution,
    xpEarned,
    durationSeconds: duration,
    notes: (workout && workout.notes) || '',
    streakAtFinish: streak,
    xpMultiplier: streakData.multiplier,
  };
}

// ─── CRUD logs ───────────────────────────────────────────────────────────────

export async function listLogs() {
  const all = await readAll();
  // Tri descendant par date (plus récent en premier)
  return [...all].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function addLog(log) {
  const all = await readAll();

  let xpEarned = Number(log.xpEarned) || 0;

  // Anti-cheat quotidien : max 2 séances avec XP par jour calendaire.
  // Les rituels ont leur propre quota (1/jour) géré dans addRitualLog.
  if (log.type !== 'ritual') {
    const todayKey = log.date ? log.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const xpSessionsToday = all.filter(
      (l) => l.type !== 'ritual' && l.date && l.date.slice(0, 10) === todayKey && (Number(l.xpEarned) || 0) > 0,
    );
    if (xpSessionsToday.length >= 2) xpEarned = 0;
  }

  const finalLog = { ...log, xpEarned };
  await writeAll([finalLog, ...all]);
  return finalLog;
}

// Crée un log de rituel (max 1 par jour). Retourne null si déjà effectué aujourd'hui.
export async function addRitualLog(ritualId, ritualLabel, durationSeconds = 300, xpEarned = 20) {
  const all = await readAll();
  const todayKey = new Date().toISOString().slice(0, 10);
  const ritualToday = all.find(
    (l) => l.type === 'ritual' && l.date && l.date.slice(0, 10) === todayKey,
  );
  if (ritualToday) return null;

  const log = {
    id: genId(),
    date: new Date().toISOString(),
    name: ritualLabel,
    type: 'ritual',
    ritualId,
    exercises: [],
    totalVolume: 0,
    setsCompleted: 0,
    totalSets: 0,
    muscleDistribution: {},
    durationSeconds,
    xpEarned,
    notes: '',
  };
  await writeAll([log, ...all]);
  return log;
}

export async function removeLog(id) {
  const all = await readAll();
  await writeAll(all.filter((x) => x.id !== id));
}

export async function clearLogs() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── Helpers période ────────────────────────────────────────────────────────

export const PERIODS = ['week', 'month', 'all'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d) {
  // YYYY-MM-DD basé sur les composantes locales pour éviter le décalage UTC.
  const dt = (d instanceof Date) ? d : new Date(d);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

function weekKey(d) {
  const dt = startOfDay((d instanceof Date) ? d : new Date(d));
  const dow = (dt.getDay() + 6) % 7; // lundi = 0
  dt.setDate(dt.getDate() - dow);
  return dayKey(dt);
}

function monthKey(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function periodCutoff(period) {
  const now = new Date();
  if (period === 'week') return new Date(now.getTime() - 7 * 86400000);
  if (period === 'month') return new Date(now.getTime() - 30 * 86400000);
  return new Date(0);
}

function filterByPeriod(logs, period) {
  if (period === 'all') return logs;
  const cutoff = periodCutoff(period).getTime();
  return logs.filter((l) => new Date(l.date).getTime() >= cutoff);
}

// ─── Agrégats globaux ────────────────────────────────────────────────────────

// Renvoie tout ce dont le dashboard a besoin pour la période donnée.
// Pure → memoïsable côté composant.
//
// Returns :
//   {
//     totalVolume, totalSets, totalSessions,
//     muscleDistribution: { [groupId]: kg },
//     timeline: [{ label, value, key }],   // bar chart
//     calendarDates: { 'YYYY-MM-DD': true } // calendrier
//   }
//
export function aggregateGlobal(logs, period) {
  const filtered = filterByPeriod(Array.isArray(logs) ? logs : [], period);
  let totalVolume = 0;
  let totalSets = 0;
  const muscleDistribution = {};
  const calendarDates = {};

  for (const log of filtered) {
    totalVolume += Number(log.totalVolume) || 0;
    totalSets += Number(log.setsCompleted) || 0;
    calendarDates[dayKey(log.date)] = true;
    if (log.muscleDistribution) {
      for (const k of Object.keys(log.muscleDistribution)) {
        muscleDistribution[k] = (muscleDistribution[k] || 0) + log.muscleDistribution[k];
      }
    }
  }

  // Timeline : groupement par jour (week), semaine (month), mois (all)
  const buckets = new Map();
  let bucketFn;
  let bucketCount;
  if (period === 'week') {
    bucketFn = dayKey;
    bucketCount = 7;
    // Init 7 derniers jours pour gérer les "trous"
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000);
      buckets.set(dayKey(d), { label: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][(d.getDay() + 6) % 7], value: 0, key: dayKey(d) });
    }
  } else if (period === 'month') {
    bucketFn = weekKey;
    bucketCount = 5;
    for (let i = 4; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 7 * 86400000);
      const k = weekKey(d);
      const lbl = `S${5 - i}`;
      buckets.set(k, { label: lbl, value: 0, key: k });
    }
  } else {
    bucketFn = monthKey;
    bucketCount = 12;
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const k = monthKey(d);
      const lbl = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][d.getMonth()];
      buckets.set(k, { label: lbl, value: 0, key: k });
    }
  }

  for (const log of filtered) {
    const k = bucketFn(log.date);
    if (buckets.has(k)) {
      const b = buckets.get(k);
      b.value += Number(log.totalVolume) || 0;
    }
  }

  const timeline = Array.from(buckets.values()).slice(-bucketCount);

  return {
    totalVolume,
    totalSets,
    totalSessions: filtered.length,
    muscleDistribution,
    timeline,
    calendarDates,
  };
}

// ─── Agrégats par exercice ───────────────────────────────────────────────────

// Récupère l'historique d'UN exercice, ordonné par date asc.
// `exerciseRef` peut être l'id OU le name (matching tolérant).
export function getExerciseSessions(logs, exerciseRef) {
  if (!exerciseRef) return [];
  const refId = exerciseRef.id || null;
  const refName = (exerciseRef.name || (typeof exerciseRef === 'string' ? exerciseRef : '')).trim();
  const refNameId = normalizeId(refName);
  const sessions = [];
  for (const log of (Array.isArray(logs) ? logs : [])) {
    if (!Array.isArray(log.exercises)) continue;
    for (const ex of log.exercises) {
      const matchById = refId && ex.id === refId;
      const matchByName = !!refName && (
        ex.name === refName || normalizeId(ex.name || '') === refNameId
      );
      if (matchById || matchByName) {
        sessions.push({
          date: log.date,
          logId: log.id,
          name: ex.name,
          isCompound: !!ex.isCompound,
          sets: Array.isArray(ex.sets) ? ex.sets : [],
          notes: ex.notes || '',
        });
        break;
      }
    }
  }
  // Ordre chronologique (asc) pour tracer
  sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return sessions;
}

// Agrège : courbe poids max par session, PR poids, PR volume, suggestion next.
export function aggregateExercise(logs, exerciseRef) {
  const sessions = getExerciseSessions(logs, exerciseRef);
  let prWeight = 0;
  let prVolume = 0;
  let prEstimate1RM = 0;

  // Points pour le graphique : { date, maxWeight, volume }
  const points = sessions.map((s) => {
    let maxW = 0;
    let volume = 0;
    for (const set of s.sets) {
      if (!set || !set.completed) continue;
      const w = Number(set.weight) || 0;
      const r = Number(set.reps) || 0;
      if (w > maxW) maxW = w;
      if (w && r) volume += w * r;
      // Estimation Epley du 1RM = w × (1 + r/30)
      if (w && r) {
        const est = w * (1 + r / 30);
        if (est > prEstimate1RM) prEstimate1RM = est;
      }
    }
    if (maxW > prWeight) prWeight = maxW;
    if (volume > prVolume) prVolume = volume;
    return { date: s.date, maxWeight: maxW, volume };
  });

  return {
    points,
    prWeight,
    prVolume,
    prEstimate1RM: Math.round(prEstimate1RM * 10) / 10,
    totalSessions: sessions.length,
    suggestedNext: suggestNextWeight(sessions),
    lastSession: sessions.length > 0 ? sessions[sessions.length - 1] : null,
  };
}

// ─── Suggestion de progression ───────────────────────────────────────────────
// Si tous les sets de la dernière session sont terminés avec poids > 0 et reps > 0,
// suggère un palier :
//   - +2.5 kg si l'exo est compound (poly-articulaire)
//   - +1 kg sinon
// Sinon (au moins 1 set raté) → renvoie le même poids (consolidation).
//
export function suggestNextWeight(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const last = sessions[sessions.length - 1]; // ordre asc → dernier = plus récent
  if (!last || !Array.isArray(last.sets) || last.sets.length === 0) return null;
  const maxWeight = last.sets.reduce((m, s) => {
    const w = Number(s && s.weight) || 0;
    return w > m ? w : m;
  }, 0);
  if (!maxWeight) return null;
  const allCompleted = last.sets.every((s) => s && s.completed && Number(s.weight) > 0 && Number(s.reps) > 0);
  if (!allCompleted) {
    // Consolide au même poids.
    return { weight: maxWeight, reason: 'consolidate' };
  }
  const delta = last.isCompound ? 2.5 : 1;
  return { weight: maxWeight + delta, reason: 'progress', delta };
}

// ─── Total cumulé XP ────────────────────────────────────────────────────────

export function totalCumulativeXP(logs) {
  if (!Array.isArray(logs)) return 0;
  return logs.reduce((acc, l) => acc + (Number(l.xpEarned) || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Engagement & Récap (phase Polish)
// ═══════════════════════════════════════════════════════════════════════════

// Ordre de priorité pour la recommandation du muscle à travailler ensuite.
// Cohérent avec la décision produit : Pecto > Dos > Jambes > Épaules > Bras > Abdos.
const PRIORITY_ORDER = ['pectoraux', 'dos', 'jambes', 'epaules', 'bras', 'abdos'];

// ─── Streak (jours consécutifs) ──────────────────────────────────────────────
// Compte les jours consécutifs avec au moins 1 activité valide, en partant d'aujourd'hui.
// Un jour compte si au moins 1 log n'a pas le flag shortSession === true.
// Les rituels (type: 'ritual') comptent comme activité valide.
// Si aucune activité aujourd'hui, le compteur démarre à hier.
export function computeStreak(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return 0;
  const dayGroups = {};
  for (const log of logs) {
    const d = new Date(log.date);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    if (!dayGroups[k]) dayGroups[k] = [];
    dayGroups[k].push(log);
  }
  const days = new Set();
  for (const [k, dayLogs] of Object.entries(dayGroups)) {
    if (dayLogs.some((l) => !l.shortSession)) days.add(k);
  }
  const cur = startOfDay(new Date());
  // Si aucune séance aujourd'hui, on considère que le streak court depuis hier.
  if (!days.has(dayKey(cur))) {
    cur.setDate(cur.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dayKey(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// ─── Recommandation : prochain groupe musculaire ────────────────────────────
// Logique :
//   1. Aucun log → 'pectoraux' (Push par défaut, démarre l'utilisateur sur du connu).
//   2. Sinon : volume cumulé par groupe sur les `days` derniers jours (14 par défaut).
//   3. Choisit le groupe avec le volume MIN, en respectant PRIORITY_ORDER en cas d'égalité.
export function recommendNextMuscleGroup(logs, days = 14) {
  if (!Array.isArray(logs) || logs.length === 0) return 'pectoraux';
  const cutoff = Date.now() - days * 86400000;
  const volumes = {};
  PRIORITY_ORDER.forEach((g) => { volumes[g] = 0; });
  for (const log of logs) {
    const t = new Date(log.date).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    if (!log.muscleDistribution) continue;
    for (const k of Object.keys(log.muscleDistribution)) {
      if (volumes[k] !== undefined) {
        volumes[k] += Number(log.muscleDistribution[k]) || 0;
      }
    }
  }
  // Min, départage par PRIORITY_ORDER (le 1er trouvé l'emporte).
  let pickGroup = PRIORITY_ORDER[0];
  let pickVol = volumes[pickGroup];
  for (const g of PRIORITY_ORDER) {
    if (volumes[g] < pickVol) {
      pickGroup = g;
      pickVol = volumes[g];
    }
  }
  return pickGroup;
}

// ─── Records personnels (top exos majeurs) ──────────────────────────────────
// Retourne la liste des PR pour les exos "phares" (cf. data/majorExercises.js).
// Format : [{ name, group, icon, prWeight, prVolume, prEstimate1RM, totalSessions, hasData }]
// Pure → memoïsable côté composant.
export function getPersonalRecords(logs, majorExercises) {
  const list = Array.isArray(majorExercises) ? majorExercises : [];
  return list.map((exo) => {
    const stats = aggregateExercise(logs, exo);
    return {
      name: exo.name,
      group: exo.group,
      icon: exo.icon || null,
      prWeight: stats.prWeight,
      prVolume: stats.prVolume,
      prEstimate1RM: stats.prEstimate1RM,
      totalSessions: stats.totalSessions,
      hasData: stats.totalSessions > 0,
    };
  });
}

// ─── Heatmap d'activité 12 mois glissants (style GitHub) ────────────────────
// Renvoie une grille 53 colonnes (semaines) × 7 lignes (lundi → dimanche).
// Chaque cellule : { date, volume, intensity (0..4), inRange (bool) }
// L'intensité 0 = pas d'activité ; 1..4 = quartiles du volume non-nul.
export function aggregateActivityHeatmap(logs) {
  const today = startOfDay(new Date());
  // 365 jours en arrière (12 mois glissants)
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 364);

  // Aligner le départ de la grille sur lundi pour avoir des semaines pleines.
  const gridStart = new Date(rangeStart);
  const startDow = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - startDow);

  // Volume par jour
  const volumeByDay = {};
  for (const log of (Array.isArray(logs) ? logs : [])) {
    const d = new Date(log.date);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    volumeByDay[k] = (volumeByDay[k] || 0) + (Number(log.totalVolume) || 0);
  }

  // Quartiles sur les valeurs > 0 pour calibrer l'intensité.
  const positives = Object.values(volumeByDay).filter((v) => v > 0).sort((a, b) => a - b);
  const quantile = (p) => {
    if (positives.length === 0) return 0;
    const idx = Math.min(positives.length - 1, Math.floor(positives.length * p));
    return positives[idx];
  };
  const q1 = quantile(0.25);
  const q2 = quantile(0.5);
  const q3 = quantile(0.75);
  const intensityFor = (vol) => {
    if (!vol || vol <= 0) return 0;
    if (vol <= q1) return 1;
    if (vol <= q2) return 2;
    if (vol <= q3) return 3;
    return 4;
  };

  // Construit les 53 colonnes
  const cols = [];
  let cursor = new Date(gridStart);
  const todayMs = today.getTime();
  const rangeStartMs = rangeStart.getTime();

  for (let c = 0; c < 53; c += 1) {
    const week = [];
    for (let r = 0; r < 7; r += 1) {
      const k = dayKey(cursor);
      const cMs = cursor.getTime();
      const inRange = cMs >= rangeStartMs && cMs <= todayMs;
      const vol = volumeByDay[k] || 0;
      week.push({
        date: k,
        volume: vol,
        intensity: inRange ? intensityFor(vol) : 0,
        inRange,
      });
      cursor = new Date(cMs + 86400000);
    }
    cols.push(week);
  }

  return {
    cols,
    totalDaysWithWorkout: positives.length,
    totalVolume: positives.reduce((a, b) => a + b, 0),
  };
}

// ── God Mode utilities ────────────────────────────────────────────────────────

function makeDebugLog(xpEarned, dayOffset = 0, logName = '[DEBUG:XP]') {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  return {
    id: genId(),
    date: d.toISOString(),
    name: logName,
    exercises: [],
    totalVolume: 0,
    setsCompleted: 0,
    muscleDistribution: {},
    durationSeconds: 900,
    xpEarned,
  };
}

// Injecte `amount` XP bruts, sans anti-cheat.
export async function debugAddXP(amount) {
  const all = await readAll();
  await writeAll([makeDebugLog(Math.max(0, Math.round(amount))), ...all]);
}

// Met le total XP au niveau exact de `targetXP` (injecte le delta manquant).
// Ne fait rien si on est déjà au-dessus.
export async function debugSetXP(targetXP) {
  const all = await readAll();
  const current = all.reduce((s, l) => s + (Number(l.xpEarned) || 0), 0);
  const delta = Math.max(0, Math.round(targetXP) - current);
  if (delta === 0) return;
  await writeAll([makeDebugLog(delta), ...all]);
}

// Injecte suffisamment de sessions + XP pour déverrouiller tous les trophées :
//   - Ignition  : sessions >= 1  → toujours OK si on en ajoute
//   - Promesse  : level  >= 10  → xpForLevel(10) XP minimum
//   - Centurion : sessions >= 50 → 50 logs minimum
export async function debugUnlockAll(currentSessions) {
  const all = await readAll();
  const currentXP = all.reduce((s, l) => s + (Number(l.xpEarned) || 0), 0);
  const xpNeeded = Math.max(0, xpForLevel(10) - currentXP);
  const sessionsNeeded = Math.max(0, 50 - (Number(currentSessions) || 0));

  if (xpNeeded === 0 && sessionsNeeded === 0) return; // tout déjà débloqué

  const newLogs = [];
  // Un log avec l'XP nécessaire (dayOffset 0 = aujourd'hui)
  if (xpNeeded > 0) newLogs.push(makeDebugLog(xpNeeded, 0));
  // Sessions fantômes sur des jours distincts (pas d'XP → pas d'anti-cheat pertinent)
  for (let i = 0; i < sessionsNeeded; i++) {
    newLogs.push(makeDebugLog(0, i + 1));
  }
  await writeAll([...newLogs, ...all]);
}

// Positionne le total XP exactement au niveau `targetLevel`.
// Préserve les vrais logs, supprime les anciens logs DEBUG, injecte le delta.
export async function debugSetLevel(targetLevel) {
  const level = Math.max(0, Math.min(200, Math.round(Number(targetLevel) || 0)));
  const all = await readAll();
  // Retire uniquement les logs XP debug — les logs STREAK et SESSION restent intacts
  const nonXpLogs = all.filter((l) => l.name !== '[DEBUG:XP]' && l.name !== '[DEBUG]');
  const nonXpXP = nonXpLogs.reduce((s, l) => s + (Number(l.xpEarned) || 0), 0);
  const targetXP = xpForLevel(level);
  if (targetXP > nonXpXP) {
    await writeAll([makeDebugLog(targetXP - nonXpXP, 0, '[DEBUG:XP]'), ...nonXpLogs]);
  } else {
    await writeAll(nonXpLogs);
  }
}

// Injecte `count` sessions fictives réparties sur les `count` derniers jours.
export async function debugAddSessions(count = 50) {
  const all = await readAll();
  const newLogs = Array.from({ length: count }, (_, i) => makeDebugLog(150, i + 1, '[DEBUG:SESSION]'));
  await writeAll([...newLogs, ...all]);
}

// Helper : log debug avec exercices et répétitions réels pour les stats.
function makeRepsDebugLog(dayOffset, reps) {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  const setsCount = Math.ceil(reps / 10);
  const vol = 60 * 10 * setsCount;
  return {
    id: genId(),
    date: d.toISOString(),
    name: '[DEBUG:REPS]',
    exercises: [{
      name: 'Simulation',
      isCompound: true,
      targetMuscleGroup: 'pectoraux',
      sets: Array.from({ length: setsCount }, () => ({ weight: 60, reps: 10, completed: true })),
    }],
    totalVolume: vol,
    setsCompleted: setsCount,
    muscleDistribution: { pectoraux: vol },
    durationSeconds: 1800,
    xpEarned: Math.round(setsCount * 2 + (vol * 1.2) / 100),
    notes: '',
  };
}

// Injecte des séances simulant ~totalReps répétitions complétées.
export async function debugSimulateReps(totalReps = 3000) {
  const repsPerSession = 200;
  const numSessions = Math.ceil(totalReps / repsPerSession);
  const all = await readAll();
  const newLogs = Array.from({ length: numSessions }, (_, i) =>
    makeRepsDebugLog(i + 1, repsPerSession)
  );
  await writeAll([...newLogs, ...all]);
}

// Simule une série de `days` jours consécutifs (injecte 1 session par jour).
// Remplace les anciens logs DEBUG de streak.
export async function debugSetStreak(days) {
  const n = Math.max(1, Math.min(365, Math.round(Number(days) || 0)));
  const all = await readAll();
  // Retire uniquement les logs STREAK debug — les logs XP et SESSION restent intacts
  const nonStreakLogs = all.filter((l) => l.name !== '[DEBUG:STREAK]');
  const streakLogs = Array.from({ length: n }, (_, i) => makeDebugLog(0, i, '[DEBUG:STREAK]'));
  await writeAll([...streakLogs, ...nonStreakLogs]);
}

// Décale les séances XP d'aujourd'hui à hier, réinitialisant le quota quotidien (max 2/jour).
export async function debugResetDailyXP() {
  const all = await readAll();
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const updated = all.map((l) => {
    if (l.date && l.date.slice(0, 10) === todayKey && (Number(l.xpEarned) || 0) > 0) {
      return { ...l, date: l.date.replace(todayKey, yesterday) };
    }
    return l;
  });
  await writeAll(updated);
}

// Supprime tous les logs DEBUG (tous les types : XP, STREAK, SESSION, REPS, legacy).
export async function debugClearDebugLogs() {
  const all = await readAll();
  await writeAll(all.filter((l) => !String(l.name || '').startsWith('[DEBUG')));
}

// ─── Détection PRs dans un log fraîchement enregistré ───────────────────────
// Pour chaque exo du nouveau log, compare son maxWeight au PR antérieur (logs ≠ ce log).
// Renvoie [{ name, oldPR, newPR, delta }] uniquement pour les exos battus.
//
// Utilisé par WorkoutRecapModal pour afficher "Nouveau record battu !".
export function findNewPRsInLog(newLog, allLogs) {
  if (!newLog || !Array.isArray(newLog.exercises)) return [];
  const olderLogs = (Array.isArray(allLogs) ? allLogs : []).filter((l) => l.id !== newLog.id);
  const prs = [];
  for (const ex of newLog.exercises) {
    if (!Array.isArray(ex.sets) || ex.sets.length === 0) continue;
    const newMax = ex.sets.reduce((m, s) => {
      if (!s || !s.completed) return m;
      const w = Number(s.weight) || 0;
      return w > m ? w : m;
    }, 0);
    if (newMax <= 0) continue;
    const oldStats = aggregateExercise(olderLogs, ex);
    const oldMax = oldStats.prWeight || 0;
    if (newMax > oldMax) {
      prs.push({
        name: ex.name,
        oldPR: oldMax,
        newPR: newMax,
        delta: Math.round((newMax - oldMax) * 10) / 10,
      });
    }
  }
  return prs;
}
