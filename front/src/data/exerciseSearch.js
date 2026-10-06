// ─── Recherche d'exercices ────────────────────────────────────────────────────
//
// Tout le monde ne connaît pas le nom exact d'un exercice : la recherche
// comprend aussi les muscles (« pecs », « fessiers »), le matériel
// (« haltères », « sans matériel »), les noms anglais courants (« bench »,
// « deadlift », « pull-up ») et tolère les fautes de frappe (« dévelopé »).
// Plusieurs mots se combinent : « pecs haltères » = exercices de pectoraux
// avec haltères. Les résultats sont classés par pertinence.
//
// Fonctions pures, testées dans __tests__/exerciseSearch.test.js.

import { MUSCLE_GROUPS, resolveMuscleGroup } from '../constants/exerciseFilters';

export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Pluriels simples : « pompes » ≈ « pompe », « haltères » ≈ « haltère ».
const stem = (w) => (w.length > 3 ? w.replace(/(es|s|x)$/, '') : w);

const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et', 'pour', 'avec', 'un', 'une',
  'the', 'with', 'exercice', 'exercices', 'exo', 'exos', 'muscle', 'muscles',
]);

// ── Vocabulaire ──
// Muscles (groupes) : la recherche « pecs » trouve tous les exercices de pectoraux.
const GROUP_WORDS = {
  pectoraux: ['pec', 'pecs', 'pectoraux', 'pectoral', 'chest', 'poitrine', 'torse'],
  dos: ['dos', 'back', 'dorsaux', 'dorsal', 'lat', 'lats'],
  epaules: ['epaule', 'epaules', 'shoulder', 'shoulders', 'delt', 'delts', 'deltoide', 'deltoides'],
  bras: ['bras', 'arm', 'arms'],
  jambes: ['jambe', 'jambes', 'leg', 'legs', 'cuisse', 'cuisses'],
  abdos: ['abdo', 'abdos', 'abs', 'abdominaux', 'core', 'ventre', 'sangle'],
};

// Sous-muscles (labels du catalogue).
const SUB_WORDS = {
  Biceps: ['biceps', 'bicep', 'bis'],
  Triceps: ['triceps', 'tricep', 'tris'],
  'Avant-bras': ['avantbras', 'forearm', 'forearms', 'poignet', 'poignets', 'grip'],
  Quadriceps: ['quadriceps', 'quadri', 'quadris', 'quad', 'quads'],
  Ischios: ['ischio', 'ischios', 'ischiojambiers', 'hamstring', 'hamstrings'],
  Fessiers: ['fessier', 'fessiers', 'fesse', 'fesses', 'glute', 'glutes', 'booty'],
  Mollets: ['mollet', 'mollets', 'calf', 'calves'],
  Adducteurs: ['adducteur', 'adducteurs', 'adductor', 'adductors'],
  Trapèzes: ['trapeze', 'trapezes', 'trap', 'traps'],
  Lombaires: ['lombaire', 'lombaires', 'basdudos'],
  Obliques: ['oblique', 'obliques'],
  'Grand dorsal': ['grand dorsal'],
};

const EQUIP_WORDS = {
  Haltères: ['haltere', 'halteres', 'dumbbell', 'dumbbells', 'db'],
  Barre: ['barre', 'barres', 'barbell', 'bb'],
  Câble: ['cable', 'cables', 'poulie', 'poulies'],
  Machine: ['machine', 'machines', 'guidee'],
  'Poids du corps': ['pdc', 'bodyweight', 'calisthenics', 'callisthenie', 'street', 'sansmateriel', 'maison', 'home'],
};

// Noms courants (souvent anglais) → morceaux de noms du catalogue.
const TERM_WORDS = {
  bench: ['developpe couche'],
  benchpress: ['developpe couche'],
  developpe: ['developpe', 'press'],
  press: ['developpe', 'press'],
  deadlift: ['souleve de terre', 'deadlift'],
  sdt: ['souleve de terre'],
  pushup: ['pompes', 'push up'],
  pompe: ['pompes', 'push up'],
  pullup: ['tractions', 'chin'],
  traction: ['tractions', 'chin'],
  chinup: ['chin up', 'tractions'],
  row: ['rowing', 'row'],
  rowing: ['rowing', 'row'],
  fly: ['ecarte', 'fly', 'crossover', 'pec deck'],
  ecarte: ['ecarte', 'fly', 'crossover', 'pec deck'],
  lunge: ['fentes', 'lunge', 'split squat'],
  fente: ['fentes', 'lunge', 'split squat'],
  raise: ['elevations', 'raise'],
  elevation: ['elevations', 'raise'],
  plank: ['gainage', 'plank'],
  planche: ['gainage', 'plank'],
  gainage: ['gainage', 'plank', 'hollow', 'dead bug'],
  pulldown: ['tirage', 'pull down'],
  tirage: ['tirage', 'pull down'],
  ohp: ['developpe militaire', 'overhead press'],
  militaire: ['developpe militaire', 'overhead press'],
  presse: ['presse', 'leg press'],
  legpress: ['presse', 'leg press'],
  skullcrusher: ['skull crusher'],
  kickback: ['kickback'],
  shrug: ['shrug'],
  thrust: ['hip thrust', 'glute bridge'],
};

// Expressions de plusieurs mots, repérées avant le découpage en mots.
const PHRASES = [
  ['poids du corps', 'pdc'],
  ['sans materiel', 'sansmateriel'],
  ['bas du dos', 'basdudos'],
  ['avant bras', 'avantbras'],
  ['bench press', 'benchpress'],
  ['push up', 'pushup'],
  ['pull up', 'pullup'],
  ['chin up', 'chinup'],
  ['pull down', 'pulldown'],
  ['leg press', 'legpress'],
  ['skull crusher', 'skullcrusher'],
  ['grand dorsal', 'granddorsal'],
];

function invert(map) {
  const out = new Map();
  for (const [key, words] of Object.entries(map)) {
    for (const w of words) {
      const k = stem(normalizeText(w).replace(/ /g, ''));
      if (!out.has(k)) out.set(k, []);
      out.get(k).push(key);
    }
  }
  return out;
}
const GROUP_INDEX = invert(GROUP_WORDS);
const SUB_INDEX = invert({ ...SUB_WORDS, 'Grand dorsal': ['granddorsal'] });
const EQUIP_INDEX = invert(EQUIP_WORDS);
const TERM_INDEX = new Map(Object.entries(TERM_WORDS).map(([k, v]) => [stem(k), v]));

// Distance de Levenshtein (bornée) pour tolérer les fautes de frappe.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function tokenize(query) {
  let q = ` ${normalizeText(query)} `;
  for (const [phrase, token] of PHRASES) q = q.split(` ${phrase} `).join(` ${token} `);
  return q.split(' ').filter((t) => t && !STOPWORDS.has(t));
}

// Prépare un exercice pour la recherche (une fois par catalogue).
export function indexExercise(ex) {
  const nameNorm = normalizeText(ex.name);
  const subs = [ex.targetMuscle, ...(Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [])].filter(Boolean);
  const group = ex.targetMuscleGroup || resolveMuscleGroup(ex.targetMuscle) || null;
  const equipment = Array.isArray(ex.equipment) ? ex.equipment : [ex.equipment].filter(Boolean);
  return {
    ex,
    nameNorm,
    nameWords: nameNorm.split(' ').map(stem),
    group,
    secondaryGroups: subs.slice(1).map((s) => resolveMuscleGroup(s)).filter(Boolean),
    subs,
    subsNorm: subs.map(normalizeText),
    equipment,
    otherWords: [...subs, ...equipment, MUSCLE_GROUPS.find((g) => g.id === group)?.label || '']
      .flatMap((s) => normalizeText(s).split(' ')).filter(Boolean).map(stem),
  };
}

// Score d'un mot de la requête pour un exercice (0 = ne correspond pas).
function tokenScore(token, it) {
  const t = stem(token);
  let score = 0;

  // Nom de l'exercice
  if (it.nameWords.includes(t)) score = Math.max(score, 10);
  else if (t.length >= 2 && it.nameWords.some((w) => w.startsWith(t))) score = Math.max(score, 8);
  else if (t.length >= 3 && it.nameNorm.replace(/ /g, '').includes(t)) score = Math.max(score, 6);

  // Muscles, matériel
  if ((GROUP_INDEX.get(t) || []).some((g) => g === it.group)) score = Math.max(score, 7);
  else if ((GROUP_INDEX.get(t) || []).some((g) => it.secondaryGroups.includes(g))) score = Math.max(score, 3);
  if ((SUB_INDEX.get(t) || []).some((s) => it.subs[0] === s)) score = Math.max(score, 7);
  else if ((SUB_INDEX.get(t) || []).some((s) => it.subs.includes(s))) score = Math.max(score, 4);
  if ((EQUIP_INDEX.get(t) || []).some((e) => it.equipment.includes(e))) score = Math.max(score, 6);
  if (t.length >= 3 && it.otherWords.some((w) => w.startsWith(t))) score = Math.max(score, 4);

  // Noms courants / anglais (« deadlift » → Soulevé de terre en tête)
  for (const term of TERM_INDEX.get(t) || []) {
    if (it.nameNorm.startsWith(term)) score = Math.max(score, 12);
    else if (it.nameNorm.includes(term)) score = Math.max(score, 9);
  }

  // Mot de muscle (« pecs ») : un exercice d'un autre muscle qui contient
  // juste le mot dans son nom (« Reverse pec deck », épaules) passe derrière.
  const groups = GROUP_INDEX.get(t) || [];
  const subs = SUB_INDEX.get(t) || [];
  if ((groups.length || subs.length) && !groups.includes(it.group) && !subs.includes(it.subs[0])) {
    score = Math.min(score, 3);
  }

  // Fautes de frappe (dernier recours)
  if (score === 0 && t.length >= 4) {
    const max = t.length >= 7 ? 2 : 1;
    const words = [...it.nameWords, ...it.otherWords];
    if (words.some((w) => w.length >= 3 && editDistance(t, w.slice(0, t.length + max), max) <= max)) score = 2;
  }
  return score;
}

// Recherche classée. `index` = catalog.map(indexExercise).
export function searchExercises(index, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return index.map((it) => it.ex);
  const qNorm = normalizeText(query);
  const scored = [];
  for (const it of index) {
    let total = 0;
    let ok = true;
    for (const tk of tokens) {
      const s = tokenScore(tk, it);
      if (s === 0) { ok = false; break; }
      total += s;
    }
    if (!ok) continue;
    if (it.nameNorm === qNorm) total += 30;
    else if (it.nameNorm.startsWith(qNorm)) total += 12;
    if (STAPLE_SET.has(it.nameNorm)) total += 3;
    scored.push({ ex: it.ex, total, len: it.nameNorm.length });
  }
  scored.sort((a, b) => b.total - a.total || a.len - b.len || a.ex.name.localeCompare(b.ex.name, 'fr'));
  return scored.map((s) => s.ex);
}

// Exercices proches d'un nom saisi librement (création d'un exercice perso) :
// contrairement à la recherche, tous les mots n'ont pas à correspondre
// (« Curl incliné prise neutre » → Curl incliné). Il faut au moins un mot
// qui colle au nom de l'exercice, pas seulement au muscle.
export function findSimilarExercises(index, name, limit = 3) {
  const tokens = tokenize(name);
  if (tokens.length === 0) return [];
  const qNorm = normalizeText(name);
  const scored = [];
  for (const it of index) {
    let total = 0;
    let matched = 0;
    let strong = false;
    for (const tk of tokens) {
      const s = tokenScore(tk, it);
      if (s > 0) { total += s; matched += 1; }
      if (s >= 8) strong = true;
    }
    if (!strong) continue;
    const exact = it.nameNorm === qNorm;
    scored.push({ ex: it.ex, exact, matched, total: total + (exact ? 30 : 0), len: it.nameNorm.length });
  }
  scored.sort((a, b) => Number(b.exact) - Number(a.exact) || b.matched - a.matched
    || b.total - a.total || a.len - b.len);
  return scored.slice(0, limit).map(({ ex, exact }) => ({ ex, exact }));
}

// Filtres explicites (puces) : groupe musculaire et matériel.
export function filterIndex(index, { group = null, equipment = null } = {}) {
  return index.filter((it) => (!group || it.group === group) && (!equipment || it.equipment.includes(equipment)));
}

// Exercices « incontournables » proposés quand on ne sait pas quoi chercher.
export const STAPLES = [
  'Développé couché', 'Pompes', 'Squat', 'Soulevé de terre', 'Tractions', 'Rowing haltère',
  'Développé militaire', 'Élévations latérales', 'Hip thrust', 'Fentes marchées', 'Leg Press',
  'Curl haltères', 'Dips', 'Gainage',
];
const STAPLE_SET = new Set(STAPLES.map(normalizeText));
