<div align="center">

# ATHLY : Application Mobile de Fitness Gamifiée

**React Native, Expo, PWA. Stockage local AsyncStorage, gamification complète, social et multijoueur**

![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![React Navigation](https://img.shields.io/badge/React_Navigation-7-6b52ae?style=flat-square)
![AsyncStorage](https://img.shields.io/badge/Stockage-AsyncStorage-34D399?style=flat-square)
![Axios](https://img.shields.io/badge/Axios-1.18-5A29E4?style=flat-square)

Athly transforme chaque séance d'entraînement en expérience de jeu : XP, niveaux, streaks, quêtes quotidiennes, trophées, titres RPG, coffres à ouvrir, groupes d'amis avec streak collective, lobby multijoueur, et un tutoriel interactif qui accompagne la découverte de toutes ces fonctionnalités.

</div>

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Fonctionnalités](#fonctionnalités)
3. [Stack technique](#stack-technique)
4. [Architecture](#architecture)
5. [Installation et lancement](#installation-et-lancement)
6. [Variables d'environnement](#variables-denvironnement)
7. [Structure du projet](#structure-du-projet)
8. [Navigation](#navigation)
9. [Contextes React](#contextes-react)
10. [Services](#services)
11. [Catalogues de données](#catalogues-de-données)
12. [Système de gamification](#système-de-gamification)
13. [Tutoriel interactif](#tutoriel-interactif)
14. [Paramètres développeur](#paramètres-développeur)
15. [Tests](#tests)
16. [Backend associé](#backend-associé)

---

## Vue d'ensemble

Athly est une application mobile construite avec React Native et Expo, également buildée en PWA pour le web. Elle nécessite une connexion Internet et un compte pour fonctionner : l'authentification (mot de passe, Google OAuth, vérification email) passe obligatoirement par le backend. Une fois connecté, les données de progression immédiate (logs de séances, XP cumulatif, streak, quêtes, rituels) sont calculées et stockées localement dans AsyncStorage pour des performances instantanées, tandis que le backend fait autorité pour le profil, le social, l'inventaire et le multijoueur.

### Philosophie

| Principe | Description |
|----------|--------------|
| Backend requis | L'authentification nécessite une connexion réseau. Sans elle, l'application n'est pas utilisable. |
| Données de séance locales | Logs, XP, streak, quêtes et rituels vivent dans AsyncStorage, les calculs se font entièrement côté client. |
| Synchronisation best effort | L'XP totale est poussée vers le backend (`POST /users/me/sync-xp`) à chaque événement clé, avec ratchet anti-régression côté serveur. Un échec réseau ne bloque jamais l'utilisateur, un retry automatique a lieu au prochain événement. |
| Social et multijoueur sur backend | Amis, groupes de streak, lobby, inventaire, titres et trophées serveur sont gérés en direct par l'API : ils nécessitent le réseau. |
| Gamification profonde | Chaque séance rapporte de l'XP, alimente une streak, valide des quêtes, peut débloquer des trophées et des titres. |
| Anti-triche intégré | Une séance de moins de 5 minutes ne rapporte aucun XP, ne valide aucune quête et n'incrémente pas la streak. Entre 5 et 15 minutes, l'XP est divisé par 10. Le serveur applique la même règle à la finalisation. |
| Récupération active | Les jours sans séance, 5 rituels permettent de maintenir la streak. |

---

## Fonctionnalités

### Gestion des séances

Timer en temps réel, saisie poids et répétitions par série, supersets, notes par séance et par exercice, Workout Builder pour générer une séance sur mesure à partir d'un catalogue de plus de 350 exercices, création manuelle exercice par exercice, exercices personnalisés persistés localement, séances sauvegardées comme modèles réutilisables (modifiables après coup, avec les mêmes critères de génération pré-remplis), récapitulatif complet post-séance (volume, XP gagné, nouveaux records, quêtes validées).

### Anti-triche

Une séance finalisée en moins de 5 minutes déclenche une modale d'avertissement. L'utilisateur peut modifier la séance ou forcer la validation : dans ce cas, l'XP gagné est nul, la séance est marquée `shortSession`, aucune quête n'est validée et la streak n'est pas incrémentée. Le backend applique la même logique à la finalisation, indépendamment du client.

### Gamification

XP et niveaux sur une courbe exponentielle, streak avec 8 paliers de multiplicateur jusqu'à 7 fois l'XP de base, 3 quêtes quotidiennes tirées parmi 20 modèles de façon déterministe par la date (tout le monde a les mêmes quêtes le même jour), rangs de Novice à ATHLY GOD, catalogue de plus de 60 trophées réparti en 9 catégories, 17 titres RPG déblocables et équipables sous le pseudo.

### Coffres et inventaire

Un coffre toutes les 2 heures de séance cumulées, débloqué au rang Initié (niveau 11). Ouverture avec animation, table de drop par rareté (commune, rare, épique, légendaire, unique), objets consommables (boissons d'XP, gels de streak, boosts de multiplicateur, coupons de niveau), cosmétiques Unique Rouge Sang réclamables sous conditions rares.

### Social

Ajout d'ami par tag unique façon Discord, aperçu de profil avant envoi de la demande, classement XP entre amis, classement par exercice, profil public consultable, niveaux d'amitié progressifs, flux d'activité avec réactions (bravo, respect, hue, jaloux) sur les records et coffres légendaires des amis.

### Groupes de streak

Groupe de 5 membres maximum, invitations, streak collective (validée si tous les membres valident leur journée), météo des séances en direct (statut prêt, actif, validé de chaque membre), bouton Secouer pour relancer un retardataire par notification, Hall of Shame si la streak casse, récompense cosmétique Unique à 30 jours de streak collective à taille maximale.

### Lobby multijoueur

Invitation d'amis pour démarrer une séance ensemble, chacun sur son propre appareil, bonus d'XP de groupe croissant selon le nombre de participants (15 à 50 pour cent).

### Statistiques

Volume total, sets complétés, répartition musculaire en camembert, graphe de progression par exercice, suivi de poids avec objectif et rappel hebdomadaire, historique complet des séances avec filtres, détection automatique des nouveaux records personnels.

### Profil et personnalisation

Données physiques, équipements disponibles, cadre de profil personnalisable (forme et couleur), thèmes visuels débloqués par la progression, vitrine de trophées et de records mis en avant, roadmap des rangs, célébration d'anniversaire, système de parrainage avec récompenses pour les deux parties, suppression de compte RGPD en cascade.

### Tutoriel interactif

Système de spotlight en huit chapitres qui met en surbrillance les éléments réels de l'interface, avec démonstrations en direct, auto-scroll vers les éléments ciblés, et persistance de la complétion à la fois localement et côté serveur pour une cohérence entre appareils.

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | React Native | 0.81.5 |
| Runtime React | React | 19.1.0 |
| Environnement | Expo | 54.x |
| Navigation | React Navigation (native, bottom-tabs, stack, native-stack) | 7.x |
| Stockage local | AsyncStorage | 2.2.0 |
| Token sécurisé | Expo SecureStore | 15.x |
| HTTP client | Axios | 1.18 |
| Animations | Lottie React Native | 7.3.1 |
| Graphiques | React Native Chart Kit | 6.12 |
| SVG | React Native SVG | 15.12 |
| Icônes | Expo Vector Icons (Ionicons) | 15.x |
| Haptique | Expo Haptics | 15.x |
| Dégradés | Expo Linear Gradient | 15.x |
| Gestes | React Native Gesture Handler | 2.28 |
| Notifications | Expo Notifications | 0.32 |
| Authentification Google | Expo Auth Session | 7.x |
| Support web | React Native Web | 0.19 |
| Variables d'environnement | react-native-dotenv | 3.x |
| Tests | Jest, Babel Jest | 29.x |

---

## Architecture

### Répartition backend et stockage local

```
Nécessite le backend, réseau requis
  - Connexion, inscription, réinitialisation de mot de passe, connexion Google
  - Profil utilisateur, cadre équipé, vitrines
  - Amis, groupes de streak, lobby multijoueur, inventaire, coffres
  - Titres RPG, trophées serveur, parrainage, anniversaire
  - Synchronisation de l'XP totale (best effort, ne bloque jamais)

Stocké localement (AsyncStorage)
  - Logs de séances, XP cumulatif, streak
  - Quêtes quotidiennes et état du bonus
  - Rituels de récupération
  - Exercices personnalisés, séances sauvegardées
  - Progression et complétion du tutoriel interactif
  - Paramètres développeur (God Mode, bypass anti-triche)
```

### Arbre de providers

```
NavigationContainer
  TutorialProvider
    UserProvider
      WorkoutLogsProvider
        SavedWorkoutsProvider
          CustomExercisesProvider
            QuestProvider
              AuthStack (non connecté)
              ou BottomTabs (connecté), avec en overlay :
                BirthdayCelebration, LevelUpCelebration,
                ActivityFeedModal, WeightReminderCheck, LobbyInviteCheck
```

### Finalisation d'une séance

```
handleTerminate()
  elapsed < 5 minutes et bypass non activé
    -> ShortSessionWarningModal
       Modifier : retour à la séance
       Forcer : finalise avec shortSession = true

  finalizeWithLog(...)
    buildLogFromWorkout()      calcule XP, volume, répartition musculaire
    shortSession ? xpEarned = 0 : calcul normal avec multiplicateur de streak
    workoutLogs.create(log)    écriture AsyncStorage, toujours exécutée
    !shortSession -> questContext.checkAndUpdateQuests()
    actions.finalize()         synchronisation backend, best effort
    xpSync.service -> POST /users/me/sync-xp avec le nouveau total
```

---

## Installation et lancement

### Prérequis

- Node.js 18 ou supérieur
- Expo CLI (`npm install -g expo-cli`)
- Expo Go sur un téléphone, ou un simulateur iOS ou Android, ou un navigateur pour la version web

### Étapes

```bash
git clone https://github.com/ClemLy/Athly.git
cd Athly/front

npm install

cp .env.example .env
# Éditer .env avec l'URL de votre backend, voir la section suivante

npm start          # Metro bundler, QR code Expo Go
npm run android    # émulateur Android
npm run ios        # simulateur iOS, macOS requis
npm run web        # navigateur
npm run build:web  # build PWA de production (expo export puis copie du service worker)
```

---

## Variables d'environnement

```env
# URL de l'API backend. En développement local, utiliser l'IP de la machine
# sur le réseau local, jamais "localhost" : un téléphone physique ne peut pas
# le résoudre.
API_URL=http://VOTRE_IP_LOCALE:4000/api

# Clé de stockage du token JWT dans Expo SecureStore
TOKEN_KEY=athly_token

# development ou production
APP_ENV=development

# Client IDs Google OAuth (un par plateforme, type d'application différent
# pour chacun). Tant qu'ils ne sont pas renseignés, le bouton Google reste
# désactivé côté client.
GOOGLE_EXPO_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_WEB_CLIENT_ID=
```

Trouver son IP locale : `ipconfig` sous Windows, `ifconfig` ou `ip addr` sous macOS et Linux.

---

## Structure du projet

```
front/
  index.js                 Point d'entrée Expo
  App.js                   Composant racine, wrapping des providers
  app.json                 Configuration Expo, y compris la PWA
  eas.json                 Profils de build EAS
  web/index.html            Shell HTML pour le build web

  assets/

  src/
    api/
      api.js                Instance Axios : injection du JWT, gestion du 401

    context/                9 contextes React
      AuthContext.js
      UserContext.js
      WorkoutInProgressContext.js
      WorkoutLogsContext.js
      CustomExercisesContext.js
      SavedWorkoutsContext.js
      QuestContext.js
      TutorialContext.js
      ToastContext.js

    screens/                21 écrans
      Auth/                 Login, Register, EmailVerification, ForgotPassword
      Home/                 HomeScreen
      Workouts/             WorkoutList, Workout, Builder, ManualCreator,
                             ExerciseDetail, ExerciseStats, EditExercise,
                             CustomExercises
      Social/                SocialScreen, FriendProfileScreen
      Stats/                 StatsScreen
      Profile/               Profile, EditProfile, Settings, RankRoadmap,
                              TrophyRoom, Inventory

    components/             Organisés par domaine
      home/                  Cartes du tableau de bord, rituels de récupération
      workouts/              Feuille d'ajout d'exercice, lobby multijoueur,
                              modale de sauvegarde, avertissement anti-triche
      cards/                 Cartes d'exercices réutilisables
      profile/               Cadre d'avatar, vitrine de trophées, célébrations
      social/                Modales d'amis, de groupe, flux d'activité
      inventory/              Modale d'ouverture de coffre
      stats/                  Graphiques, calendrier, historique
      tutorial/                Overlay du tutoriel interactif
      common/                  Modales partagées, barrel d'export
      inputs/, ui/, web/       Composants transverses

    services/                Barrel d'export unique, 17 fichiers
      stats.service.js        XP, streak, logs AsyncStorage, source de vérité locale
      quest.service.js        Modèles de quêtes, sélection déterministe du jour
      auth.service.js, workouts.service.js, savedWorkouts.service.js,
      customExercises.service.js, social.service.js, inventory.service.js,
      reward.service.js, title.service.js, weight.service.js,
      xpSync.service.js, onboarding.service.js, profile.service.js,
      lobby.service.js, debug.service.js, haptics.service.js,
      notificationService.js

    hooks/                   Barrel d'export unique
      useWorkoutState.js       Pattern reducer pour l'état de séance en cours
      useEffortTimer.js         Chronomètre de séance
      useDevSettings.js         Paramètres God Mode
      useExerciseSorting.js
      useAvatarFrame.js
      useFeaturedTrophies.js
      useGoogleAuth.js

    data/                    Catalogues statiques
      exerciseCatalog.js        Plus de 350 exercices avec muscles ciblés
      trophyCatalog.js          Catalogue local de trophées et filtres
      backendTrophyCategories.js Correspondance des catégories serveur
      tutorialChapters.js       8 chapitres du tutoriel interactif
      workoutTemplates.js       Programmes prédéfinis
      ritualTypes.js            5 rituels de récupération
      profileThemes.js          Thèmes visuels du profil
      majorExercises.js         Exercices de référence pour les classements

    navigation/
      index.js                AppNavigator : bascule Auth ou App, providers globaux
      AuthStack.js
      BottomTabs.js            5 onglets
      WorkoutStack.js
      ProfileStack.js
      SocialStack.js

    constants/
      theme.js                 Jetons de design (Colors, MUSCLE_GROUP_COLORS)
      exerciseFilters.js        Correspondance muscles et équipements
```

---

## Navigation

```
AppNavigator (racine)
  Non connecté : AuthStack
    Auth (LoginScreen)
    Register
    EmailVerification
    ForgotPassword

  Connecté : BottomTabs, 5 onglets
    Accueil          HomeScreen
    Séances          WorkoutStack
      WorkoutList, WorkoutBuilder, ManualWorkoutCreator, CustomExercises,
      EditExercise, Workout (séance en cours), ExerciseDetail, ExerciseStats
    Stats            StatsScreen
    SocialTab        SocialStack
      SocialHub, FriendProfile
    ProfileTab       ProfileStack
      ProfileMain, EditProfile, RankRoadmap, TrophyRoom, Settings, Inventory
```

---

## Contextes React

### WorkoutLogsContext

Source de vérité principale pour l'historique de séances, persistée dans AsyncStorage. Expose la liste complète des logs, les logs de séances seules, les logs comptant pour la streak, l'XP cumulatif, ainsi que les opérations de création, suppression et ajout de rituel.

### QuestContext

Les 3 quêtes du jour, le nombre complété, l'état du bonus, et la fonction qui évalue une séance terminée contre les quêtes actives.

### TutorialContext

Machine à états du tutoriel interactif : chapitre actif, étape courante, cibles enregistrées par les écrans, fonctions de scroll et de re-mesure, complétion locale et réconciliation avec le flag serveur.

### WorkoutInProgressContext

État de la séance en cours (reducer), actions d'ajout et de modification de sets et d'exercices, et la fonction `finalize` qui orchestre le log local, la validation des quêtes et la synchronisation backend.

### UserContext

Profil utilisateur courant, récupéré depuis le backend, avec fonction de rafraîchissement.

### AuthContext

Token JWT, état de chargement initial, connexion et déconnexion.

### SavedWorkoutsContext, CustomExercisesContext

CRUD des séances sauvegardées et des exercices personnalisés, persistés dans AsyncStorage.

### ToastContext

File de notifications toast affichées en overlay.

---

## Services

Tous les services sont exposés via un barrel unique (`src/services/index.js`), ce qui permet des imports courts comme `import { getFriendsList, haptics } from '../services'`.

### stats.service.js

Le service le plus important : gestion complète des logs AsyncStorage, calcul de l'XP par séance, du streak, du multiplicateur, du niveau, des rangs, de la répartition musculaire, détection des nouveaux records.

### quest.service.js

Chargement des quêtes du jour, sélection déterministe par hash de date parmi 20 modèles, vérification et marquage de complétion.

### workouts.service.js

Cycle de vie côté backend des séances : création de brouillon, mise à jour, finalisation, complétion.

### api.js

Instance Axios : URL de base depuis `.env`, timeout, injection automatique du Bearer token, et sur une réponse 401, déconnexion automatique avec message de session expirée.

---

## Catalogues de données

### exerciseCatalog.js

Plus de 350 exercices, chacun avec son groupe musculaire, son muscle cible principal, ses muscles secondaires, son équipement requis, son niveau de difficulté, et un indicateur de mouvement composé ou d'isolation.

### trophyCatalog.js

40 trophées locaux répartis en 8 catégories (Héritage, Force, Exploration, Secret, Corps, Régularité, Social, Spécial), plus le trophée capstone Souverain Absolu. Combiné avec les 20 trophées serveur (catégorie Collection notamment), le total dépasse 60 trophées répartis en 9 catégories affichées dans la Salle des Trophées.

### tutorialChapters.js

8 chapitres correspondant aux grands écrans de l'application : Dashboard, Entraînement, Profil et Vitrine, Salle des Trophées, Inventaire, Social, Statistiques, Réglages.

### ritualTypes.js

5 rituels de récupération active.

| Rituel | Mécanique | XP |
|--------|-----------|-----|
| Mobilité et souplesse | Minuteur de 5 minutes | 20 |
| Marche quotidienne | Minuteur de 15 minutes | 100 |
| Respiration et mental | Cercle animé inspire et expire, 5 minutes | 20 |
| Automassage | 5 zones d'une minute chacune | 20 |
| Focus et culture | Article à lire, minuteur bloquant de 5 minutes | 20 |

Un rituel maximum par jour calendaire. Compte pour la streak au même titre qu'une séance, et son XP n'est pas soumis au plafond quotidien.

---

## Système de gamification

### Calcul de l'XP par séance

```javascript
// Par exercice, calculé en local (stats.service.js)
xp += setsCompleted * 10 + (volume * multiplicateur) / 20
// multiplicateur = 1.2 si l'exercice est un mouvement composé, sinon 1

// Multiplicateur de streak appliqué au total
xpEarned = round(xp * streakMultiplier)

// Anti-triche temporel
// moins de 5 minutes, forcé : xpEarned = 0
// entre 5 et 15 minutes : xpEarned = xpEarned / 10
// 15 minutes ou plus : XP plein
```

### Niveaux

```javascript
xpForLevel(n) = round(4665 * (1.03 ** min(n, 200) - 1))
// niveau 1 environ 140 XP, niveau 10 environ 1600 XP,
// niveau 100 environ 85 000 XP, niveau 200 environ 1 720 000 XP
```

### Multiplicateurs de streak

| Streak | Multiplicateur | Label |
|--------|-----------------|-------|
| 0 jour | x1.0 | |
| 3 jours | x1.1 | On Fire |
| 7 jours | x1.2 | Week Warrior |
| 30 jours | x1.5 | Godly Streak |
| 90 jours | x2.0 | 3 Mois de Feu |
| 180 jours | x3.0 | Semi-Annuel |
| 365 jours | x4.5 | Streak Annuel |
| 730 jours | x7.0 | Streak Légendaire |

### Quêtes quotidiennes

3 quêtes sélectionnées chaque jour parmi 20 modèles, par un hash déterministe de la date : tout le monde reçoit les mêmes quêtes le même jour. Compléter une quête rapporte de l'XP, compléter les 3 déclenche un bonus supplémentaire avec animation.

### Rangs

Novice, Initié à partir du niveau 11, Athlète à 31, Compétiteur à 51, Warrior à 71, Élite à 91, Maître à 111, Grand Maître à 141, Légende à 171, ATHLY GOD à 200.

---

## Tutoriel interactif

Système de spotlight en 8 chapitres, un par grande zone de l'application. Chaque étape peut cibler un élément réel de l'écran (mesuré dynamiquement via `useTutorialTarget`) ou afficher une carte centrée, avec positionnement automatique du texte au-dessus ou en dessous de la cible selon l'espace disponible. Auto-scroll vers les éléments hors champ, indicateur de progression Chapitre X sur N, retour haptique sur les actions de navigation. La complétion est persistée à la fois dans AsyncStorage pour une reprise immédiate, et côté serveur (`hasCompletedOnboarding`) pour rester cohérente entre appareils. Rejouable à tout moment depuis les Réglages, chapitre par chapitre.

---

## Paramètres développeur (God Mode)

Accessibles depuis Réglages, section God Mode.

| Réglage | Effet |
|---------|-------|
| God Mode | Bascule générale utilisée par plusieurs outils de test |
| Bypass anti-triche 5 minutes | Ignore le seuil de durée minimale d'une séance |
| Forcer l'affichage des rituels | Affiche la carte de rituels même après une séance déjà faite |
| Overrides de trophées | Force le déblocage ou le verrouillage d'un trophée pour le tester |

Persistés dans AsyncStorage, rechargés à chaque focus de l'écran concerné.

---

## Tests

```bash
npm test
```

3 suites Jest sur les modules JS purs (données et services sans dépendance React Native), exécutées via Babel en environnement Node : intégrité structurelle du catalogue de chapitres du tutoriel, non-régression des rituels de récupération, comportement du service de synchronisation d'XP.

---

## Backend associé

Ce dépôt frontend communique avec l'API Athly Backend, dans le dossier `back/` du même dépôt. Le backend gère l'authentification, le profil, le social (amis, groupes, lobby), l'inventaire et les coffres, les titres et trophées serveur, le parrainage, ainsi que la synchronisation de l'XP. Voir `back/README.md` pour l'installation et la documentation complète de l'API.

L'application nécessite le backend pour l'authentification et pour toutes les fonctionnalités sociales et multijoueur. Les données de séance immédiates (logs, XP local, quêtes, rituels) restent utilisables même en cas de coupure réseau temporaire, la synchronisation reprenant automatiquement au retour du réseau.

---

<div align="center">

Athly Front : React Native, Expo, PWA. Local first pour l'entraînement, backend pour le social.

</div>
