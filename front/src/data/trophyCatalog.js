// ─── Utility functions used by trophy checks ─────────────────────────────────

export function hasNConsecutiveDays(logs, n) {
  const dates = [...new Set(logs.map(l => l.date?.slice(0, 10)).filter(Boolean))].sort();
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) { cur++; if (cur >= n) return true; }
    else cur = 1;
  }
  return false;
}

export function maxStreak(logs) {
  const dates = [...new Set(logs.map(l => l.date?.slice(0, 10)).filter(Boolean))].sort();
  let best = 0, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
  }
  return dates.length > 0 ? Math.max(best, 1) : 0;
}

export function daysSpanned(logs) {
  if (logs.length === 0) return 0;
  const times = logs.map(l => new Date(l.date)).filter(d => !isNaN(d.getTime())).map(d => d.getTime());
  if (times.length === 0) return 0;
  return (Math.max(...times) - Math.min(...times)) / 86400000;
}

export function weeklyConsecutive(logs, weeks) {
  if (logs.length === 0) return false;
  const weekSet = new Set(
    logs.map(l => {
      const d = new Date(l.date);
      if (isNaN(d.getTime())) return null;
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      return `${d.getFullYear()}-W${Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)}`;
    }).filter(Boolean)
  );
  const sorted = [...weekSet].sort();
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [y1, w1] = sorted[i - 1].split('-W').map(Number);
    const [y2, w2] = sorted[i].split('-W').map(Number);
    const isNext = (y2 === y1 && w2 === w1 + 1) || (y2 === y1 + 1 && w1 >= 52 && w2 === 1);
    if (isNext) { run++; if (run >= weeks) return true; } else run = 1;
  }
  return false;
}

// ─── Trophy catalog (40 trophées) ────────────────────────────────────────────

export const TROPHY_CATALOG = [
  // ─── HÉRITAGE (6) ──────────────────────────────────────────────────────────
  { id: 'ignition',   category: 'heritage', icon: 'flame',            label: 'Ignition',          condition: '1ère séance',
    epicDesc: "Ta toute première séance. Le plus dur est fait : tu as commencé.",
    color: '#FE7439', gradientColors: ['#FF9A5C','#FE7439','#C44A10'], tier: 'bronze',
    check: (l, s) => s >= 1 },
  { id: 'promise',    category: 'heritage', icon: 'medal',            label: 'Promesse',           condition: 'Niveau 10',
    epicDesc: "Niveau 10. Tu n'es plus en train d'essayer, tu es en train de construire.",
    color: '#FFD700', gradientColors: ['#FFE566','#FFD700','#B8860B'], tier: 'gold',
    check: (l) => l >= 10 },
  { id: 'apprenti',   category: 'heritage', icon: 'school',           label: 'Apprenti',           condition: 'Niveau 25',
    epicDesc: "Niveau 25. Les bases sont solides, les mouvements deviennent naturels.",
    color: '#34D399', gradientColors: ['#6EE7B7','#34D399','#059669'], tier: 'silver',
    check: (l) => l >= 25 },
  { id: 'centurion',  category: 'heritage', icon: 'trophy',           label: 'Centurion',          condition: '50 séances',
    epicDesc: "Cinquante séances. À ce stade, ce n'est plus de la motivation, c'est une habitude.",
    color: '#6E6AF0', gradientColors: ['#9B97FF','#6E6AF0','#3D3A9E'], tier: 'platinum',
    check: (l, s) => s >= 50 },
  { id: 'veteran',    category: 'heritage', icon: 'shield-checkmark', label: 'Vétéran',            condition: 'Niveau 75',
    epicDesc: "Niveau 75. Des centaines de séries derrière toi, et toujours là.",
    color: '#3B82F6', gradientColors: ['#60A5FA','#3B82F6','#1D4ED8'], tier: 'gold',
    check: (l) => l >= 75 },
  { id: 'demi_dieu',  category: 'heritage', icon: 'sparkles',         label: 'Demi-Dieu',          condition: 'Niveau 150',
    epicDesc: "Niveau 150. Très peu de monde a fait autant de chemin.",
    color: '#8B5CF6', gradientColors: ['#A78BFA','#8B5CF6','#5B21B6'], tier: 'diamond',
    check: (l) => l >= 150 },

  // ─── FORCE (7) ─────────────────────────────────────────────────────────────
  { id: 'titan',      category: 'force', icon: 'barbell',  label: 'Le Titan',        condition: '10 000 kg soulevés',
    epicDesc: "Dix mille kilos soulevés au total. Ça commence à peser.",
    color: '#DC2626', gradientColors: ['#EF4444','#DC2626','#991B1B'], tier: 'gold',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.totalVolume) || 0), 0) >= 10000 },
  { id: 'iron_will',  category: 'force', icon: 'shield',   label: 'Iron Will',       condition: '3 jours consécutifs',
    epicDesc: "Trois jours d'affilée. Même quand l'envie manquait, tu y es allé.",
    color: '#B45309', gradientColors: ['#D97706','#B45309','#78350F'], tier: 'silver',
    check: (l, s, logs) => hasNConsecutiveDays(logs, 3) },
  { id: 'machine',    category: 'force', icon: 'flash',    label: 'La Machine',      condition: '25 sets en une séance',
    epicDesc: "Vingt-cinq séries dans une seule séance. Grosse journée.",
    color: '#F59E0B', gradientColors: ['#FDE68A','#F59E0B','#B45309'], tier: 'silver',
    check: (l, s, logs) => logs.some(log => (Number(log.setsCompleted) || 0) >= 25) },
  { id: 'legionnaire', category: 'force', icon: 'star',   label: 'Légionnaire',     condition: '100 séances',
    epicDesc: "Cent séances. Cent fois où tu as choisi de venir.",
    color: '#EAB308', gradientColors: ['#FDE047','#EAB308','#854D0E'], tier: 'platinum',
    check: (l, s) => s >= 100 },
  { id: 'colossus',   category: 'force', icon: 'body',     label: 'Colosse',         condition: '50 000 kg soulevés',
    epicDesc: "Cinquante mille kilos soulevés. L'équivalent d'un camion, morceau par morceau.",
    color: '#991B1B', gradientColors: ['#DC2626','#991B1B','#450A0A'], tier: 'diamond',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.totalVolume) || 0), 0) >= 50000 },
  { id: 'forge',      category: 'force', icon: 'hammer',   label: 'La Forge',        condition: '500 sets au total',
    epicDesc: "Cinq cents séries au compteur. C'est là que la force se construit.",
    color: '#C2410C', gradientColors: ['#EA580C','#C2410C','#7C2D12'], tier: 'silver',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.setsCompleted) || 0), 0) >= 500 },
  { id: 'volume_king', category: 'force', icon: 'analytics', label: 'Roi du Volume', condition: '100 000 kg soulevés',
    epicDesc: "Cent mille kilos soulevés. Personne ne t'arrête.",
    color: '#7C3AED', gradientColors: ['#8B5CF6','#7C3AED','#4C1D95'], tier: 'diamond',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.totalVolume) || 0), 0) >= 100000 },

  // ─── EXPLORATION (6) ───────────────────────────────────────────────────────
  { id: 'polyvalent',    category: 'exploration', icon: 'grid',         label: 'Polyvalent',      condition: '5 groupes musculaires',
    epicDesc: "Pecs, dos, jambes, épaules, bras : tu n'oublies aucun groupe musculaire.",
    color: '#22C55E', gradientColors: ['#4ADE80','#22C55E','#15803D'], tier: 'silver',
    check: (l, s, logs) => new Set(logs.flatMap(log => Object.keys(log.muscleDistribution || {}))).size >= 5 },
  { id: 'marathonien',   category: 'exploration', icon: 'time',         label: 'Marathonien',     condition: 'Séance ≥ 60 min',
    epicDesc: "Une heure entière à t'entraîner, sans lâcher.",
    color: '#0EA5E9', gradientColors: ['#38BDF8','#0EA5E9','#0369A1'], tier: 'bronze',
    check: (l, s, logs) => logs.some(log => (Number(log.durationSeconds) || 0) >= 3600) },
  { id: 'demi_legende',  category: 'exploration', icon: 'rocket',       label: 'Demi-Légende',    condition: 'Niveau 50',
    epicDesc: "Niveau 50. La moitié du chemin vers le sommet, et peu de gens arrivent jusqu'ici.",
    color: '#3B82F6', gradientColors: ['#60A5FA','#3B82F6','#1D4ED8'], tier: 'gold',
    check: (l) => l >= 50 },
  { id: 'xp_millionaire', category: 'exploration', icon: 'infinite',    label: 'XP Millionnaire', condition: '1 000 000 XP cumulés',
    epicDesc: "Un million de points d'expérience. Des années de régularité en un chiffre.",
    color: '#A855F7', gradientColors: ['#C084FC','#A855F7','#7E22CE'], tier: 'diamond',
    check: (l, s, logs, xp) => xp >= 1000000 },
  { id: 'speed_demon',   category: 'exploration', icon: 'speedometer',  label: 'Speed Demon',     condition: 'Séance complète ≤ 20 min',
    epicDesc: "Une séance complète en vingt minutes. Efficace, sans temps mort.",
    color: '#F97316', gradientColors: ['#FB923C','#F97316','#C2410C'], tier: 'bronze',
    check: (l, s, logs) => logs.some(log => {
      const dur = Number(log.durationSeconds) || 0;
      const sets = Number(log.setsCompleted) || 0;
      return dur > 0 && dur <= 1200 && sets >= 3;
    }) },
  { id: 'ultra_marathon', category: 'exploration', icon: 'hourglass',   label: 'Ultra-Marathon',  condition: 'Séance ≥ 90 min',
    epicDesc: "Quatre-vingt-dix minutes d'effort. Une séance que tu n'oublieras pas.",
    color: '#0891B2', gradientColors: ['#22D3EE','#0891B2','#164E63'], tier: 'silver',
    check: (l, s, logs) => logs.some(log => (Number(log.durationSeconds) || 0) >= 5400) },

  // ─── SECRET (8) ────────────────────────────────────────────────────────────
  { id: 'night_owl',    category: 'secret', icon: 'moon',          label: 'Oiseau de Nuit',     condition: 'Séance entre 23h et 4h',
    epicDesc: "Une séance entre 23 h et 4 h. Pendant que tout le monde dort.",
    color: '#6366F1', gradientColors: ['#818CF8','#6366F1','#3730A3'], tier: 'silver',
    check: (l, s, logs) => logs.some(log => { if (!log.date) return false; const h = new Date(log.date).getHours(); return h >= 23 || h < 4; }) },
  { id: 'determined',   category: 'secret', icon: 'calendar',      label: 'Déterminé',          condition: 'Séance le 1er janvier',
    epicDesc: "Une séance le 1er janvier. Pas besoin d'attendre la bonne résolution.",
    color: '#F43F5E', gradientColors: ['#FB7185','#F43F5E','#BE123C'], tier: 'gold',
    check: (l, s, logs) => logs.some(log => { if (!log.date) return false; const d = new Date(log.date); return d.getMonth() === 0 && d.getDate() === 1; }) },
  { id: 'early_bird',   category: 'secret', icon: 'sunny',         label: 'Lève-Tôt',           condition: 'Séance avant 6h du matin',
    epicDesc: "Une séance avant 6 h. La journée commence fort.",
    color: '#F97316', gradientColors: ['#FB923C','#F97316','#C2410C'], tier: 'bronze',
    check: (l, s, logs) => logs.some(log => { if (!log.date) return false; return new Date(log.date).getHours() < 6; }) },
  { id: 'dawn_warrior', category: 'secret', icon: 'partly-sunny',  label: "Guerrier de l'Aube", condition: 'Séance avant 5h du matin',
    epicDesc: "Une séance avant 5 h. Avant même le premier café.",
    color: '#F59E0B', gradientColors: ['#FCD34D','#F59E0B','#92400E'], tier: 'silver',
    check: (l, s, logs) => logs.some(log => { if (!log.date) return false; return new Date(log.date).getHours() < 5; }) },
  { id: 'streak_hunter', category: 'secret', icon: 'flame',        label: 'Chasseur de Streak', condition: 'Streak ≥ 7 jours',
    epicDesc: "Sept jours d'affilée. Une semaine complète sans casser la chaîne.",
    color: '#FB923C', gradientColors: ['#FDBA74','#FB923C','#EA580C'], tier: 'silver',
    check: (l, s, logs) => maxStreak(logs) >= 7 },
  { id: 'ultra_streak', category: 'secret', icon: 'infinite',      label: 'Ultra Streak',       condition: 'Streak ≥ 30 jours',
    epicDesc: "Trente jours d'affilée. Un mois entier sans jamais lâcher.",
    color: '#FFD700', gradientColors: ['#FDE68A','#FFD700','#B45309'], tier: 'diamond',
    check: (l, s, logs) => maxStreak(logs) >= 30 },
  { id: 'midnight_wolf', category: 'secret', icon: 'cloudy-night', label: 'Le Loup',            condition: 'Séance entre 0h et 1h',
    epicDesc: "Une séance juste après minuit. La salle est à toi.",
    color: '#4338CA', gradientColors: ['#6366F1','#4338CA','#1E1B4B'], tier: 'silver',
    check: (l, s, logs) => logs.some(log => { if (!log.date) return false; return new Date(log.date).getHours() === 0; }) },
  { id: 'athly_god',   category: 'secret', icon: 'planet',         label: 'ATHLY GOD',          condition: 'Niveau 200',
    epicDesc: "Niveau 200. Le sommet d'Athly. Il n'y a rien au-dessus.",
    color: '#FFD700', gradientColors: ['#FDE68A','#FFD700','#92400E'], tier: 'diamond',
    check: (l) => l >= 200 },

  // ─── CORPS (5) ─────────────────────────────────────────────────────────────
  { id: 'corps_bronze',   category: 'corps', icon: 'fitness',      label: 'Initié Poids Corps',  condition: '50 sets complétés',
    epicDesc: "Cinquante séries validées. Le compteur est lancé.",
    color: '#CD7F32', gradientColors: ['#E8A060','#CD7F32','#6B3A1A'], tier: 'bronze',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.setsCompleted) || 0), 0) >= 50 },
  { id: 'corps_silver',   category: 'corps', icon: 'walk',         label: 'Guerrier Poids Corps', condition: '150 sets complétés',
    epicDesc: "Cent cinquante séries validées. La technique se précise.",
    color: '#D1D5DB', gradientColors: ['#F3F4F6','#D1D5DB','#9CA3AF'], tier: 'silver',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.setsCompleted) || 0), 0) >= 150 },
  { id: 'corps_gold',     category: 'corps', icon: 'barbell',      label: 'Maître Poids Corps',   condition: '400 sets complétés',
    epicDesc: "Quatre cents séries validées. La maîtrise s'installe.",
    color: '#FFD700', gradientColors: ['#FDE047','#FFD700','#B45309'], tier: 'gold',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.setsCompleted) || 0), 0) >= 400 },
  { id: 'corps_platinum', category: 'corps', icon: 'shield-half',  label: 'Élite Poids Corps',    condition: '800 sets complétés',
    epicDesc: "Huit cents séries validées. Ton corps a changé, et ça se voit.",
    color: '#E5E7EB', gradientColors: ['#FFFFFF','#E5E7EB','#9CA3AF'], tier: 'platinum',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.setsCompleted) || 0), 0) >= 800 },
  { id: 'corps_diamond',  category: 'corps', icon: 'diamond',      label: 'Légende Poids Corps',  condition: '1 500 sets complétés',
    epicDesc: "Mille cinq cents séries validées. Un vrai monument de discipline.",
    color: '#60A5FA', gradientColors: ['#BFDBFE','#60A5FA','#1D4ED8'], tier: 'diamond',
    check: (l, s, logs) => logs.reduce((sum, log) => sum + (Number(log.setsCompleted) || 0), 0) >= 1500 },

  // ─── RÉGULARITÉ (5) ────────────────────────────────────────────────────────
  { id: 'reg_3m',         category: 'regularite', icon: 'calendar-outline', label: 'Constance 3 Mois',   condition: 'Séances sur 3 mois',
    epicDesc: "Trois mois d'entraînement. Ce n'est plus une phase, c'est une habitude.",
    color: '#10B981', gradientColors: ['#34D399','#10B981','#065F46'], tier: 'bronze',
    check: (l, s, logs) => daysSpanned(logs) >= 90 },
  { id: 'reg_6m',         category: 'regularite', icon: 'time-outline',     label: 'Constance 6 Mois',   condition: 'Séances sur 6 mois',
    epicDesc: "Six mois d'entraînement. Une demi-année de progrès.",
    color: '#0D9488', gradientColors: ['#14B8A6','#0D9488','#134E4A'], tier: 'silver',
    check: (l, s, logs) => daysSpanned(logs) >= 180 },
  { id: 'reg_9m',         category: 'regularite', icon: 'medal-outline',    label: 'Constance 9 Mois',   condition: 'Séances sur 9 mois',
    epicDesc: "Neuf mois d'entraînement. Tu as tenu sur la durée.",
    color: '#0891B2', gradientColors: ['#22D3EE','#0891B2','#0C4A6E'], tier: 'gold',
    check: (l, s, logs) => daysSpanned(logs) >= 270 },
  { id: 'reg_12m',        category: 'regularite', icon: 'trophy-outline',   label: 'Constance 12 Mois',  condition: 'Séances sur 12 mois',
    epicDesc: "Un an d'entraînement. Regarde d'où tu es parti.",
    color: '#7C3AED', gradientColors: ['#A78BFA','#7C3AED','#3B0764'], tier: 'platinum',
    check: (l, s, logs) => daysSpanned(logs) >= 365 },
  { id: 'iron_discipline', category: 'regularite', icon: 'repeat',          label: 'Discipline de Fer',  condition: '5 semaines avec 1+ séance',
    epicDesc: "Cinq semaines de suite avec au moins une séance. Rien ne t'arrête.",
    color: '#6366F1', gradientColors: ['#818CF8','#6366F1','#312E81'], tier: 'silver',
    check: (l, s, logs) => weeklyConsecutive(logs, 5) },

  // ─── SOCIAL (2) ────────────────────────────────────────────────────────────
  { id: 'first_friend',  category: 'social', icon: 'people',        label: 'Premier Ami',         condition: 'Ajouter un ami',
    epicDesc: "Ton premier ami sur Athly. C'est plus facile de progresser à deux.",
    color: '#EC4899', gradientColors: ['#F472B6','#EC4899','#9D174D'], tier: 'bronze',
    check: () => false },
  { id: 'mentor',        category: 'social', icon: 'people-circle', label: 'Mentor',              condition: 'Inspirer 5 amis',
    epicDesc: "Cinq amis embarqués dans l'aventure. Tu motives les autres.",
    color: '#8B5CF6', gradientColors: ['#A78BFA','#8B5CF6','#4C1D95'], tier: 'gold',
    check: () => false },

  // ─── SPÉCIAL (1) ───────────────────────────────────────────────────────────
  { id: 'athly_birthday', category: 'special', icon: 'gift',        label: 'Anniversaire Athly',  condition: 'Séance le 13 mai',
    epicDesc: "Une séance le 13 mai, le jour de l'anniversaire d'Athly. Merci d'être là.",
    color: '#FE7439', gradientColors: ['#FF9A5C','#FE7439','#C44A10'], tier: 'gold',
    check: (l, s, logs) => logs.some(log => {
      if (!log.date) return false;
      const d = new Date(log.date);
      return d.getMonth() === 4 && d.getDate() === 13;
    }) },
];

// ─── Trophée Ultime — débloqué uniquement quand TOUS les autres sont débloqués ──

export const ULTIMATE_TROPHY = {
  id: 'souverain_absolu',
  category: 'ultime',
  icon: 'infinite',
  label: 'Souverain Absolu',
  condition: 'Tous les trophées débloqués',
  epicDesc: "Tous les trophées d'Athly sont à toi. Collection complète, rien ne t'a échappé.",
  color: '#FFD700',
  gradientColors: ['#FFFACD', '#FFD700', '#FF8C00', '#C44A10'],
  tier: 'diamond',
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const TROPHY_CATEGORIES = [
  { id: 'heritage',    label: 'Héritage',   icon: 'ribbon',        color: '#FFD700' },
  { id: 'force',       label: 'Force',      icon: 'barbell',       color: '#DC2626' },
  { id: 'exploration', label: 'Exploration',icon: 'compass',       color: '#22C55E' },
  { id: 'secret',      label: 'Secret',     icon: 'eye-off',       color: '#6366F1' },
  { id: 'corps',       label: 'Corps',      icon: 'fitness',       color: '#CD7F32' },
  { id: 'regularite',  label: 'Régularité', icon: 'repeat',        color: '#10B981' },
  { id: 'social',      label: 'Social',     icon: 'people',        color: '#EC4899' },
  { id: 'special',     label: 'Spécial',    icon: 'gift',          color: '#FE7439' },
];

// Chaque catégorie (locale + backend via BACKEND_CATEGORY_MAP) doit apparaître
// dans exactement un onglet ci-dessous — pas de doublon, pas de trou — pour que
// "Tous" et la somme des onglets filtrés restent toujours cohérents.
export const TROPHY_FILTER_TABS = [
  { id: 'all',        label: 'Tous' },
  { id: 'force',      label: 'Force',            categories: ['force', 'corps'] },
  { id: 'endurance',  label: 'Endurance',        categories: ['heritage', 'exploration', 'regularite'] },
  { id: 'social',     label: 'Social & Multi',   categories: ['social'] },
  { id: 'collection', label: 'Coffres & Raretés', categories: ['collection'] },
  { id: 'special',    label: 'Spécial',          categories: ['secret', 'special'] },
];

// ─── Helper: évalue le catalogue avec overrides (godMode console) ─────────────
// overrides : { [id]: true | false }  — true = force-unlock, false = force-lock
export function evaluateTrophies(level, totalSessions, logs, totalXP, overrides = {}) {
  return TROPHY_CATALOG.map((t) => {
    const natural = t.check(level, totalSessions, logs, totalXP);
    const override = overrides[t.id];
    const unlocked = override !== undefined ? override : natural;
    return { ...t, unlocked, naturalUnlocked: natural };
  });
}
