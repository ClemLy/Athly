import { BUILTIN_CATALOG, isCalisthenics } from './exerciseCatalog';
import { CALI_FAMILIES } from './calisthenics';
import { getExerciseSessions } from '../services/stats.service';
import { normalizeId } from '../constants/exerciseFilters';

// ─── Progression dans les échelles de calisthénie ─────────────────────────────
// Règle de montée de niveau : le haut de la fourchette (ex : 12 répétitions,
// ou 45 secondes de tenue) sur TOUTES les séries, deux séances de suite, et au
// moins 2 séries. On passe alors au niveau suivant de la famille, en repartant
// du bas de la fourchette.

const LADDERS = (() => {
  const map = {};
  BUILTIN_CATALOG.filter((e) => isCalisthenics(e) && e.family).forEach((e) => {
    (map[e.family] = map[e.family] || []).push(e);
  });
  Object.values(map).forEach((list) => list.sort((a, b) => a.rung - b.rung));
  return map;
})();

/** Échelle complète d'une famille, du plus facile au plus dur. */
export function ladderOf(familyId) {
  return LADDERS[familyId] || [];
}

const entryByName = (name) => BUILTIN_CATALOG.find((e) => normalizeId(e.name) === normalizeId(name || '')) || null;

/** Niveau suivant (ou précédent) dans l'échelle de l'exercice. */
export function neighbourRung(exercise, step = 1) {
  const entry = exercise?.family ? exercise : entryByName(exercise?.name);
  if (!entry?.family) return null;
  const ladder = ladderOf(entry.family);
  const i = ladder.findIndex((e) => e.id === entry.id);
  return i >= 0 ? ladder[i + step] || null : null;
}

// Une séance « réussie » : au moins 2 séries de travail, toutes au plafond.
function sessionAtTop(session, entry) {
  const top = entry.target?.[1];
  if (!top) return false;
  const work = (session.sets || []).filter((s) => s && s.completed && !s.warmup);
  if (work.length < 2) return false;
  const value = (s) => (entry.tracking === 'time' ? Number(s.seconds) || 0 : Number(s.reps) || 0);
  return work.every((s) => value(s) >= top);
}

/**
 * Prêt pour le niveau suivant ?
 * @returns {{ next: object, streak: number } | null}
 */
export function progressionFor(logs, exercise) {
  const entry = exercise?.family ? exercise : entryByName(exercise?.name);
  if (!entry?.family || !entry.target) return null;
  const next = neighbourRung(entry, 1);
  if (!next) return null;
  const sessions = getExerciseSessions(logs, { name: entry.name });
  const lastTwo = sessions.slice(-2);
  if (lastTwo.length < 2 || !lastTwo.every((s) => sessionAtTop(s, entry))) return null;
  return { next, streak: 2 };
}

/**
 * Où en est-on dans chaque famille : le plus haut niveau pratiqué (séance
 * avec au moins une série faite), et si le niveau suivant est débloqué.
 */
export function familyStatus(logs) {
  return CALI_FAMILIES.map((family) => {
    const ladder = ladderOf(family.id);
    let current = null;
    let lastDate = null;
    for (const entry of ladder) {
      const sessions = getExerciseSessions(logs, { name: entry.name })
        .filter((s) => (s.sets || []).some((st) => st && st.completed && !st.warmup));
      if (sessions.length) {
        current = entry;
        lastDate = sessions[sessions.length - 1].date;
      }
    }
    const ready = current ? progressionFor(logs, current) : null;
    return { family, ladder, current, lastDate, next: ready?.next || null };
  });
}
