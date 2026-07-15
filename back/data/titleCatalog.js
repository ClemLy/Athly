'use strict';

// ─── Catalogue des Titres déblocables (Section X) ──────────────────────────────
// Titre = cosmétique textuel affiché sous le pseudo (profil public/privé),
// équipable un par un via POST /api/profile/equip-title. Les CONDITIONS sont
// évaluées côté serveur (voir title.controller.js → checkAndUnlockTitles) —
// ce fichier ne porte que les MÉTADONNÉES d'affichage, à l'image de
// ACHIEVEMENT_CATALOG dans reward.controller.js.
//
// `rarity` pilote la couleur de lueur affichée par TitlePickerScreen côté
// front (mêmes teintes que l'inventaire : commun/rare/épique/légendaire/unique
// — voir Colors.uniqueBlood* pour la rareté "unique").
//
// `condition` est un texte humain affiché dans l'InfoModal d'un titre encore
// verrouillé (Section X — "quête exacte à accomplir").

const TITLE_CATALOG = {
  PERFORM_LEVEL_10: {
    id:          'PERFORM_LEVEL_10',
    label:       'Le Rescapé',
    description: 'Atteindre le niveau 10.',
    condition:   'Atteins le niveau 10.',
    category:    'performance',
    rarity:      'common',
  },
  PERFORM_LEVEL_50: {
    id:          'PERFORM_LEVEL_50',
    label:       'Le Titan',
    description: 'Atteindre le niveau 50.',
    condition:   'Atteins le niveau 50.',
    category:    'performance',
    rarity:      'legendary',
  },
  REFERRAL_EARLY: {
    id:          'REFERRAL_EARLY',
    label:       "L'Ancien",
    description: 'Avoir lié son compte via parrainage à son inscription.',
    condition:   "Crée ton compte via un lien de parrainage (champ optionnel à l'inscription).",
    category:    'social',
    rarity:      'rare',
  },
  PR_HEAVY_100: {
    id:          'PR_HEAVY_100',
    label:       'Force de la Nature',
    description: 'Décrocher un record personnel de plus de 100 kg sur un exercice majeur.',
    condition:   'Bats un record personnel à plus de 100 kg sur un exercice majeur (Développé couché, Squat, Soulevé de terre…).',
    category:    'performance',
    rarity:      'epic',
  },
  LOOT_LEGENDARY: {
    id:          'LOOT_LEGENDARY',
    label:       'Main Dorée',
    description: 'Obtenir un objet Légendaire dans un coffre.',
    condition:   'Ouvre un coffre et obtiens un objet Légendaire.',
    category:    'inventory',
    rarity:      'legendary',
  },
  LOOT_BLOOD_UNIQUE: {
    id:          'LOOT_BLOOD_UNIQUE',
    label:       'Élu du Sang',
    description: 'Obtenir un item ou cadre Unique Rouge Sang.',
    condition:   'Débloque un cosmétique Unique Rouge Sang (cadre, couleur ou thème).',
    category:    'inventory',
    rarity:      'unique',
  },
  INVENTORY_HOARDER: {
    id:          'INVENTORY_HOARDER',
    label:       'Le Collectionneur',
    description: 'Posséder au moins 10 objets en même temps.',
    condition:   "Accumule au moins 10 objets dans ton inventaire, tous types confondus.",
    category:    'inventory',
    rarity:      'rare',
  },
  MULTI_SESSIONS_30_TITLE: {
    id:          'MULTI_SESSIONS_30_TITLE',
    label:       "Frère d'Armes",
    description: 'Avoir validé 30 séances en mode Multi.',
    condition:   'Termine 30 séances en Lobby Multi.',
    category:    'social',
    rarity:      'epic',
  },
  SOLO_SHADOW_WORK: {
    id:          'SOLO_SHADOW_WORK',
    label:       'Loup Solitaire',
    description: "S'entraîner seul pendant qu'un de ses groupes est actif.",
    condition:   "Termine une séance en solo pendant qu'un coéquipier de ton groupe a une séance active en direct.",
    category:    'social',
    rarity:      'rare',
  },
  SHAME_BURNING: {
    id:          'SHAME_BURNING',
    label:       'Bourreau des Cœurs',
    description: 'Avoir utilisé le bouton "Secouer" plus de 15 fois.',
    condition:   'Utilise le bouton "Secouer" plus de 15 fois au total.',
    category:    'social',
    rarity:      'epic',
  },
  SHAME_REPENTANCE: {
    id:          'SHAME_REPENTANCE',
    label:       'Le Repentir',
    description: "Sortir du Hall of Shame en validant sa séance moins de 2h après y avoir été affiché.",
    condition:   'Valide ta séance dans les 2 heures suivant ton apparition dans le Hall of Shame.',
    category:    'social',
    rarity:      'rare',
  },
  WORKOUT_IRON_BREAKER: {
    id:          'WORKOUT_IRON_BREAKER',
    label:       'Le Briseur de Fonte',
    description: 'Valider 100 séries au total.',
    condition:   'Valide 100 séries au total, toutes séances confondues.',
    category:    'performance',
    rarity:      'epic',
  },
  WORKOUT_NIGHT_OWL: {
    id:          'WORKOUT_NIGHT_OWL',
    label:       'L\'Ombre de la Salle',
    description: 'Lancer une séance entre minuit et 5h du matin.',
    condition:   'Lance une séance entre minuit et 5h du matin.',
    category:    'performance',
    rarity:      'rare',
  },
  STREAK_INSUBMERSIBLE: {
    id:          'STREAK_INSUBMERSIBLE',
    label:       "L'Insubmersible",
    description: "Sauver sa streak 3 fois de suite avec un Gel de Streak.",
    condition:   "Sauve ta streak personnelle 3 fois d'affilée grâce à un Gel de Streak, sans rupture non couverte entre les deux.",
    category:    'streak',
    rarity:      'epic',
  },
  GROUP_GUILD_MASTER: {
    id:          'GROUP_GUILD_MASTER',
    label:       'Maître de Guilde',
    description: 'Créer un groupe de 5 et le maintenir 7 jours.',
    condition:   'En tant que créateur, maintiens un groupe à 5 membres pendant 7 jours.',
    category:    'social',
    rarity:      'legendary',
  },
  SOCIAL_POKE_STRIKER: {
    id:          'SOCIAL_POKE_STRIKER',
    label:       'Fléau de la Paresse',
    description: 'Secouer 3 membres différents le même jour.',
    condition:   'Secoue 3 coéquipiers différents dans la même journée.',
    category:    'social',
    rarity:      'rare',
  },
  LOBBY_INSTIGATOR: {
    id:          'LOBBY_INSTIGATOR',
    label:       "L'Instigateur",
    description: 'Être le créateur de 20 Lobbies Multi validés.',
    condition:   'Crée et termine 20 Lobbies Multi en tant que créateur.',
    category:    'social',
    rarity:      'legendary',
  },
};

module.exports = { TITLE_CATALOG };
