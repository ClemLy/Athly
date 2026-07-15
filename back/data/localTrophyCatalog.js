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
    "La flamme s'allume. Votre premier pas dans l'arène - et rien ne sera jamais plus pareil.",
    '#FE7439', ['#FF9A5C', '#FE7439', '#C44A10'], 'bronze'),
  T('promise', 'heritage', 'medal', 'Promesse', 'Niveau 10',
    "Le novice est mort. Vous avez prouvé que vous êtes là pour durer - la promesse est tenue.",
    '#FFD700', ['#FFE566', '#FFD700', '#B8860B'], 'gold'),
  T('apprenti', 'heritage', 'school', 'Apprenti', 'Niveau 25',
    "Les bases sont posées. Chaque set vous a sculpté - vous n'êtes plus un débutant, vous êtes un apprenti.",
    '#34D399', ['#6EE7B7', '#34D399', '#059669'], 'silver'),
  T('centurion', 'heritage', 'trophy', 'Centurion', '50 séances',
    "Votre volonté est d'acier. 50 combats menés avec honneur - les légions vous saluent.",
    '#6E6AF0', ['#9B97FF', '#6E6AF0', '#3D3A9E'], 'platinum'),
  T('veteran', 'heritage', 'shield-checkmark', 'Vétéran', 'Niveau 75',
    "Trois quarts du chemin vers le sommet. Vous portez les cicatrices de centaines de batailles.",
    '#3B82F6', ['#60A5FA', '#3B82F6', '#1D4ED8'], 'gold'),
  T('demi_dieu', 'heritage', 'sparkles', 'Demi-Dieu', 'Niveau 150',
    "150 niveaux d'ascension. Les mortels vous regardent avec crainte. Vous n'appartenez plus à leur monde.",
    '#8B5CF6', ['#A78BFA', '#8B5CF6', '#5B21B6'], 'diamond'),

  // ── FORCE (7) ──
  T('titan', 'force', 'barbell', 'Le Titan', '10 000 kg soulevés',
    "Dix mille kilos. Un chiffre qui n'appartient qu'aux légendes du fer.",
    '#DC2626', ['#EF4444', '#DC2626', '#991B1B'], 'gold'),
  T('iron_will', 'force', 'shield', 'Iron Will', '3 jours consécutifs',
    "Trois jours sans relâche. Quand votre corps criait stop, vous avez choisi de continuer.",
    '#B45309', ['#D97706', '#B45309', '#78350F'], 'silver'),
  T('machine', 'force', 'flash', 'La Machine', '25 sets en une séance',
    "Vingt-cinq séries en un seul souffle. Vous n'êtes pas humain, vous êtes une machine.",
    '#F59E0B', ['#FDE68A', '#F59E0B', '#B45309'], 'silver'),
  T('legionnaire', 'force', 'star', 'Légionnaire', '100 séances',
    "Cent batailles. Cent victoires sur vous-même. Les légions de Rome vous auraient honoré.",
    '#EAB308', ['#FDE047', '#EAB308', '#854D0E'], 'platinum'),
  T('colossus', 'force', 'body', 'Colosse', '50 000 kg soulevés',
    "Cinquante mille kilos déplacés par votre seule volonté. Vous êtes une force de la nature.",
    '#991B1B', ['#DC2626', '#991B1B', '#450A0A'], 'diamond'),
  T('forge', 'force', 'hammer', 'La Forge', '500 sets au total',
    "Cinq cents séries. Votre corps a été forgé à la chaleur du travail acharné.",
    '#C2410C', ['#EA580C', '#C2410C', '#7C2D12'], 'silver'),
  T('volume_king', 'force', 'analytics', 'Roi du Volume', '100 000 kg soulevés',
    "Cent mille kilos. Le roi du volume tient son trône.",
    '#7C3AED', ['#8B5CF6', '#7C3AED', '#4C1D95'], 'diamond'),

  // ── EXPLORATION (6) ──
  T('polyvalent', 'exploration', 'grid', 'Polyvalent', '5 groupes musculaires',
    "Pecs, dos, jambes, épaules, bras - vous ne laissez aucun muscle au repos.",
    '#22C55E', ['#4ADE80', '#22C55E', '#15803D'], 'silver'),
  T('marathonien', 'exploration', 'time', 'Marathonien', 'Séance ≥ 60 min',
    "Une heure dans l'arène. Quand les autres partaient après 30 minutes, vous étiez encore là.",
    '#0EA5E9', ['#38BDF8', '#0EA5E9', '#0369A1'], 'bronze'),
  T('demi_legende', 'exploration', 'rocket', 'Demi-Légende', 'Niveau 50',
    "La moitié du chemin vers le sommet. Peu y arrivent - vous y êtes.",
    '#3B82F6', ['#60A5FA', '#3B82F6', '#1D4ED8'], 'gold'),
  T('xp_millionaire', 'exploration', 'infinite', 'XP Millionnaire', '1 000 000 XP cumulés',
    "Un million de points d'expérience. Une vie entière de sueur, de fer et de détermination.",
    '#A855F7', ['#C084FC', '#A855F7', '#7E22CE'], 'diamond'),
  T('speed_demon', 'exploration', 'speedometer', 'Speed Demon', 'Séance complète ≤ 20 min',
    "Vingt minutes. Efficace, explosif, précis. Quand les autres finissent leur échauffement, vous êtes déjà sous la douche.",
    '#F97316', ['#FB923C', '#F97316', '#C2410C'], 'bronze'),
  T('ultra_marathon', 'exploration', 'hourglass', 'Ultra-Marathon', 'Séance ≥ 90 min',
    "Quatre-vingt-dix minutes de pur effort. Quand la plupart abandonnent, vous n'avez pas encore commencé.",
    '#0891B2', ['#22D3EE', '#0891B2', '#164E63'], 'silver'),

  // ── SECRET (8) — masqués tant que non débloqués ──
  T('night_owl', 'secret', 'moon', 'Oiseau de Nuit', 'Séance entre 23h et 4h',
    "Pendant que le monde dort, vous forgez votre corps dans le silence.",
    '#6366F1', ['#818CF8', '#6366F1', '#3730A3'], 'silver', true),
  T('determined', 'secret', 'calendar', 'Déterminé', 'Séance le 1er janvier',
    "Quand les autres font des vœux, vous faites des sets.",
    '#F43F5E', ['#FB7185', '#F43F5E', '#BE123C'], 'gold', true),
  T('early_bird', 'secret', 'sunny', 'Lève-Tôt', 'Séance avant 6h du matin',
    "Le soleil n'est pas encore levé, et vous êtes déjà en sueur.",
    '#F97316', ['#FB923C', '#F97316', '#C2410C'], 'bronze', true),
  T('dawn_warrior', 'secret', 'partly-sunny', "Guerrier de l'Aube", 'Séance avant 5h du matin',
    "4h58. L'obscurité n'a pas encore capitulé, mais vous, oui.",
    '#F59E0B', ['#FCD34D', '#F59E0B', '#92400E'], 'silver', true),
  T('streak_hunter', 'secret', 'flame', 'Chasseur de Streak', 'Streak ≥ 7 jours',
    "Sept jours sans interruption. Le feu de votre volonté brûle plus fort que jamais.",
    '#FB923C', ['#FDBA74', '#FB923C', '#EA580C'], 'silver', true),
  T('ultra_streak', 'secret', 'infinite', 'Ultra Streak', 'Streak ≥ 30 jours',
    "Trente jours de constance absolue. Vous avez transcendé la discipline pour atteindre l'obsession.",
    '#FFD700', ['#FDE68A', '#FFD700', '#B45309'], 'diamond', true),
  T('midnight_wolf', 'secret', 'cloudy-night', 'Le Loup', 'Séance entre 0h et 1h',
    "Minuit passé. Les loups chassent quand le troupeau dort.",
    '#4338CA', ['#6366F1', '#4338CA', '#1E1B4B'], 'silver', true),
  T('athly_god', 'secret', 'planet', 'ATHLY GOD', 'Niveau 200',
    "Le sommet absolu. Vous n'êtes plus un athlète - vous êtes une légende vivante. Le trône vous appartient.",
    '#FFD700', ['#FDE68A', '#FFD700', '#92400E'], 'diamond', true),

  // ── CORPS (5) ──
  T('corps_bronze', 'corps', 'fitness', 'Initié Poids Corps', '50 sets complétés',
    "Cinquante séries avec votre propre corps. Pas de barres, pas de charges - juste vous contre la gravité.",
    '#CD7F32', ['#E8A060', '#CD7F32', '#6B3A1A'], 'bronze'),
  T('corps_silver', 'corps', 'walk', 'Guerrier Poids Corps', '150 sets complétés',
    "Cent cinquante séries. Votre poids corporel est devenu votre outil de sculpture le plus précis.",
    '#D1D5DB', ['#F3F4F6', '#D1D5DB', '#9CA3AF'], 'silver'),
  T('corps_gold', 'corps', 'barbell', 'Maître Poids Corps', '400 sets complétés',
    "Quatre cents séries. La maîtrise s'est installée.",
    '#FFD700', ['#FDE047', '#FFD700', '#B45309'], 'gold'),
  T('corps_platinum', 'corps', 'shield-half', 'Élite Poids Corps', '800 sets complétés',
    "Huit cents séries. Vous portez votre corps comme une armure.",
    '#E5E7EB', ['#FFFFFF', '#E5E7EB', '#9CA3AF'], 'platinum'),
  T('corps_diamond', 'corps', 'diamond', 'Légende Poids Corps', '1 500 sets complétés',
    "Quinze cents séries. Un monument de discipline et de force pure.",
    '#60A5FA', ['#BFDBFE', '#60A5FA', '#1D4ED8'], 'diamond'),

  // ── RÉGULARITÉ (5) ──
  T('reg_3m', 'regularite', 'calendar-outline', 'Constance 3 Mois', 'Séances sur 3 mois',
    "Trois mois d'entraînement. Pas une mode - une véritable habitude.",
    '#10B981', ['#34D399', '#10B981', '#065F46'], 'bronze'),
  T('reg_6m', 'regularite', 'time-outline', 'Constance 6 Mois', 'Séances sur 6 mois',
    "Six mois. La moitié d'une année dédiée au progrès.",
    '#0D9488', ['#14B8A6', '#0D9488', '#134E4A'], 'silver'),
  T('reg_9m', 'regularite', 'medal-outline', 'Constance 9 Mois', 'Séances sur 9 mois',
    "Neuf mois d'engagement total. Il faut neuf mois pour renaître.",
    '#0891B2', ['#22D3EE', '#0891B2', '#0C4A6E'], 'gold'),
  T('reg_12m', 'regularite', 'trophy-outline', 'Constance 12 Mois', 'Séances sur 12 mois',
    "Un an. 365 jours de transformation. Vous êtes encore debout.",
    '#7C3AED', ['#A78BFA', '#7C3AED', '#3B0764'], 'platinum'),
  T('iron_discipline', 'regularite', 'repeat', 'Discipline de Fer', '5 semaines avec 1+ séance',
    "Cinq semaines consécutives sans interruption.",
    '#6366F1', ['#818CF8', '#6366F1', '#312E81'], 'silver'),

  // ── SOCIAL (2) ──
  T('first_friend', 'social', 'people', 'Premier Ami', 'Ajouter un ami',
    "Les grandes épopées ne se vivent pas seules. Votre premier compagnon d'armes vous attend.",
    '#EC4899', ['#F472B6', '#EC4899', '#9D174D'], 'bronze'),
  T('mentor', 'social', 'people-circle', 'Mentor', 'Inspirer 5 amis',
    "Vous avez allumé la flamme chez cinq autres - vous êtes plus qu'un athlète, vous êtes un mentor.",
    '#8B5CF6', ['#A78BFA', '#8B5CF6', '#4C1D95'], 'gold'),

  // ── SPÉCIAL (1) ──
  T('athly_birthday', 'special', 'gift', 'Anniversaire Athly', 'Séance le 13 mai',
    "Le jour où Athly est né, vous étiez là - à suer, à pousser, à vous dépasser.",
    '#FE7439', ['#FF9A5C', '#FE7439', '#C44A10'], 'gold'),

  // ── ULTIME (1) ──
  T('souverain_absolu', 'ultime', 'infinite', 'Souverain Absolu', 'Tous les trophées débloqués',
    "Il n'existe pas de plus grand accomplissement. Vous avez tout conquis, tout maîtrisé, tout surpassé. L'empire d'Athly vous appartient - et l'univers entier s'incline devant vous.",
    '#FFD700', ['#FFFACD', '#FFD700', '#FF8C00', '#C44A10'], 'diamond'),
];

// Indexé par id, même forme que ACHIEVEMENT_CATALOG (reward.controller.js)
const LOCAL_TROPHY_CATALOG = Object.fromEntries(LOCAL_TROPHY_LIST.map((t) => [t.id, t]));

const LOCAL_TROPHY_IDS = new Set(Object.keys(LOCAL_TROPHY_CATALOG));

module.exports = { LOCAL_TROPHY_CATALOG, LOCAL_TROPHY_IDS };
