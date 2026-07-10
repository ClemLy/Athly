// Définition des 8 chapitres du tutoriel interactif Athly.
//
// Propriétés d'une step :
//  targetKey      – clé d'une cible enregistrée via useTutorialTarget (null = pas de spotlight)
//  position       – 'top' | 'bottom' | 'center' (placement du tooltip)
//  scrollY        – offset de scroll à déclencher avant d'afficher l'étape (null = pas de scroll)
//  autoAction     – action automatique déclenchée quand l'étape devient active
//  actionRequired – si true, le bouton "Suivant" est désactivé ; l'écran doit appeler
//                   nextStep() lorsque l'utilisateur effectue l'action demandée
//  hint           – texte d'invite affiché en lieu du bouton "Suivant" pour actionRequired
//  isLast         – marque la dernière étape du dernier chapitre (bouton "Terminer")

export const TUTORIAL_CHAPTERS = [

  // ─── CHAPITRE 1 : Le Dashboard ─────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Le Dashboard',
    subtitle: 'Chapitre 1',
    icon: 'home-outline',
    tabName: 'Accueil',
    steps: [
      {
        key: 'welcome',
        title: 'Bienvenue sur Athly !',
        body: "Athly transforme chaque séance en progression réelle. Ce guide de 8 chapitres te montrera tout ce que tu peux accomplir.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'header_level',
        title: 'Ton Niveau en Temps Réel',
        body: "Cette puce affiche ton niveau actuel, calculé à partir de ton XP cumulé. Chaque séance terminée te fait progresser.",
        targetKey: 'home_level_chip', position: 'bottom', scrollY: 0,
      },
      {
        key: 'hero_session',
        title: 'Séance Recommandée',
        body: "Athly analyse ton historique et te suggère le groupe musculaire le moins travaillé. Appuie sur 'Démarrer' pour lancer la séance.",
        targetKey: 'home_herosession', position: 'bottom', scrollY: 0,
      },
      {
        key: 'quick_stats',
        title: 'Stats de la Semaine',
        body: "Séances, volume total et streak quotidienne : tes chiffres de la semaine en un coup d'œil.",
        targetKey: 'home_quickstats', position: 'bottom', scrollY: 180,
      },
      {
        key: 'quests',
        title: 'Quêtes Quotidiennes',
        body: "Accomplis tes 3 quêtes du jour pour gagner de l'XP bonus. Complète-les toutes pour déclencher le bonus de combo !",
        targetKey: 'home_quests', position: 'top', scrollY: 380,
      },
      {
        key: 'home_ritual',
        title: 'Récupération Active',
        body: "Les jours sans séance, cette carte propose un rituel de récupération (étirements, respiration, yoga…). Complète-le pour gagner 20 XP et maintenir ta streak.",
        targetKey: 'home_ritual', position: 'top', scrollY: 560,
      },
    ],
  },

  // ─── CHAPITRE 2 : L'Entraînement ───────────────────────────────────────────
  {
    id: 'workout',
    title: "L'Entraînement",
    subtitle: 'Chapitre 2',
    icon: 'barbell-outline',
    tabName: 'Séances',
    steps: [
      {
        key: 'workout_intro',
        title: "Ton Espace Entraînement",
        body: "Ici tu retrouves tes séances sauvegardées et les templates prêts à l'emploi.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'workout_header',
        title: 'Créer une Séance',
        body: "Le bouton '+' crée une séance sur-mesure avec le Workout Builder.",
        targetKey: 'workout_header_actions', position: 'bottom', scrollY: 0,
      },
      {
        key: 'workout_start',
        title: 'Lancer un Template',
        body: "Appuie sur n'importe quel template pour le lancer directement. La séance démarre avec tous les exercices pré-configurés.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'workout_sets',
        title: 'Valider tes Séries',
        body: "Dans une séance active, entre le poids et les répétitions, puis coche pour valider. Chaque série rapporte de l'XP !",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'workout_anticheat',
        title: 'Séances Sérieuses Uniquement',
        body: "Athly récompense l'effort réel : une séance de moins de 5 minutes ne rapporte aucun XP. Tu peux quand même l'enregistrer - mais seules les séances complètes comptent pour ta streak.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'workout_complete',
        title: 'Terminer la Séance',
        body: "Appuie sur 'Terminer' pour calculer ton XP, détecter tes records et mettre à jour ta progression.",
        targetKey: null, position: 'center', scrollY: null,
      },
    ],
  },

  // ─── CHAPITRE 3 : Le Profil & la Vitrine ───────────────────────────────────
  {
    id: 'profile',
    title: 'Profil & Vitrine',
    subtitle: 'Chapitre 3',
    icon: 'person-outline',
    tabName: 'ProfileTab',
    stackScreen: 'ProfileMain',
    steps: [
      {
        key: 'profile_intro',
        title: "Ton Profil d'Athlète",
        body: "Chaque séance te fait gagner de l'XP. Monte de niveau pour débloquer des cadres, formes et thèmes exclusifs.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'profile_herocard',
        title: 'Carte de Niveau',
        body: "La barre de progression indique ta position entre le niveau actuel et le suivant. Ton rang évolue : Novice → Initié → Athlète → Warrior →…",
        targetKey: 'profile_herocard', position: 'bottom', scrollY: 0,
      },
      {
        key: 'profile_frame',
        title: 'Personnaliser ton Cadre',
        body: "Ces boutons te permettent de changer ton cadre (formes, couleurs), consulter la Roadmap des rangs et visiter la Salle des Trophées.",
        targetKey: 'profile_quickactions', position: 'bottom', scrollY: 0,
      },
      {
        key: 'profile_vitrine',
        title: 'Ta Vitrine de Trophées',
        body: "Ces 3 slots affichent tes trophées préférés. Appuie sur un slot vide pour choisir dans la Salle des Trophées.",
        targetKey: 'profile_vitrine', position: 'top', scrollY: 260,
      },
      {
        key: 'profile_titles',
        title: 'Tes Titres RPG',
        body: "Via le bouton 'Titres', équipe un titre affiché sous ton pseudo. 17 titres se débloquent en accomplissant des défis (records, séances Multi, entraide…).",
        targetKey: null, position: 'center', scrollY: 0,
      },
    ],
  },

  // ─── CHAPITRE 4 : La Salle des Trophées ────────────────────────────────────
  {
    id: 'trophies',
    title: 'Salle des Trophées',
    subtitle: 'Chapitre 4',
    icon: 'trophy-outline',
    tabName: 'ProfileTab',
    stackScreen: 'TrophyRoom',
    steps: [
      {
        key: 'trophies_intro',
        title: 'La Salle des Trophées',
        body: "60 trophées à débloquer, répartis en 9 catégories : Héritage, Force, Exploration, Secret, Corps, Régularité, Social, Spécial et Collection.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'trophies_filters',
        title: 'Filtrer par Catégorie',
        body: "Les onglets 'Force', 'Endurance' et 'Spécial' filtrent les trophées. Les trophées verrouillés montrent leur condition.",
        targetKey: 'trophies_filters', position: 'bottom', scrollY: 0,
      },
      {
        key: 'trophies_ultimate',
        title: 'Le Trophée Ultime',
        body: "Le 'Souverain Absolu' se débloque automatiquement quand les 60 autres trophées sont obtenus. Un accomplissement absolu.",
        targetKey: 'trophies_ultimate', position: 'bottom', scrollY: 0,
      },
      {
        key: 'trophies_pin',
        title: 'Mettre en Vitrine',
        body: "Appuie sur n'importe quel trophée débloqué puis choisis 'Mettre en avant sur le profil'. Jusqu'à 3 trophées simultanément dans ta vitrine.",
        targetKey: null, position: 'center', scrollY: null,
      },
    ],
  },

  // ─── CHAPITRE 5 : Inventaire, Coffres & Raretés ────────────────────────────
  {
    id: 'inventory',
    title: 'Coffres & Raretés',
    subtitle: 'Chapitre 5',
    icon: 'cube-outline',
    tabName: 'ProfileTab',
    stackScreen: 'Inventory',
    steps: [
      {
        key: 'inventory_intro',
        title: "L'Inventaire",
        body: "Chaque effort te récompense : boissons d'XP, gels de streak, boosts et coupons s'accumulent ici, prêts à être utilisés au bon moment.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'inventory_chest',
        title: 'Coffres à l\'Effort',
        body: "Tu gagnes un coffre toutes les 2 h de séance cumulées (débloqué au rang Initié, niveau 11). Ouvre-le pour tirer un objet au hasard.",
        targetKey: 'inventory_chest', position: 'bottom', scrollY: 0,
      },
      {
        key: 'inventory_rarities',
        title: '5 Raretés',
        body: "Du Commun (gris) au Légendaire (orange), en passant par Rare (bleu) et Épique (violet) : plus c'est rare, plus l'objet est puissant.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'inventory_unique',
        title: 'Le Rouge Sang Unique',
        body: "La rareté ultime : les cosmétiques Uniques Rouge Sang (cadre, couleur, thème) se méritent par des exploits rares et se réclament ici. Le prestige absolu.",
        targetKey: null, position: 'center', scrollY: null,
      },
    ],
  },

  // ─── CHAPITRE 6 : Social, Groupes & Multi ──────────────────────────────────
  {
    id: 'social',
    title: 'Amis, Groupes & Multi',
    subtitle: 'Chapitre 6',
    icon: 'people-outline',
    tabName: 'SocialTab',
    stackScreen: 'SocialHub',
    steps: [
      {
        key: 'social_intro',
        title: 'Progresse en Meute',
        body: "Athly est bien plus fort à plusieurs. Ajoute tes amis, compare-toi, et entraîne-toi en équipe.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'social_segments',
        title: 'Amis, Classement, Groupe',
        body: "Ces trois onglets réunissent ton réseau : tes amis, les classements (XP et records par exercice), et ton Groupe de Streak.",
        targetKey: 'social_segments', position: 'bottom', scrollY: 0,
      },
      {
        key: 'social_add',
        title: 'Ajouter un Ami',
        body: "Chaque joueur a un tag unique façon Discord (ex: Player#1234). Saisis-le pour envoyer une demande, après un aperçu de son profil.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'social_group',
        title: 'Groupes de Streak & Météo',
        body: "Formez un groupe (5 max) : si TOUS validez votre journée, la streak collective grimpe. La Météo des séances montre en direct qui est Prêt, Actif ou a Validé.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'social_shame',
        title: 'Hall of Shame & Secouer',
        body: "Si la streak de groupe casse, le dernier Briseur s'affiche dans le Hall of Shame. Le bouton 'Secouer' envoie une notif troll aux retardataires pour les motiver.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'social_multi',
        title: 'Le Mode Multi',
        body: "Invite des amis dans un Lobby Multi : vous démarrez la séance ensemble, chacun sur son écran. Terminer à plusieurs débloque un bonus d'XP de groupe (+15% à 2, jusqu'à +50% à 5).",
        targetKey: null, position: 'center', scrollY: null,
      },
    ],
  },

  // ─── CHAPITRE 7 : Les Statistiques ─────────────────────────────────────────
  {
    id: 'stats',
    title: 'Les Statistiques',
    subtitle: 'Chapitre 7',
    icon: 'stats-chart-outline',
    tabName: 'Stats',
    // useMockData = true → StatsScreen injecte les fausses données durant ce chapitre
    useMockData: true,
    steps: [
      {
        key: 'stats_intro',
        title: 'Tes Stats, Ton Miroir',
        body: "Cet écran agrège toutes tes performances. Pour te montrer à quoi ça ressemble, on a injecté de vraies fausses données !",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'stats_kpis',
        title: 'KPIs Clés',
        body: "Séances, sets validés et volume total pour la période sélectionnée. Change la période avec les boutons Semaine / Mois / Tout.",
        targetKey: 'stats_kpis', position: 'bottom', scrollY: 60,
      },
      {
        key: 'stats_weight',
        title: 'Suivi de Poids',
        body: "Le graphique double courbe suit ton poids réel vers ton objectif. Appuie sur 'Ajouter une pesée' pour l'actualiser et garder un suivi au top.",
        targetKey: 'stats_weight_chart', position: 'bottom', scrollY: 60,
      },
      {
        key: 'stats_volume',
        title: 'Graphique de Volume',
        body: "Ce graphique en barres montre la progression de ton volume d'entraînement semaine par semaine. Plus les barres montent, plus tu progresses.",
        targetKey: 'stats_volume_chart', position: 'top', scrollY: 180,
      },
      {
        key: 'stats_muscle',
        title: 'Répartition Musculaire',
        body: "Ce camembert révèle quels groupes musculaires tu travailles le plus. Un athlète complet équilibre tous les groupes.",
        targetKey: 'stats_muscle_chart', position: 'top', scrollY: 380,
      },
      {
        key: 'stats_history',
        title: "L'Historique des Séances",
        body: "L'onglet 'Historique' regroupe chaque séance avec sa date, son volume et ses sets. Le tutoriel bascule automatiquement sur cet onglet.",
        targetKey: 'stats_tab_history', position: 'bottom', scrollY: 0,
        autoAction: 'switchToHistory',
      },
    ],
  },

  // ─── CHAPITRE 8 : Réglages ──────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Réglages & Compte',
    subtitle: 'Chapitre 8',
    icon: 'settings-outline',
    tabName: 'ProfileTab',
    stackScreen: 'Settings',
    steps: [
      {
        key: 'settings_intro',
        title: 'Réglages & Compte',
        body: "Personnalise tes unités, modifie ton profil et explore les thèmes visuels débloqués avec ta progression.",
        targetKey: null, position: 'center', scrollY: 0,
      },
      {
        key: 'settings_themes',
        title: 'Thèmes de Profil',
        body: "Choisis un thème pour personnaliser la couleur d'accent. Les thèmes avancés (Warrior, Élite, Légende…) nécessitent le niveau correspondant.",
        targetKey: 'settings_themes', position: 'bottom', scrollY: 200,
      },
      {
        key: 'settings_roadmap',
        title: 'Roadmap des Rangs',
        body: "Accède à la Roadmap (bouton Roadmap sur ton profil) pour voir toutes les récompenses visuelles à chaque palier : cadres, formes et effets animés.",
        targetKey: null, position: 'center', scrollY: null,
      },
      {
        key: 'settings_done',
        title: 'Tu es prêt, Athlète !',
        body: "Tu maîtrises désormais Athly. Lance-toi - chaque set te rapproche du sommet. Bonne chance !",
        targetKey: null, position: 'center', scrollY: null,
        isLast: true,
      },
    ],
  },
];

export const CHAPTER_MAP = Object.fromEntries(TUTORIAL_CHAPTERS.map((c) => [c.id, c]));
export const CHAPTER_IDS = TUTORIAL_CHAPTERS.map((c) => c.id);
