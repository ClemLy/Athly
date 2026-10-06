// ─── Statistiques par période (écran Stats) ───────────────────────────────────
//
// Fenêtres glissantes qui se terminent aujourd'hui. Les barres découpent
// exactement la fenêtre : la somme des barres est égale aux chiffres clés
// affichés au-dessus. La période précédente a la même durée, ce qui permet
// une comparaison honnête (« vs 4 semaines précédentes »).
//
// Fonctions pures (date courante injectable) : testées dans __tests__.

import { MUSCLE_GROUPS } from '../constants/exerciseFilters';

export const PERIODS = [
  { id: '7d',  label: '7 jours',    bucket: 'day',   count: 7,  previousLabel: 'par rapport aux 7 jours précédents',    chartLabel: 'Par jour' },
  { id: '4w',  label: '4 semaines', bucket: 'week',  count: 4,  previousLabel: 'par rapport aux 4 semaines précédentes', chartLabel: 'Par semaine' },
  { id: '12m', label: '12 mois',    bucket: 'month', count: 12, previousLabel: 'par rapport aux 12 mois précédents',     chartLabel: 'Par mois' },
];

export const DEFAULT_PERIOD = '4w';

const DAY_MS = 86400000;
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// Les groupes « principaux » attendus dans un programme équilibré.
const CORE_GROUPS = ['pectoraux', 'dos', 'epaules', 'bras', 'jambes', 'abdos'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// « 8 sept. » / « 8 sept. 2025 » si l'année diffère de `ref`.
export function shortDate(d, ref = null) {
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return ref && ref.getFullYear() !== d.getFullYear() ? `${base} ${d.getFullYear()}` : base;
}

// « Du 8 au 14 sept. » / « Du 29 sept. au 5 oct. »
function rangeLabel(start, lastDay) {
  if (start.getMonth() === lastDay.getMonth() && start.getFullYear() === lastDay.getFullYear()) {
    return `Du ${start.getDate()} au ${shortDate(lastDay)}`;
  }
  return `Du ${shortDate(start)} au ${shortDate(lastDay)}`;
}

export function getPeriod(id) {
  return PERIODS.find((p) => p.id === id) || PERIODS.find((p) => p.id === DEFAULT_PERIOD);
}

// Découpe de la fenêtre en barres : [{ key, start, end, label, fullLabel }]
function buildBuckets(period, now) {
  const today = startOfDay(now);
  const out = [];
  if (period.bucket === 'day') {
    for (let i = period.count - 1; i >= 0; i -= 1) {
      const start = addDays(today, -i);
      out.push({
        key: dayKey(start),
        start,
        end: addDays(start, 1),
        label: i === 0 ? 'auj.' : WEEKDAYS_SHORT[start.getDay()],
        fullLabel: i === 0 ? "Aujourd'hui" : `${WEEKDAYS_LONG[start.getDay()]} ${shortDate(start)}`,
      });
    }
  } else if (period.bucket === 'week') {
    const first = addDays(today, -(7 * period.count - 1));
    for (let i = 0; i < period.count; i += 1) {
      const start = addDays(first, 7 * i);
      const end = addDays(start, 7);
      out.push({
        key: dayKey(start),
        start,
        end,
        label: shortDate(start),
        fullLabel: rangeLabel(start, addDays(end, -1)),
      });
    }
  } else {
    for (let i = period.count - 1; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      out.push({
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        start,
        end,
        label: MONTHS_SHORT[start.getMonth()],
        fullLabel: `${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`,
      });
    }
  }
  // La dernière barre se termine en fin de journée (fenêtre « jusqu'à aujourd'hui »).
  out[out.length - 1].end = addDays(today, 1);
  return out;
}

function emptyTotals() {
  return { sessions: 0, volume: 0, sets: 0, durationSeconds: 0 };
}

function addLog(t, log) {
  t.sessions += 1;
  t.volume += Number(log.totalVolume) || 0;
  t.sets += Number(log.setsCompleted) || 0;
  t.durationSeconds += Number(log.durationSeconds) || 0;
}

function timeOf(log) {
  const t = new Date(log && log.date).getTime();
  return Number.isNaN(t) ? null : t;
}

// Statistiques d'une période pour l'écran Stats.
//
// Returns {
//   period, rangeLabel,
//   totals:   { sessions, volume, sets, durationSeconds },
//   previous: idem sur la période précédente de même durée,
//   buckets:  [{ key, label, fullLabel, volume, sessions }],
//   muscles:  [{ id, label, volume, share }] trié du plus au moins travaillé,
//   neglected:[label] groupes principaux quasi absents (< 5 % du volume),
// }
export function computePeriodStats(logs, periodId, now = new Date()) {
  const period = getPeriod(periodId);
  const buckets = buildBuckets(period, now).map((b) => ({ ...b, volume: 0, sessions: 0 }));
  const windowStart = buckets[0].start.getTime();
  const windowEnd = buckets[buckets.length - 1].end.getTime();

  // Période précédente : même durée, juste avant (mois calendaires pour 12 mois).
  const prevStart = period.bucket === 'month'
    ? new Date(buckets[0].start.getFullYear(), buckets[0].start.getMonth() - period.count, 1).getTime()
    : windowStart - (windowEnd - windowStart);

  const totals = emptyTotals();
  const previous = emptyTotals();
  const muscleVolume = {};

  for (const log of Array.isArray(logs) ? logs : []) {
    const t = timeOf(log);
    if (t === null) continue;
    if (t >= prevStart && t < windowStart) { addLog(previous, log); continue; }
    if (t < windowStart || t >= windowEnd) continue;

    addLog(totals, log);
    const b = buckets.find((x) => t >= x.start.getTime() && t < x.end.getTime());
    if (b) {
      b.volume += Number(log.totalVolume) || 0;
      b.sessions += 1;
    }
    const dist = log.muscleDistribution || {};
    for (const k of Object.keys(dist)) {
      muscleVolume[k] = (muscleVolume[k] || 0) + (Number(dist[k]) || 0);
    }
  }

  const muscleTotal = Object.values(muscleVolume).reduce((n, v) => n + v, 0);
  const muscles = Object.entries(muscleVolume)
    .filter(([, v]) => v > 0)
    .map(([id, volume]) => {
      const group = MUSCLE_GROUPS.find((g) => g.id === id);
      return { id, label: group ? group.label : 'Autre', volume, share: muscleTotal ? volume / muscleTotal : 0 };
    })
    .sort((a, b) => b.volume - a.volume);

  // Conseil d'équilibre seulement s'il y a assez de séances pour qu'il ait du sens.
  const neglected = totals.sessions >= 3 && muscleTotal > 0
    ? CORE_GROUPS
      .filter((id) => (muscleVolume[id] || 0) / muscleTotal < 0.05)
      .map((id) => MUSCLE_GROUPS.find((g) => g.id === id)?.label || id)
    : [];

  return {
    period,
    rangeLabel: rangeLabel(buckets[0].start, startOfDay(now)),
    totals,
    previous,
    buckets: buckets.map(({ key, label, fullLabel, volume, sessions }) => ({ key, label, fullLabel, volume, sessions })),
    muscles,
    neglected,
  };
}

// ─── Calendrier ───────────────────────────────────────────────────────────────

// { 'YYYY-MM-DD': [log, …] } sur TOUT l'historique (le calendrier se feuillette).
export function indexLogsByDay(logs) {
  const out = {};
  for (const log of Array.isArray(logs) ? logs : []) {
    if (timeOf(log) === null) continue;
    const k = dayKey(new Date(log.date));
    (out[k] = out[k] || []).push(log);
  }
  return out;
}

// Résumé d'un mois calendaire (month : 0-11).
export function monthSummary(logs, year, month) {
  const t = emptyTotals();
  for (const log of Array.isArray(logs) ? logs : []) {
    const time = timeOf(log);
    if (time === null) continue;
    const d = new Date(time);
    if (d.getFullYear() === year && d.getMonth() === month) addLog(t, log);
  }
  return t;
}

// « lundi 6 octobre »
export function longDay(dateKeyStr) {
  const [y, m, d] = String(dateKeyStr).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS_LONG[dt.getDay()]} ${d} ${MONTHS_LONG[m - 1]}`;
}

export { MONTHS_LONG };
