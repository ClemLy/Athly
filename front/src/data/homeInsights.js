// Petits calculs de la page d'accueil (purs, testés) : semaine en cours,
// raison de la séance recommandée, salutation.

const GROUP_SUBJECT = {
  pectoraux: { label: 'Tes pectoraux', plural: true },
  dos:       { label: 'Ton dos', plural: false },
  epaules:   { label: 'Tes épaules', plural: true },
  bras:      { label: 'Tes bras', plural: true },
  jambes:    { label: 'Tes jambes', plural: true },
  abdos:     { label: 'Tes abdos', plural: true },
};

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Clé AAAA-MM-JJ en heure locale (une séance à 23 h reste sur le bon jour).
export function localDayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Les 7 jours de la semaine en cours (lundi → dimanche) et ceux où il y a eu
// au moins une séance.
export function weekDays(logs, now = new Date()) {
  const trained = new Set((Array.isArray(logs) ? logs : []).map((l) => localDayKey(l.date)).filter(Boolean));
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayKey = localDayKey(now);
  return DAY_LETTERS.map((letter, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = localDayKey(d);
    return {
      key,
      letter,
      name: DAY_NAMES[i],
      isToday: key === todayKey,
      isFuture: key > todayKey,
      trained: trained.has(key),
    };
  });
}

// Séances et volume de la semaine affichée par weekDays().
export function weekTotals(logs, days) {
  const keys = new Set((days || []).map((d) => d.key));
  let sessions = 0;
  let volume = 0;
  for (const l of Array.isArray(logs) ? logs : []) {
    if (!keys.has(localDayKey(l.date))) continue;
    sessions += 1;
    volume += Number(l.totalVolume) || 0;
  }
  return { sessions, volume };
}

// Nombre de jours depuis la dernière séance qui a travaillé ce groupe.
export function daysSinceGroup(logs, groupId, now = new Date()) {
  let last = null;
  for (const l of Array.isArray(logs) ? logs : []) {
    const dist = l.muscleDistribution || {};
    if (!(Number(dist[groupId]) > 0)) continue;
    const t = new Date(l.date).getTime();
    if (!Number.isNaN(t) && (last === null || t > last)) last = t;
  }
  if (last === null) return null;
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  return Math.round((startOf(now.getTime()) - startOf(last)) / 86400000);
}

// Pourquoi on propose cette séance, en une phrase concrète.
export function recommendationReason(logs, groupId, now = new Date()) {
  const subject = GROUP_SUBJECT[groupId];
  if (!Array.isArray(logs) || logs.length === 0 || !subject) {
    return 'Une séance complète et accessible pour bien lancer ton programme.';
  }
  const verb = subject.plural ? "n'ont" : "n'a";
  const done = subject.plural ? 'travaillés' : 'travaillé';
  const days = daysSinceGroup(logs, groupId, now);
  if (days === null) return `${subject.label} ${verb} pas encore été ${done}. On ${subject.plural ? 'les' : 'le'} met au programme.`;
  if (days <= 1) return `${subject.label} : le groupe le moins travaillé ces deux dernières semaines.`;
  return `${subject.label} ${verb} pas été ${done} depuis ${days} jours. On rééquilibre.`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h >= 18 || h < 5) return 'Bonsoir';
  return 'Bonjour';
}

// « Mardi 6 octobre »
export function todayLabel(now = new Date()) {
  const s = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
