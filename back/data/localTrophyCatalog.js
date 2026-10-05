'use strict';

// ─── Miroir backend du catalogue de trophées LOCAL du front ───────────────────
// Source de vérité des CONDITIONS : front/src/data/trophyCatalog.js — les
// conditions s'évaluent côté client (elles dépendent des logs de séances
// AsyncStorage que le serveur ne possède pas). Le client synchronise les IDs
// débloqués via PUT /api/rewards/achievements/sync ; ce fichier ne porte que
// les MÉTADONNÉES d'affichage — mêmes noms de champs que le front
// (label/condition/epicDesc/gradientColors/tier) pour un rendu visuel
// PARFAITEMENT identique (TrophySlot est partagé, pas réimplémenté) — et sert
// d'allowlist pour la synchronisation.
//
// hidden: true → catégorie "secret" du front : masqué tant que non débloqué.

const T = (id, category, icon, label, condition, epicDesc, color, gradientColors, tier, hidden = false) =>
  ({ id, category, icon, label, condition, epicDesc, color, gradientColors, tier, hidden });

const LOCAL_TROPHY_LIST = [
  // ── HÉRITAGE (6) ──
  T('ignition', 'heritage', 'flame', 'Ignition', '1ère séance',
    "Ta toute première séance. Le plus dur est fait : tu as commencé.",
    '#FE7439', ['#FF9A5C', '#FE7439', '#C44A10'], 'bronze'),
  T('promise', 'heritage', 'medal', 'Promesse', 'Niveau 10',
    "Niveau 10. Tu n'es plus en train d'essayer, tu es en train de construire.",
    '#FFD700', ['#FFE566', '#FFD700', '#B8860B'], 'gold'),
  T('apprenti', 'heritage', 'school', 'Apprenti', 'Niveau 25',
    "Niveau 25. Les bases sont solides, les mouvements deviennent naturels.",
    '#34D399', ['#6EE7B7', '#34D399', '#059669'], 'silver'),
  T('centurion', 'heritage', 'trophy', 'Centurion', '50 séances',
    "Cinquante séances. À ce stade, ce n'est plus de la motivation, c'est une habitude.",
    '#6E6AF0', ['#9B97FF', '#6E6AF0', '#3D3A9E'], 'platinum'),
  T('veteran', 'heritage', 'shield-checkmark', 'Vétéran', 'Niveau 75',
    "Niveau 75. Des centaines de séries derrière toi, et toujours là.",
    '#3B82F6', ['#60A5FA', '#3B82F6', '#1D4ED8'], 'gold'),
  T('demi_dieu', 'heritage', 'sparkles', 'Demi-Dieu', 'Niveau 150',
    "Niveau 150. Très peu de monde a fait autant de chemin.",
    '#8B5CF6', ['#A78BFA', '#8B5CF6', '#5B21B6'], 'diamond'),

  // ── FORCE (7) ──
  T('titan', 'force', 'barbell', 'Le Titan', '10 000 kg soulevés',
    "Dix mille kilos soulevés au total. Ça commence à peser.",
    '#DC2626', ['#EF4444', '#DC2626', '#991B1B'], 'gold'),
  T('iron_will', 'force', 'shield', 'Iron Will', '3 jours consécutifs',
    "Trois jours d'affilée. Même quand l'envie manquait, tu y es allé.",
    '#B45309', ['#D97706', '#B45309', '#78350F'], 'silver'),
  T('machine', 'force', 'flash', 'La Machine', '25 sets en une séance',
    "Vingt-cinq séries dans une seule séance. Grosse journée.",
    '#F59E0B', ['#FDE68A', '#F59E0B', '#B45309'], 'silver'),
  T('legionnaire', 'force', 'star', 'Légionnaire', '100 séances',
    "Cent séances. Cent fois où tu as choisi de venir.",
    '#EAB308', ['#FDE047', '#EAB308', '#854D0E'], 'platinum'),
  T('colossus', 'force', 'body', 'Colosse', '50 000 kg soulevés',
    "Cinquante mille kilos soulevés. L'équivalent d'un camion, morceau par morceau.",
    '#991B1B', ['#DC2626', '#991B1B', '#450A0A'], 'diamond'),
  T('forge', 'force', 'hammer', 'La Forge', '500 sets au total',
    "Cinq cents séries au compteur. C'est là que la force se construit.",
    '#C2410C', ['#EA580C', '#C2410C', '#7C2D12'], 'silver'),
  T('volume_king', 'force', 'analytics', 'Roi du Volume', '100 000 kg soulevés',
    "Cent mille kilos soulevés. Personne ne t'arrête.",
    '#7C3AED', ['#8B5CF6', '#7C3AED', '#4C1D95'], 'diamond'),

  // ── EXPLORATION (6) ──
  T('polyvalent', 'exploration', 'grid', 'Polyvalent', '5 groupes musculaires',
    "Pecs, dos, jambes, épaules, bras : tu n'oublies aucun groupe musculaire.",
    '#22C55E', ['#4ADE80', '#22C55E', '#15803D'], 'silver'),
  T('marathonien', 'exploration', 'time', 'Marathonien', 'Séance ≥ 60 min',
    "Une heure entière à t'entraîner, sans lâcher.",
    '#0EA5E9', ['#38BDF8', '#0EA5E9', '#0369A1'], 'bronze'),
  T('demi_legende', 'exploration', 'rocket', 'Demi-Légende', 'Niveau 50',
    "Niveau 50. La moitié du chemin vers le sommet, et peu de gens arrivent jusqu'ici.",
    '#3B82F6', ['#60A5FA', '#3B82F6', '#1D4ED8'], 'gold'),
  T('xp_millionaire', 'exploration', 'infinite', 'XP Millionnaire', '1 000 000 XP cumulés',
    "Un million de points d'expérience. Des années de régularité en un chiffre.",
    '#A855F7', ['#C084FC', '#A855F7', '#7E22CE'], 'diamond'),
  T('speed_demon', 'exploration', 'speedometer', 'Speed Demon', 'Séance complète ≤ 20 min',
    "Une séance complète en vingt minutes. Efficace, sans temps mort.",
    '#F97316', ['#FB923C', '#F97316', '#C2410C'], 'bronze'),
  T('ultra_marathon', 'exploration', 'hourglass', 'Ultra-Marathon', 'Séance ≥ 90 min',
    "Quatre-vingt-dix minutes d'effort. Une séance que tu n'oublieras pas.",
    '#0891B2', ['#22D3EE', '#0891B2', '#164E63'], 'silver'),

  // ── SECRET (8) — masqués tant que non débloqués ──
  T('night_owl', 'secret', 'moon', 'Oiseau de Nuit', 'Séance entre 23h et 4h',
    "Une séance entre 23 h et 4 h. Pendant que tout le monde dort.",
    '#6366F1', ['#818CF8', '#6366F1', '#3730A3'], 'silver', true),
  T('determined', 'secret', 'calendar', 'Déterminé', 'Séance le 1er janvier',
    "Une séance le 1er janvier. Pas besoin d'attendre la bonne résolution.",
    '#F43F5E', ['#FB7185', '#F43F5E', '#BE123C'], 'gold', true),
  T('early_bird', 'secret', 'sunny', 'Lève-Tôt', 'Séance avant 6h du matin',
    "Une séance avant 6 h. La journée commence fort.",
    '#F97316', ['#FB923C', '#F97316', '#C2410C'], 'bronze', true),
  T('dawn_warrior', 'secret', 'partly-sunny', "Guerrier de l'Aube", 'Séance avant 5h du matin',
    "Une séance avant 5 h. Avant même le premier café.",
    '#F59E0B', ['#FCD34D', '#F59E0B', '#92400E'], 'silver', true),
  T('streak_hunter', 'secret', 'flame', 'Chasseur de Streak', 'Streak ≥ 7 jours',
    "Sept jours d'affilée. Une semaine complète sans casser la chaîne.",
    '#FB923C', ['#FDBA74', '#FB923C', '#EA580C'], 'silver', true),
  T('ultra_streak', 'secret', 'infinite', 'Ultra Streak', 'Streak ≥ 30 jours',
    "Trente jours d'affilée. Un mois entier sans jamais lâcher.",
    '#FFD700', ['#FDE68A', '#FFD700', '#B45309'], 'diamond', true),
  T('midnight_wolf', 'secret', 'cloudy-night', 'Le Loup', 'Séance entre 0h et 1h',
    "Une séance juste après minuit. La salle est à toi.",
    '#4338CA', ['#6366F1', '#4338CA', '#1E1B4B'], 'silver', true),
  T('athly_god', 'secret', 'planet', 'ATHLY GOD', 'Niveau 200',
    "Niveau 200. Le sommet d'Athly. Il n'y a rien au-dessus.",
    '#FFD700', ['#FDE68A', '#FFD700', '#92400E'], 'diamond', true),

  // ── CORPS (5) ──
  T('corps_bronze', 'corps', 'fitness', 'Initié Poids Corps', '50 sets complétés',
    "Cinquante séries validées. Le compteur est lancé.",
    '#CD7F32', ['#E8A060', '#CD7F32', '#6B3A1A'], 'bronze'),
  T('corps_silver', 'corps', 'walk', 'Guerrier Poids Corps', '150 sets complétés',
    "Cent cinquante séries validées. La technique se précise.",
    '#D1D5DB', ['#F3F4F6', '#D1D5DB', '#9CA3AF'], 'silver'),
  T('corps_gold', 'corps', 'barbell', 'Maître Poids Corps', '400 sets complétés',
    "Quatre cents séries validées. La maîtrise s'installe.",
    '#FFD700', ['#FDE047', '#FFD700', '#B45309'], 'gold'),
  T('corps_platinum', 'corps', 'shield-half', 'Élite Poids Corps', '800 sets complétés',
    "Huit cents séries validées. Ton corps a changé, et ça se voit.",
    '#E5E7EB', ['#FFFFFF', '#E5E7EB', '#9CA3AF'], 'platinum'),
  T('corps_diamond', 'corps', 'diamond', 'Légende Poids Corps', '1 500 sets complétés',
    "Mille cinq cents séries validées. Un vrai monument de discipline.",
    '#60A5FA', ['#BFDBFE', '#60A5FA', '#1D4ED8'], 'diamond'),

  // ── RÉGULARITÉ (5) ──
  T('reg_3m', 'regularite', 'calendar-outline', 'Constance 3 Mois', 'Séances sur 3 mois',
    "Trois mois d'entraînement. Ce n'est plus une phase, c'est une habitude.",
    '#10B981', ['#34D399', '#10B981', '#065F46'], 'bronze'),
  T('reg_6m', 'regularite', 'time-outline', 'Constance 6 Mois', 'Séances sur 6 mois',
    "Six mois d'entraînement. Une demi-année de progrès.",
    '#0D9488', ['#14B8A6', '#0D9488', '#134E4A'], 'silver'),
  T('reg_9m', 'regularite', 'medal-outline', 'Constance 9 Mois', 'Séances sur 9 mois',
    "Neuf mois d'entraînement. Tu as tenu sur la durée.",
    '#0891B2', ['#22D3EE', '#0891B2', '#0C4A6E'], 'gold'),
  T('reg_12m', 'regularite', 'trophy-outline', 'Constance 12 Mois', 'Séances sur 12 mois',
    "Un an d'entraînement. Regarde d'où tu es parti.",
    '#7C3AED', ['#A78BFA', '#7C3AED', '#3B0764'], 'platinum'),
  T('iron_discipline', 'regularite', 'repeat', 'Discipline de Fer', '5 semaines avec 1+ séance',
    "Cinq semaines de suite avec au moins une séance. Rien ne t'arrête.",
    '#6366F1', ['#818CF8', '#6366F1', '#312E81'], 'silver'),

  // ── SOCIAL (2) ──
  T('first_friend', 'social', 'people', 'Premier Ami', 'Ajouter un ami',
    "Ton premier ami sur Athly. C'est plus facile de progresser à deux.",
    '#EC4899', ['#F472B6', '#EC4899', '#9D174D'], 'bronze'),
  T('mentor', 'social', 'people-circle', 'Mentor', 'Inspirer 5 amis',
    "Cinq amis embarqués dans l'aventure. Tu motives les autres.",
    '#8B5CF6', ['#A78BFA', '#8B5CF6', '#4C1D95'], 'gold'),

  // ── SPÉCIAL (1) ──
  T('athly_birthday', 'special', 'gift', 'Anniversaire Athly', 'Séance le 13 mai',
    "Une séance le 13 mai, le jour de l'anniversaire d'Athly. Merci d'être là.",
    '#FE7439', ['#FF9A5C', '#FE7439', '#C44A10'], 'gold'),

  // ── ULTIME (1) ──
  T('souverain_absolu', 'ultime', 'infinite', 'Souverain Absolu', 'Tous les trophées débloqués',
    "Tous les trophées d'Athly sont à toi. Collection complète, rien ne t'a échappé.",
    '#FFD700', ['#FFFACD', '#FFD700', '#FF8C00', '#C44A10'], 'diamond'),
];

// Indexé par id, même forme que ACHIEVEMENT_CATALOG (reward.controller.js)
const LOCAL_TROPHY_CATALOG = Object.fromEntries(LOCAL_TROPHY_LIST.map((t) => [t.id, t]));

const LOCAL_TROPHY_IDS = new Set(Object.keys(LOCAL_TROPHY_CATALOG));

module.exports = { LOCAL_TROPHY_CATALOG, LOCAL_TROPHY_IDS };
