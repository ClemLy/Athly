<div align="center">

# 🏋️ ATHLY — Application Mobile de Fitness Gamifiée

**Tracker d'entraînement React Native · Stockage local AsyncStorage · Gamification complète**

![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)
![Expo](https://img.shields.io/badge/Expo-54.0.27-000020?style=flat-square&logo=expo)
![TypeScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square&logo=javascript)
![AsyncStorage](https://img.shields.io/badge/Stockage-AsyncStorage-34D399?style=flat-square)
![Axios](https://img.shields.io/badge/Axios-1.16.0-5A29E4?style=flat-square)

> Athly transforme chaque séance d'entraînement en une expérience de jeu. XP, streaks, quêtes quotidiennes, trophées, rituels de récupération — progresser n'a jamais été aussi addictif.

</div>

---

## 📋 Table des matières

1. [Vue d'ensemble](#-vue-densemble)
2. [Fonctionnalités](#-fonctionnalités)
3. [Stack technique](#-stack-technique)
4. [Architecture](#-architecture)
5. [Installation & lancement](#-installation--lancement)
6. [Variables d'environnement](#-variables-denvironnement)
7. [Structure du projet](#-structure-du-projet)
8. [Système de gamification](#-système-de-gamification)
9. [Contextes React](#-contextes-react)
10. [Services](#-services)
11. [Navigation](#-navigation)
12. [Composants clés](#-composants-clés)
13. [Backend associé](#-backend-associé)

---

## 🎯 Vue d'ensemble

Athly est une application mobile de fitness construite avec React Native (Expo). L'application **nécessite une connexion Internet et un compte** pour fonctionner : l'authentification passe par le backend (JWT). Une fois connecté, toutes les données de progression (logs de séances, XP, quêtes, rituels) sont stockées localement dans AsyncStorage sur l'appareil pour des performances optimales, et synchronisées avec le backend en best-effort.

### Philosophie

| Principe | Description |
|----------|-------------|
| **Backend requis** | L'authentification (connexion, inscription, reset password) nécessite une connexion au backend. Sans réseau, l'app n'est pas utilisable. |
| **Données locales** | Une fois connecté, les logs de séances, XP, quêtes et rituels sont stockés dans AsyncStorage — les calculs se font entièrement côté client. |
| **Sync best-effort** | La finalisation d'une séance tente une sync backend, mais l'échec ne bloque pas l'utilisateur. Les données locales font foi. |
| **Gamification profonde** | Chaque séance rapporte des XP, alimente une streak, valide des quêtes et peut débloquer des trophées. |
| **Anti-triche intégré** | Une séance < 5 min ne rapporte aucun XP, ne valide pas les quêtes et n'incrémente pas la streak. |
| **Récupération active** | Les jours sans séance, 5 rituels de récupération permettent de maintenir la streak (+20 à +100 XP). |

---

## ✨ Fonctionnalités

### 🏋️ Gestion des séances
- **Timer en temps réel** pendant l'entraînement avec chronomètre visible
- **Sets & reps** : saisie poids/reps pour chaque exercice, validation par set
- **Supersets** : regroupement de plusieurs exercices en circuit
- **Notes** par séance et par exercice
- **Workout Builder** : créer des séances à partir d'un catalogue de 100+ exercices
- **Exercices personnalisés** : créer et gérer ses propres mouvements (persistés localement)
- **Séances favorites** : sauvegarder et réutiliser ses programmes
- **WorkoutRecapModal** : récapitulatif complet post-séance (volume, XP gagné, nouveaux PRs, quêtes validées)

### 🛡️ Système Anti-triche (5 minutes)
- Une séance finalisée en **< 5 minutes** déclenche une modale d'avertissement
- L'utilisateur peut choisir de **continuer** ou de **forcer la validation**
- En cas de forçage : `xpEarned = 0`, flag `shortSession: true`, **aucune quête validée**, **aucun incrément de streak**
- **God Mode** : toggle en paramètres développeur pour bypasser le check

### 🎮 Gamification

#### XP & Niveaux
- Chaque séance rapporte de l'XP calculé sur le volume, le nombre de sets et le multiplicateur de streak
- Courbe de progression **exponentielle** (base 4665, taux 1.03)
- Cap quotidien : **2 séances XP/jour** maximum (anti-farming)
- Les rituels de récupération ne comptent pas dans le cap quotidien

#### Streak
- La streak s'incrémente si au moins **1 log valide** (pas `shortSession`) est posé dans la journée
- Les rituels de récupération comptent pour la streak
- **8 paliers de multiplicateur** : jusqu'à ×7.0 à 730 jours consécutifs

#### Quêtes quotidiennes
- **3 quêtes** tirées parmi 20 templates, déterministes par la date (reproductibles)
- Exemples : "Faire 25 séries", "Terminer en < 45 min", "Travailler les jambes", "Battre un PR"
- Compléter les 3 quêtes débloque un **bonus de 1000 XP supplémentaires**
- Les séances `shortSession` ne valident **aucune** quête

#### Trophées
- **50+ trophées** catégorisés (Régularité, Volume, Force, Diversité, Spéciaux)
- Évaluation automatique post-séance et au chargement du profil
- **Trophy Room** : galerie avec états verrouillé/débloqué, animations

### 🧘 Rituels de Récupération Active
5 rituels disponibles les jours sans séance (ou en complément) :

| Rituel | Mécanique | XP |
|--------|-----------|-----|
| **Mobilité & Souplesse** | Timer 5 min | +20 XP |
| **Marche Quotidienne** | Timer 15 min | +100 XP |
| **Respiration & Mental** | Cercle animé inspire/expire · 5 min | +20 XP |
| **Automassage** | 5 zones × 1 min (Mollets → Épaules) | +20 XP |
| **Focus & Culture** | Article à lire · timer 5 min bloquant | +20 XP |

- 1 rituel maximum par jour calendaire
- Compte pour la streak (même valeur qu'une vraie séance)
- XP non soumis au cap quotidien de 2 séances

### 📊 Statistiques
- Volume total, sets complétés, distribution musculaire (camembert)
- Graphe de progression par exercice (LineChart)
- Historique complet des séances avec filtres et tri
- Nouveaux PRs (Personal Records) détectés automatiquement après chaque séance

### 🎓 Tutoriel interactif
- Système **step-by-step** avec overlay semi-transparent
- Met en surbrillance les éléments de l'UI ciblés
- Auto-scroll vers les éléments mis en avant
- Chapitres : **Dashboard** (6 étapes) + **Workout** (6 étapes)
- Inclut une étape dédiée au système anti-triche et aux rituels

### 👤 Profil & Personnalisation
- Données physiques (poids, taille, âge, objectif, rythme)
- Équipements disponibles pour la recommandation d'exercices
- **Thèmes de profil** : plusieurs palettes visuelles
- Suppression de compte RGPD (cascade sur toutes les données)

---

## 🛠 Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | React Native | 0.81.5 |
| Environnement | Expo | ~54.0.27 |
| Navigation | React Navigation | 7.x |
| Stockage local | AsyncStorage | 2.2.0 |
| Token sécurisé | Expo SecureStore | ~15.0.8 |
| HTTP client | Axios | ^1.16.0 |
| Animations | Lottie React Native | ~7.3.1 |
| Graphiques | React Native Chart Kit | ^6.12.2 |
| SVG | React Native SVG | 15.12.1 |
| Icônes | @expo/vector-icons (Ionicons) | ^15.0.3 |
| Haptics | Expo Haptics | ~15.0.8 |
| Gradients | Expo Linear Gradient | ~15.0.8 |
| Gestures | React Native Gesture Handler | ~2.28.0 |

---

## 🏗 Architecture

### Répartition backend / stockage local

```
┌───────────────────────────────────────────────────────────────┐
│                 NÉCESSITE LE BACKEND (réseau requis)           │
│  • Connexion / Inscription / Reset password                   │
│  • Récupération du profil utilisateur                         │
│  • Catalogue d'exercices WGER                                 │
│  • Sync séances (best-effort, ne bloque pas si KO)            │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│              STOCKÉ LOCALEMENT (AsyncStorage)                  │
│  • Logs de séances, XP cumulatif, streak                      │
│  • Quêtes quotidiennes et état bonus                          │
│  • Rituels de récupération                                    │
│  • Exercices personnalisés, séances favorites                 │
│  • Paramètres développeur (God Mode, bypass…)                 │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    COMPOSANT UI                      │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              CONTEXT (état global React)             │
│  WorkoutLogsContext · QuestContext · TutorialContext │
└───────────┬─────────────────────────┬───────────────┘
            │ read/write              │ best-effort
┌───────────▼──────────┐    ┌─────────▼──────────────┐
│   AsyncStorage       │    │    API Backend          │
│   (source de vérité  │    │    (auth + sync)        │
│    pour les logs)    │    │                         │
└──────────────────────┘    └────────────────────────-┘
```

### Finalisation d'une séance (WorkoutInProgressContext)

```
handleTerminate()
  │
  ├── elapsed < 5 min && !bypassAnticheat ?
  │       └── ShortSessionWarningModal
  │               ├── "Modifier" → retour séance
  │               └── "Forcer" → finalizeWithLog({ shortSession: true })
  │
  └── finalizeWithLog({ durationSeconds, notes, ... })
          │
          ├── buildLogFromWorkout()  // calcul XP, volume, muscleDistribution
          ├── shortSession ? xpEarned = 0 : normal
          ├── workoutLogs.create(log)  // AsyncStorage (toujours)
          ├── !shortSession → questContext.checkAndUpdateQuests()
          └── bundle.actions.finalize()  // sync backend (best-effort)
```

---

## 🚀 Installation & lancement

### Prérequis

- Node.js ≥ 18
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go sur votre téléphone (iOS ou Android) **ou** un émulateur

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/ClemLy/Athly.git
cd Athly/front

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec l'URL de votre backend (voir section suivante)

# 4. Lancer le serveur de développement
npm start

# Alternatives ciblées
npm run android   # Lancer sur émulateur Android
npm run ios       # Lancer sur simulateur iOS (macOS requis)
npm run web       # Lancer dans le navigateur
```

Expo affichera un QR code à scanner avec Expo Go sur votre téléphone.

---

## 🔑 Variables d'environnement

Créer un fichier `.env` à la racine de `athly-app/` :

```env
# URL de l'API backend (remplacer par votre IP locale en développement)
API_URL=http://VOTRE_IP_LOCALE:4000/api

# Clé de stockage du token JWT dans SecureStore
TOKEN_KEY=athly_token

# Environnement (development | production)
APP_ENV=development
```

> **Important :** En développement local, utilisez votre adresse IP sur le réseau local (pas `localhost` — React Native ne peut pas résoudre `localhost` sur téléphone physique).

---

## 📁 Structure du projet

```
athly-app/
├── index.js                    # Point d'entrée Expo
├── App.js                      # Root : providers + navigation
├── app.json                    # Configuration Expo
├── .env                        # Variables d'environnement
│
├── assets/
│   ├── icon.png, adaptive-icon.png, splash-icon.png
│   ├── logo-orange.png, logo-violet.png
│   └── animations/
│       └── confetti.json       # Animation Lottie (quête bonus)
│
└── src/
    ├── api/
    │   └── api.js              # Instance Axios (JWT auto-inject, 401 handler)
    │
    ├── context/                # État global React (9 contextes)
    │   ├── AuthContext.js
    │   ├── UserContext.js
    │   ├── WorkoutInProgressContext.js
    │   ├── WorkoutLogsContext.js
    │   ├── CustomExercisesContext.js
    │   ├── SavedWorkoutsContext.js
    │   ├── QuestContext.js
    │   ├── TutorialContext.js
    │   └── ToastContext.js
    │
    ├── screens/                # 23 écrans
    │   ├── Auth/               # AuthScreen, Login, Register, Verify, ForgotPassword
    │   ├── Home/               # HomeScreen
    │   ├── Workouts/           # WorkoutScreen, Builder, List, Detail, ExerciseStats…
    │   ├── Profile/            # Profile, Edit, Settings, RankRoadmap, TrophyRoom
    │   └── Stats/              # StatsScreen
    │
    ├── components/             # 47 composants réutilisables
    │   ├── home/               # DailyQuestsCard, RecoveryRitualsCard, QuickStatsRow…
    │   ├── workouts/           # SetTable, AddExerciseSheet, ShortSessionWarningModal…
    │   ├── cards/              # ExerciseCard, WorkoutItem, StatBox…
    │   ├── profile/            # TrophyGrid, EmberParticles
    │   ├── tutorial/           # TutorialOverlay
    │   └── ui/                 # AppToast
    │
    ├── services/               # Logique métier
    │   ├── stats.service.js    # XP, streak, logs AsyncStorage (source de vérité)
    │   ├── quest.service.js    # 20 templates · 3 quêtes/jour déterministes
    │   ├── auth.service.js     # API auth
    │   ├── workout.service.js  # API workouts
    │   ├── customExercises.service.js
    │   └── savedWorkouts.service.js
    │
    ├── hooks/                  # Custom hooks
    │   ├── useWorkoutState.js  # Reducer pattern pour l'état séance
    │   ├── useEffortTimer.js   # Chronomètre séance
    │   ├── useDevSettings.js   # Paramètres développeur (God Mode, bypass…)
    │   └── useExerciseSorting.js
    │
    ├── data/                   # Données statiques
    │   ├── exerciseCatalog.js  # 100+ exercices avec muscles cibles
    │   ├── trophyCatalog.js    # 50+ définitions de trophées
    │   ├── tutorialChapters.js # Étapes du tutoriel
    │   ├── workoutTemplates.js # Programmes prédéfinis
    │   ├── ritualTypes.js      # 5 rituels de récupération
    │   └── profileThemes.js    # Thèmes visuels du profil
    │
    ├── navigation/
    │   ├── index.js            # AppNavigator (Auth vs App)
    │   ├── AuthStack.js
    │   ├── BottomTabs.js       # 5 onglets
    │   ├── WorkoutStack.js
    │   └── ProfileStack.js
    │
    ├── constants/
    │   ├── theme.js            # Design tokens (Colors, MUSCLE_GROUP_COLORS)
    │   └── exerciseFilters.js  # Mapping muscles/équipements
    │
    └── styles/
        └── global.js           # Styles utilitaires partagés
```

---

## 🎮 Système de gamification

### Calcul de l'XP par séance

```javascript
// 1. XP de base (calculé par buildLogFromWorkout)
baseXP = volume * 0.12 + setsCompleted * 8 + totalExercises * 15

// 2. Multiplicateur de streak
xpEarned = round(baseXP * streakMultiplier)

// 3. Bonus séance longue (> 15 min)
// Normal : aucun modificateur négatif
// Séance courte (< 15 min mais > 5 min) : XP ÷ 10
// Séance trop courte (< 5 min, forcée) : XP = 0
```

### Niveaux

```javascript
// XP nécessaire pour le niveau N
xpForLevel(n) = 4665 * (1.03^n - 1) / (1.03 - 1)

// Exemples
Niveau 1  →     140 XP total
Niveau 10 →   1 604 XP total
Niveau 30 →   6 657 XP total
Niveau 100 → 85 000 XP total
```

### Multiplicateurs de streak

| Streak | Multiplicateur | Label |
|--------|---------------|-------|
| 0 jour | ×1.0 | — |
| 3 jours | ×1.1 | On Fire 🔥 |
| 7 jours | ×1.2 | Week Warrior ⚔️ |
| 30 jours | ×1.5 | Godly Streak 👑 |
| 90 jours | ×2.0 | 3 Mois de Feu 🌊 |
| 180 jours | ×3.0 | Semi-Annuel 💎 |
| 365 jours | ×4.5 | Streak Annuel 🌟 |
| 730 jours | ×7.0 | Streak Légendaire ⚡ |

### Quêtes quotidiennes

3 quêtes sont sélectionnées chaque jour parmi 20 templates (sélection déterministe par hash de la date — tout le monde a les mêmes quêtes le même jour) :

```javascript
// Exemples de templates
{ id: 'volume_10k',   check: log => log.totalVolume >= 10000 }
{ id: 'sets_25',      check: log => log.setsCompleted >= 25 }
{ id: 'duration_45',  check: log => log.durationSeconds <= 2700 }
{ id: 'legs_day',     check: log => log.muscleDistribution.jambes >= 40 }
{ id: 'new_pr',       check: (_, prs) => prs.length > 0 }
```

- Compléter **1 quête** : +500 XP
- Compléter **les 3 quêtes** : +1000 XP bonus (animation confetti)

---

## 🧩 Contextes React

### WorkoutLogsContext

Source de vérité principale pour l'historique des séances. Persiste dans AsyncStorage.

```javascript
const {
  items,        // Tous les logs (séances + rituels + quêtes)
  sessionLogs,  // Logs séances uniquement (pas rituels, pas quest_reward)
  activityLogs, // Pour calcul streak (pas shortSession, pas quest_reward)
  loading, error,
  refresh,
  create(log),  // Ajouter log
  remove(id),   // Supprimer log
  addRitual(ritualId, label, duration, xpEarned), // Rituel de récupération
  totalXP,      // XP cumulatif
  clearAll,     // Debug uniquement
} = useWorkoutLogs();
```

### QuestContext

```javascript
const {
  quests,          // [{id, label, icon, completed, xp}] × 3
  bonusClaimed,    // Bonus 3/3 quêtes déjà réclamé
  completedCount,  // 0-3
  checkAndUpdateQuests(log, newPRs),  // → {completedQuests, bonusUnlocked, questXP}
  refresh,
} = useQuests();
```

### TutorialContext

```javascript
const {
  isActive, activeChapterId, stepIndex,
  hasCompleted, pendingChapterId,
  targets,
  registerTarget(key, rect),
  registerScrollRef(chapterId, ref),
  registerRemeasure(chapterId, fn),
  scrollToStep(chapterId, y),
  startChapter(chapterId),
  nextStep, prevStep, finishChapter,
  bootstrapped,
} = useTutorial();
```

### WorkoutInProgressContext

```javascript
const {
  state,          // {id, name, exercises, notes, status, durationSeconds}
  dispatch,
  actions: {
    finalize,     // = finalizeWithLog() — log local + sync backend
    addSet, updateSet, removeSet,
    addExercise, removeExercise,
    updateNotes,
  },
  loadWorkout(workout),
  addExerciseToWorkout(exercise),
} = useWorkoutInProgress();
```

---

## ⚙️ Services

### stats.service.js (AsyncStorage)

Le service le plus important — toute la logique locale de logs et de calculs XP.

```javascript
// CRUD logs AsyncStorage
listLogs()                                          → WorkoutLog[]
addLog(log)                                         → WorkoutLog (avec cap 2 XP/jour)
removeLog(id)                                       → void
addRitualLog(ritualId, label, duration, xpEarned)   → WorkoutLog | null (max 1/jour)

// Calculs purs
buildLogFromWorkout(stateSnapshot, prevLogs)        → WorkoutLog complet
findNewPRsInLog(log, allLogs)                       → PR[]
computeStreak(logs)                                 → number
getStreakMultiplier(streak)                         → {multiplier, label, color, tier}
xpForLevel(n)                                       → number
totalCumulativeXP(logs)                             → number
```

### quest.service.js

```javascript
loadTodayQuests()           → {date, quests, bonusClaimed}
checkAndMarkQuests(log, prs) → {completedIds, bonusUnlocked}
saveTodayQuests(state)
getTemplateById(id)         → Template
```

### api.js (instance Axios)

- **URL de base** : `API_URL` depuis `.env`
- **Timeout** : 10 secondes
- **Intercepteur requête** : injecte automatiquement `Authorization: Bearer {token}`
- **Intercepteur réponse** : sur 401 → appelle `signOut()` + message "Session expirée"

---

## 🗺 Navigation

```
AppNavigator (root)
├── {!userToken} AuthStack
│   ├── AuthScreen          (landing)
│   ├── LoginScreen
│   ├── RegisterScreen
│   ├── EmailVerificationScreen
│   └── ForgotPasswordScreen
│
└── {userToken} BottomTabs (5 onglets)
    ├── 🏠 HomeScreen
    ├── 💪 WorkoutStack
    │   ├── WorkoutListScreen
    │   ├── WorkoutScreen         (séance en cours)
    │   ├── WorkoutBuilderScreen
    │   ├── WorkoutDetailScreen
    │   ├── ManualWorkoutCreatorScreen
    │   ├── ExerciseDetailScreen
    │   ├── ExerciseStatsScreen
    │   ├── EditExerciseScreen
    │   └── CustomExercisesScreen
    ├── 📊 StatsScreen
    └── 👤 ProfileStack
        ├── ProfileScreen
        ├── EditProfileScreen
        ├── SettingsScreen
        ├── RankRoadmapScreen
        └── TrophyRoomScreen
```

---

## 🎨 Composants clés

### `RecoveryRitualsCard`
Carte affichée sur HomeScreen les jours sans séance. Propose 5 rituels de récupération, chacun avec son propre composant interactif :
- `CountdownTimer` — timer circulaire standard (mobilité, marche)
- `BreathingTimer` — cercle animé inspire (4s) / expire (6s)
- `FoamRollingTimer` — 5 zones × 60s avec dots de progression
- `FocusReader` — article aléatoire parmi 3, timer 5 min bloquant

### `ShortSessionWarningModal`
Modale animée (spring) déclenchée si la séance dure < 5 min :
- "Modifier la séance" → reprend l'entraînement
- "Valider quand même (0 XP)" → sauvegarde avec `shortSession: true`

### `WorkoutRecapModal`
Récapitulatif post-séance :
- Volume total, sets complétés, durée, XP gagné
- Nouveaux PRs battus
- Quêtes validées dans la séance
- Animation confetti si bonus 3/3 quêtes

### `TutorialOverlay`
Overlay semi-transparent avec :
- Découpe transparente autour de l'élément cible (`registerTarget`)
- Bulle de texte positionnée dynamiquement (top/bottom/center)
- Boutons Précédent / Suivant / Terminer

### `DailyQuestsCard`
Affiche les 3 quêtes du jour avec progression, labels, icônes et le statut du bonus.

### Design System (`src/constants/theme.js`)

Toutes les couleurs passent par des tokens centralisés :

```javascript
Colors.primary         // #FE7439  (orange — accent principal)
Colors.secondaryAccent // #6E6AF0  (violet)
Colors.valid           // #22C55E  (vert validation)
Colors.warningAmber    // #F59E0B  (avertissement)
Colors.textPrimary     // blanc pleine opacité
Colors.textSecondary   // blanc ~70%
Colors.textMuted       // blanc ~45%
Colors.card            // fond carte
Colors.background      // fond général (dark)
```

---

## 🔗 Backend associé

Ce dépôt frontend communique avec l'API **Athly Backend** (dépôt séparé).

Le backend gère :
- Authentification (JWT + OTP email)
- Synchronisation des séances (best-effort depuis le front)
- Catalogue d'exercices (intégration WGER)
- Profil utilisateur

> Voir le README du dépôt backend pour l'installation et la documentation complète de l'API.

**L'application nécessite le backend pour l'authentification.** Une fois connecté, les données de progression (logs, XP, quêtes, rituels, trophées) sont stockées localement dans AsyncStorage — les calculs sont faits côté client.

---

## 🔧 Paramètres développeur (God Mode)

Accessibles depuis Paramètres → section God Mode (uniquement en mode dev) :

| Toggle | Effet |
|--------|-------|
| God Mode | Bypass général pour tests |
| Bypass anti-triche 5 min | Ignore le check de durée minimum |
| Forcer l'affichage des rituels | Affiche la carte rituels même après une séance |

Ces paramètres sont persistés dans AsyncStorage et se rechargent à chaque focus de l'écran concerné.

---

<div align="center">

**Athly Front** · React Native + Expo · Offline-first

</div>
