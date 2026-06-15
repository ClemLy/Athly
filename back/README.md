<div align="center">

# ⚙️ ATHLY — API Backend

**Node.js · Express · MongoDB · JWT · Nodemailer**

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=flat-square&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?style=flat-square&logo=mongodb)
![JWT](https://img.shields.io/badge/Auth-JWT_+_OTP-orange?style=flat-square)
![Jest](https://img.shields.io/badge/Tests-Jest_30-C21325?style=flat-square&logo=jest)

> API REST pour l'application mobile Athly. Gère l'authentification (JWT + OTP email), les profils utilisateurs, les séances d'entraînement et la synchronisation des performances.

</div>

---

## 📋 Table des matières

1. [Vue d'ensemble](#-vue-densemble)
2. [Stack technique](#-stack-technique)
3. [Installation & lancement](#-installation--lancement)
4. [Variables d'environnement](#-variables-denvironnement)
5. [Structure du projet](#-structure-du-projet)
6. [Architecture](#-architecture)
7. [Authentification](#-authentification)
8. [Documentation API](#-documentation-api)
   - [Auth — `/api/auth`](#1-auth--apiauth)
   - [Utilisateurs — `/api/users`](#2-utilisateurs--apiusers)
   - [Séances — `/api/workouts`](#3-séances--apiworkouts)
   - [Exercices — `/api/exercises`](#4-exercices--apiexercises)
9. [Modèles de données](#-modèles-de-données)
10. [Services & logique métier](#-services--logique-métier)
11. [Tests](#-tests)
12. [Intégration continue (CI)](#️-intégration-continue-ci)
13. [Sécurité](#-sécurité)

---

## 🎯 Vue d'ensemble

L'API Athly est un backend **Node.js + Express + MongoDB** indispensable au fonctionnement de l'application mobile. L'authentification (connexion, inscription, vérification email) passe obligatoirement par ce backend. Une fois connecté, les données de progression (logs, XP, quêtes) sont calculées et stockées côté client (AsyncStorage) ; le backend reçoit les séances finalisées en best-effort pour la persistance cloud.

### Rôle du backend

| Fonction | Description |
|----------|-------------|
| **Authentification** | Inscription, connexion JWT, vérification email OTP, reset password |
| **Profil utilisateur** | Données physiques, objectifs, équipements, XP/niveau |
| **Séances** | Création, finalisation, historique des workouts |
| **Performances** | Enregistrement des séries, historique par exercice |
| **Exercices externes** | Proxy vers l'API WGER (catalogue 1000+ exercices) |
| **Email transactionnel** | Codes OTP via SMTP Yahoo (Nodemailer) |

---

## 🛠 Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime | Node.js | ≥ 18 |
| Framework HTTP | Express | 5.2.1 |
| ODM | Mongoose | 9.0.0 |
| Base de données | MongoDB Atlas | — |
| Authentification | JSON Web Token | 9.0.3 |
| Hash passwords | bcrypt | 6.0.0 |
| Email | Nodemailer (SMTP) | 8.0.10 |
| Validation | Joi | 18.0.2 |
| Sécurité HTTP | Helmet | 8.0.0 |
| CORS | cors | 2.8.5 |
| Logging | Morgan | 1.10.0 |
| Variables d'env | dotenv | 17.2.3 |
| Tests | Jest + Supertest | 30.2.0 |
| Dev | Nodemon | 3.1.11 |

---

## 🚀 Installation & lancement

### Prérequis

- Node.js ≥ 18
- Un cluster MongoDB (local ou Atlas)
- Un compte SMTP pour l'envoi d'emails (Yahoo, Gmail, etc.)

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-org/athly-back.git
cd athly-back

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env (voir section suivante)

# 4. Lancer en développement (avec hot-reload)
npm run dev

# 5. Lancer en production
npm start
```

### Vérifier que le serveur tourne

```bash
curl http://localhost:4000/health
# → {"status":"OK","uptime":42.3}
```

---

## 🔑 Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
# Serveur
PORT=4000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# JWT
JWT_SECRET=votre_secret_jwt_tres_long_et_aleatoire
JWT_EXPIRES_IN=1d

# Email SMTP (exemple avec Yahoo)
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=465
SMTP_USER=votre.adresse@yahoo.fr
SMTP_PASS=votre_app_password_yahoo
```

> **Important :** Ne jamais committer le `.env` — il est dans `.gitignore`. Les credentials SMTP doivent être des **app passwords** (pas votre mot de passe principal).

---

## 📁 Structure du projet

```
back-projet-final-ClemLy/
├── server.js                   # Point d'entrée : listen()
├── app.js                      # Config Express, routes, middlewares
├── package.json
├── jest.config.js              # Configuration Jest
├── eslint.config.mjs           # Configuration ESLint
│
├── config/
│   ├── db.js                   # Connexion Mongoose (connectDB)
│   └── env.js                  # Validation et export des variables d'env
│
├── controllers/                # Handlers HTTP (entrée/sortie)
│   ├── auth.controller.js      # register, login, verifyEmail, forgotPassword…
│   ├── user.controller.js      # getMe, updateMe, deleteAccount
│   ├── workout.controller.js   # CRUD séances, draft, finalize, complete
│   └── exercise.controller.js  # createRecord, getHistory, getByWorkout
│
├── services/                   # Logique métier (pur, testable)
│   ├── auth.service.js         # Création compte, OTP, JWT
│   ├── user.service.js         # Profil, XP/level, suppression cascade
│   ├── workout.service.js      # Calculs volume, XP séance, draft/finalize
│   ├── exercise.service.js     # Records, historique progressions
│   ├── email.service.js        # Templates HTML + envoi SMTP
│   └── wger.service.js         # Proxy API WGER (exercices externes)
│
├── models/                     # Schémas Mongoose
│   ├── User.js
│   ├── Workout.js
│   └── ExerciseRecord.js
│
├── routes/                     # Déclaration des routes
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── workout.routes.js
│   └── exercise.routes.js
│
├── middleware/
│   ├── auth.middleware.js      # Vérification JWT (protect)
│   ├── validate.middleware.js  # Validation Joi (validateBody)
│   ├── error.middleware.js     # Gestionnaire d'erreurs global
│   └── not-found.middleware.js # 404 handler
│
├── validators/                 # Schémas Joi
│   ├── auth.validator.js
│   ├── user.validator.js
│   ├── workout.validator.js
│   └── exercise.validator.js
│
├── tests/
│   ├── levelHelpers.test.js     # Formule XP/niveau — 24 tests (unitaires)
│   ├── workoutAnticheat.test.js # Anti-cheat serveur — 13 tests (mocks Mongoose)
│   ├── modelsIntegrity.test.js  # Intégrité des schémas Mongoose — 36 tests
│   ├── auth.test.js
│   ├── user.test.js
│   ├── workout.test.js
│   ├── exercise.test.js
│   └── health.test.js
│
├── utils/
│   └── levelHelpers.js          # Source de vérité XP/niveau (xpForLevel, levelFromXP)
│
└── scripts/
    └── populateWorkouts.js      # Seed de données de test
```

---

## 🏗 Architecture

### Flux d'une requête

```
Client (React Native)
        │
        ▼
   Express Router
        │
        ├─→ Middleware auth.middleware (JWT protect)
        │         └─ Vérifie Bearer token → req.user = payload
        │
        ├─→ Middleware validate.middleware (Joi)
        │         └─ Valide req.body contre le schéma
        │
        ▼
   Controller
        │  Handler HTTP : valide entrées, appelle service, retourne réponse
        ▼
   Service
        │  Logique métier pure, indépendante d'Express
        ▼
   Model (Mongoose)
        │
        ▼
   MongoDB Atlas
```

### Gestion des erreurs

Toutes les erreurs non gérées remontent au middleware `error.middleware.js` qui normalise le format :

```json
{
  "status": "error",
  "message": "Description de l'erreur",
  "code": 400
}
```

---

## 🔐 Authentification

### Flux complet d'inscription

```
POST /api/auth/register
  └─ Crée le compte (isVerified: false)
  └─ Génère un code OTP 6 chiffres (valide 10 min)
  └─ Envoie un email avec le code
        │
        ▼
POST /api/auth/verify-email
  └─ Vérifie le code OTP
  └─ isVerified → true
  └─ Retourne JWT token (connexion automatique)
```

### Flux de reset password

```
POST /api/auth/forgot-password
  └─ Génère un code reset (valide 15 min)
  └─ Envoie l'email
        │
        ▼
POST /api/auth/reset-password
  └─ Vérifie le code
  └─ Hash le nouveau password (bcrypt)
  └─ Invalide le code
```

### Protection brute-force

- Maximum **5 tentatives** de vérification OTP avant blocage
- Les codes OTP expirent automatiquement (10 min vérif, 15 min reset)
- Mongoose TTL index sur `codeExpires`

### Utiliser le token JWT

Toutes les routes protégées nécessitent :

```
Authorization: Bearer <votre_token_jwt>
```

Le token expire selon `JWT_EXPIRES_IN` (défaut : `1d`).

---

## 📖 Documentation API

**Base URL :** `http://votre-serveur:4000/api`

---

### 1. Auth — `/api/auth`

Toutes ces routes sont **publiques** (pas de JWT requis).

---

#### `POST /api/auth/register`

Créer un nouveau compte utilisateur.

**Body**
```json
{
  "pseudo": "AthlèteExemple",
  "email": "athlete@mail.com",
  "password": "motdepasse123"
}
```

**Réponse 201**
```json
{
  "message": "Compte créé. Vérifiez votre email.",
  "email": "athlete@mail.com"
}
```

**Erreurs**
| Code | Cause |
|------|-------|
| 400 | Email déjà utilisé |
| 422 | Validation Joi échouée (email invalide, password trop court) |

---

#### `POST /api/auth/login`

Connexion et récupération du token JWT.

**Body**
```json
{
  "email": "athlete@mail.com",
  "password": "motdepasse123"
}
```

**Réponse 200**
```json
{
  "message": "Connexion réussie.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "64f2a...",
    "pseudo": "AthlèteExemple",
    "email": "athlete@mail.com",
    "isVerified": true,
    "xp": 2400,
    "level": 8
  }
}
```

**Erreurs**
| Code | Cause |
|------|-------|
| 401 | Mauvais email ou password |
| 403 | Email non vérifié |

---

#### `POST /api/auth/verify-email`

Vérifier son email avec le code OTP reçu.

**Body**
```json
{
  "email": "athlete@mail.com",
  "code": "847291"
}
```

**Réponse 200**
```json
{
  "message": "Email vérifié avec succès.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Erreurs**
| Code | Cause |
|------|-------|
| 400 | Code incorrect ou expiré |
| 429 | Trop de tentatives (> 5) |

---

#### `POST /api/auth/resend-verification`

Renvoyer un nouveau code de vérification.

**Body**
```json
{ "email": "athlete@mail.com" }
```

**Réponse 200**
```json
{ "message": "Code renvoyé." }
```

---

#### `POST /api/auth/forgot-password`

Demander un code de reset de mot de passe.

**Body**
```json
{ "email": "athlete@mail.com" }
```

**Réponse 200**
```json
{ "message": "Code de réinitialisation envoyé par email." }
```

> **Note :** Renvoie toujours 200 même si l'email n'existe pas (sécurité — ne révèle pas si un compte existe).

---

#### `POST /api/auth/reset-password`

Réinitialiser le mot de passe avec le code reçu.

**Body**
```json
{
  "email": "athlete@mail.com",
  "code": "391847",
  "newPassword": "nouveauMotDePasse456"
}
```

**Réponse 200**
```json
{ "message": "Mot de passe réinitialisé avec succès." }
```

---

### 2. Utilisateurs — `/api/users`

Toutes ces routes nécessitent `Authorization: Bearer <token>`.

---

#### `GET /api/users/me`

Récupérer le profil de l'utilisateur connecté.

**Réponse 200**
```json
{
  "user": {
    "_id": "64f2a...",
    "pseudo": "AthlèteExemple",
    "email": "athlete@mail.com",
    "age": 25,
    "sexe": "H",
    "poids": 80,
    "poidsCible": 75,
    "taille": 180,
    "niveauSportif": "Intermédiaire",
    "objectif": "prise de masse",
    "rythme": 4,
    "equipements": ["Haltères", "Barre", "Poulie"],
    "xp": 2400,
    "level": 8,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### `PUT /api/users/me`

Mettre à jour le profil utilisateur.

**Body** (tous les champs sont optionnels)
```json
{
  "pseudo": "NouveauPseudo",
  "age": 26,
  "poids": 78,
  "poidsCible": 72,
  "taille": 180,
  "niveauSportif": "Avancé",
  "objectif": "force",
  "rythme": 5,
  "equipements": ["Haltères", "Barre", "Anneaux"]
}
```

**Réponse 200**
```json
{
  "message": "Profil mis à jour.",
  "user": { ... }
}
```

---

#### `DELETE /api/users/delete-account`

Supprimer définitivement le compte et toutes ses données (RGPD).

> **Suppression en cascade :** ExerciseRecord → Workout → User

**Réponse 200**
```json
{ "message": "Compte supprimé avec succès." }
```

---

### 3. Séances — `/api/workouts`

Toutes ces routes nécessitent `Authorization: Bearer <token>`.

---

#### `POST /api/workouts`

Créer et enregistrer une séance.

**Body**
```json
{
  "name": "Push Day — Pectoraux",
  "exercises": [
    {
      "name": "Développé couché",
      "targetMuscle": "pectoraux",
      "equipment": ["Barre", "Banc"],
      "sets": [
        { "weight": 80, "reps": 8, "completed": true },
        { "weight": 80, "reps": 7, "completed": true },
        { "weight": 75, "reps": 8, "completed": true }
      ]
    },
    {
      "name": "Pompes inclinées",
      "targetMuscle": "pectoraux",
      "equipment": [],
      "sets": [
        { "weight": 0, "reps": 15, "completed": true }
      ]
    }
  ],
  "durationSeconds": 3240,
  "notes": "Bonne séance, PR sur le développé couché !"
}
```

**Réponse 201**
```json
{
  "message": "Séance créée.",
  "workout": {
    "_id": "65a3b...",
    "user": "64f2a...",
    "name": "Push Day — Pectoraux",
    "exercises": [ ... ],
    "durationSeconds": 3240,
    "totalVolume": 1845,
    "setsCompleted": 7,
    "xpEarned": 185,
    "status": "finished",
    "date": "2024-09-15T14:22:00.000Z"
  }
}
```

---

#### `GET /api/workouts`

Récupérer toutes les séances de l'utilisateur connecté (triées par date décroissante).

**Réponse 200**
```json
{
  "workouts": [
    {
      "_id": "65a3b...",
      "name": "Push Day",
      "date": "2024-09-15T14:22:00.000Z",
      "totalVolume": 1845,
      "setsCompleted": 7,
      "durationSeconds": 3240,
      "status": "finished"
    },
    ...
  ],
  "total": 42
}
```

---

#### `GET /api/workouts/:id`

Récupérer le détail complet d'une séance.

**Réponse 200**
```json
{
  "workout": {
    "_id": "65a3b...",
    "name": "Push Day — Pectoraux",
    "exercises": [
      {
        "name": "Développé couché",
        "targetMuscle": "pectoraux",
        "sets": [
          { "weight": 80, "reps": 8, "completed": true },
          ...
        ]
      }
    ],
    "totalVolume": 1845,
    "setsCompleted": 7,
    "xpEarned": 185,
    "durationSeconds": 3240,
    "notes": "Bonne séance !",
    "status": "finished",
    "date": "2024-09-15T14:22:00.000Z"
  }
}
```

**Erreurs**
| Code | Cause |
|------|-------|
| 404 | Séance introuvable ou n'appartient pas à l'utilisateur |

---

#### `DELETE /api/workouts/:id`

Supprimer une séance.

**Réponse 200**
```json
{ "message": "Séance supprimée." }
```

---

#### `POST /api/workouts/draft`

Créer un brouillon de séance (séance non commencée).

**Body**
```json
{
  "name": "Ma prochaine séance Pull",
  "exercises": []
}
```

**Réponse 201**
```json
{
  "workout": {
    "_id": "65a3c...",
    "status": "draft",
    "name": "Ma prochaine séance Pull"
  }
}
```

---

#### `PATCH /api/workouts/:id/draft`

Mettre à jour un brouillon (ajouter des exercices, modifier le nom…).

**Body** (champs partiels)
```json
{
  "name": "Pull Day — Dos",
  "exercises": [
    { "name": "Tractions", "targetMuscle": "dos" }
  ]
}
```

**Réponse 200**
```json
{ "workout": { ... } }
```

---

#### `POST /api/workouts/:id/finalize`

Finaliser une séance en cours. Calcule les totaux et attribue de l'XP.

**Body** (optionnel)
```json
{
  "durationSeconds": 3600,
  "notes": "Super séance"
}
```

**XP calculé :** `100 + 5 × setsCompleted`

**Réponse 200**
```json
{
  "message": "Séance finalisée.",
  "workout": {
    "_id": "65a3b...",
    "status": "finished",
    "totalVolume": 2140,
    "setsCompleted": 18,
    "xpEarned": 190
  },
  "xpGained": 190,
  "newLevel": 9
}
```

---

#### `POST /api/workouts/:id/complete`

Compléter une séance (variante alternative de finalisation).

**XP calculé :** `100 + 10 × exercisesWithCompletedSets`

**Réponse 200**
```json
{
  "message": "Séance complétée.",
  "xpGained": 140,
  "newLevel": 9
}
```

---

#### `GET /api/workouts/exercises`

Récupérer la liste d'exercices depuis l'API WGER, filtrée par muscle et équipement.

**Query params**
```
?muscleId=10&equipmentId=3&includeDetails=true
```

**Réponse 200**
```json
{
  "exercises": [
    {
      "id": 192,
      "name": "Bench Press",
      "videoUrl": "https://wger.de/en/exercise/192/view/bench-press"
    },
    ...
  ]
}
```

---

### 4. Exercices — `/api/exercises`

Toutes ces routes nécessitent `Authorization: Bearer <token>`.

---

#### `POST /api/exercises`

Enregistrer les performances d'un exercice pour une séance donnée.

**Body**
```json
{
  "workout": "65a3b...",
  "exerciceNom": "Développé couché",
  "series": [
    { "poids": 80, "repetitions": 8 },
    { "poids": 82.5, "repetitions": 6 },
    { "poids": 80, "repetitions": 7 }
  ],
  "note": "Léger PR sur la série 2"
}
```

**Réponse 201**
```json
{
  "record": {
    "_id": "65b1c...",
    "exerciceNom": "Développé couché",
    "series": [ ... ],
    "recommandedNextWeight": 85,
    "createdAt": "2024-09-15T14:22:00.000Z"
  }
}
```

---

#### `GET /api/exercises/history/:name`

Récupérer l'historique de progression d'un exercice (pour les graphes).

**Exemple :** `GET /api/exercises/history/Développé%20couché`

**Réponse 200**
```json
{
  "history": [
    {
      "_id": "65b1c...",
      "workout": "65a3b...",
      "series": [
        { "poids": 80, "repetitions": 8 }
      ],
      "createdAt": "2024-09-15T14:22:00.000Z"
    },
    {
      "_id": "65b0a...",
      "workout": "65a2d...",
      "series": [
        { "poids": 77.5, "repetitions": 8 }
      ],
      "createdAt": "2024-09-12T09:15:00.000Z"
    }
  ]
}
```

---

#### `GET /api/exercises/workout/:workoutId`

Récupérer tous les records d'exercices associés à une séance spécifique.

**Réponse 200**
```json
{
  "records": [
    {
      "_id": "65b1c...",
      "exerciceNom": "Développé couché",
      "series": [ ... ]
    },
    {
      "_id": "65b1d...",
      "exerciceNom": "Dips",
      "series": [ ... ]
    }
  ]
}
```

---

#### `GET /health`

Point de terminaison de santé (public, sans auth).

**Réponse 200**
```json
{
  "status": "OK",
  "uptime": 3600.42
}
```

---

## 🗄 Modèles de données

### User

```javascript
{
  // Identité
  pseudo:     String (required, trim),
  email:      String (required, unique, lowercase),
  password:   String (required, bcrypt hash),

  // Vérification email
  isVerified:        Boolean  (default: false),
  verificationCode:  String,
  verifyAttempts:    Number   (default: 0, max: 5),

  // Reset password
  resetPasswordCode: String,
  codeExpires:       Date,    // TTL : 10 min (vérif) / 15 min (reset)

  // Profil physique
  age:           Number,
  sexe:          Enum ["H", "F", "Autre"],
  poids:         Number,   // kg
  poidsCible:    Number,   // kg
  taille:        Number,   // cm
  niveauSportif: Enum ["Débutant", "Intermédiaire", "Avancé"],
  objectif:      Enum ["prise de masse", "perte de poids", "entretien", "force"],
  rythme:        Number,   // 1-7 séances/semaine
  equipements:   [String],

  // Gamification
  xp:    Number (default: 0),
  level: Number (default: 1),

  // Timestamps Mongoose
  createdAt, updatedAt
}
```

### Workout

```javascript
{
  user:  ObjectId → User (required),
  date:  Date (default: Date.now),
  name:  String (default: "Séance"),

  exercises: [
    {
      exerciseId:    ObjectId → Exercise (optional),
      name:          String (required),
      targetMuscle:  String,
      equipment:     [String],
      sets: [
        {
          weight:    Number,
          reps:      Number,
          completed: Boolean (default: false),
          timestamp: Date
        }
      ],
      notes:    String,
      videoUrl: String
    }
  ],

  // Métriques (calculées à la finalisation)
  durationSeconds: Number,
  totalVolume:     Number,   // kg · reps cumulé
  setsCompleted:   Number,
  xpEarned:        Number,
  notes:           String,

  // Statut
  status:      Enum ["draft", "in_progress", "finished", "completed"],
  completedAt: Date,

  // Timestamps Mongoose
  createdAt, updatedAt
}

// Méthodes d'instance
workout.computeTotals()      // → {totalVolume, setsCompleted}
workout.finalize(options)    // → {totalVolume, setsCompleted, xp}
```

### ExerciseRecord

```javascript
{
  user:    ObjectId → User    (required),
  workout: ObjectId → Workout (required),

  exerciceNom: String (required),
  series: [
    {
      poids:       Number,  // kg (0 si bodyweight)
      repetitions: Number
    }
  ],
  note:                    String,
  recommandedNextWeight:   Number,  // suggestion poids prochaine séance

  // Timestamps Mongoose
  createdAt, updatedAt
}
```

---

## 🧠 Services & logique métier

### auth.service.js

| Fonction | Description |
|----------|-------------|
| `register(pseudo, email, password)` | Hash password, crée User, génère OTP 6 chiffres, envoie email |
| `login(email, password)` | Vérifie identifiants, génère JWT, retourne user |
| `verifyEmail(email, code)` | Vérifie OTP, active compte, retourne JWT |
| `resendVerification(email)` | Génère nouveau code, envoie email |
| `forgotPassword(email)` | Génère code reset, envoie email |
| `resetPassword(email, code, newPassword)` | Vérifie code, hash nouveau password, invalide code |

**Constantes :**
```javascript
MAX_OTP_ATTEMPTS  = 5         // Tentatives max avant blocage
CODE_TTL_VERIFY   = 10 * 60   // 10 minutes (en secondes)
CODE_TTL_RESET    = 15 * 60   // 15 minutes
```

### user.service.js

| Fonction | Description |
|----------|-------------|
| `getUserProfile(userId)` | Retourne user sans password |
| `updateUser(userId, data)` | Mise à jour profil (whitelist de champs) |
| `deleteAccount(userId)` | Suppression cascade : ExerciseRecord → Workout → User |
| `addExperience(userId, xp)` | `user.xp += xp`, recalcule level = `floor(sqrt(xp / 250))` |

### workout.service.js

| Fonction | Description |
|----------|-------------|
| `createWorkout(userId, data)` | Crée et sauvegarde une séance |
| `getMyWorkouts(userId)` | Toutes les séances, triées par date desc |
| `getWorkoutById(userId, id)` | Détail + vérification ownership |
| `deleteWorkout(userId, id)` | Suppression (ownership check) |
| `createDraft(userId, data)` | Brouillon (status: "draft") |
| `updateDraft(userId, id, patch)` | Mise à jour partielle du brouillon |
| `finalizeWorkout(userId, id, opts)` | Calcule totaux, applique l'anti-cheat, crédite XP et recalcule le niveau |
| `completeWorkout(userId, id)` | `xp = 100 + 10×exercisesWithSets`, crédite XP et recalcule le niveau |

**Anti-cheat temporel (miroir du front-end) :**
```javascript
if (shortSession === true || duration < 300)  xp = 0          // < 5 min → 0 XP
else if (duration < 900)                       xp = round(xp/10) // 5–15 min → XP ÷ 10
// ≥ 15 min → XP plein
```

**Formule de niveau (harmonisée avec le front-end) :**
```javascript
// utils/levelHelpers.js — source de vérité unique
xpForLevel(n) = Math.round(4665 * (1.03^n - 1))
levelFromXP(xp) // recherche binaire inverse
// Exemples : ~1 600 XP → L10 · ~85 000 XP → L100 · ~1 150 000 XP → L200
```

### email.service.js

Templates HTML professionnels (fond dark `#0D1018`, logo Athly) pour :
- **Vérification d'email** : code OTP 6 chiffres en grande police
- **Reset password** : même format, texte différent

Utilise Nodemailer avec SSL/TLS sur le port 465.

### wger.service.js

Proxy vers `https://wger.de/api/v2` :

```javascript
getExercisesByMuscleAndEquipment(muscleId, equipmentId, includeDetails)
// → [{id, name, videoUrl}]
```

---

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Tests en mode watch
npm test -- --watch

# Couverture de code
npm test -- --coverage
```

### Tests unitaires et d'intégrité (sans base de données)

Ces trois suites tournent sans connexion MongoDB — elles sont la cible principale de la CI.

#### `tests/levelHelpers.test.js` — 24 tests

Vérifie la formule XP/niveau définie dans `utils/levelHelpers.js` :

| Groupe | Ce qui est testé |
|--------|-----------------|
| `xpForLevel` | Niveau 0, 1, 10, 100, 200 ; cap >200 ; valeurs négatives ; progression strictement croissante |
| `levelFromXP` | 0 XP → L0 ; valeurs nulles/NaN/négatives ; bijectivité `levelFromXP(xpForLevel(n)) === n` pour n ∈ {1,5,10,25,50,75,100,150,200} ; 85 000 XP → L100 |

#### `tests/workoutAnticheat.test.js` — 13 tests

Vérifie la logique d'anti-cheat serveur dans `workout.service.js::finalizeWorkout` via `jest.mock()` (aucun appel MongoDB) :

| Scénario | XP attendu |
|----------|-----------|
| `durationSeconds = 0` | 0 |
| `durationSeconds = 150` (< 5 min) | 0 |
| `durationSeconds = 299` | 0 |
| `shortSession: true` + 1 800 s | 0 |
| `durationSeconds = 300` (seuil exact) | XP ÷ 10 |
| `durationSeconds = 600` | XP ÷ 10 |
| `durationSeconds = 899` | XP ÷ 10 |
| `durationSeconds = 900` (seuil exact) | XP plein |
| `durationSeconds = 3 600` | XP plein |
| User null (absent en BDD) | pas de crash |
| Workout introuvable | lance une erreur |

#### `tests/modelsIntegrity.test.js` — 36 tests

Vérifie l'état des schémas Mongoose sans requête réseau :

| Groupe | Ce qui est testé |
|--------|-----------------|
| Imports réels | User, Workout, ExerciseRecord s'importent sans erreur |
| Modèles fantômes | UserQuest, RefreshToken, WorkoutLog, RitualLog, UserProgress, Notification → `MODULE_NOT_FOUND` |
| Schéma User | Champs email/password/xp/level/isVerified ; contrainte unique email ; xp défaut 0 ; level défaut 1 |
| Schéma Workout | Champs user/exercises/xpEarned/durationSeconds/status/notes ; méthodes `finalize()` et `computeTotals()` ; enum status contient draft/in_progress/finished |
| Schéma ExerciseRecord | Champs user/workout/exerciceNom/series ; refs User et Workout |

### Tests d'intégration HTTP (avec base de données)

| Fichier | Routes couvertes |
|---------|-----------------|
| `health.test.js` | `GET /health` |
| `auth.test.js` | Register, login, verify-email, forgot/reset password |
| `user.test.js` | `GET/PUT /me`, delete account |
| `workout.test.js` | CRUD séances, draft, finalize, complete |
| `exercise.test.js` | Create record, get history, get by workout |

Ces tests utilisent **Supertest** et nécessitent un cluster MongoDB accessible (variable `MONGO_URI`).

---

## ⚙️ Intégration continue (CI)

Les tests unitaires et d'intégrité (`levelHelpers`, `workoutAnticheat`, `modelsIntegrity`) sont conçus pour s'exécuter **sans base de données** dans n'importe quel environnement CI/CD.

Exemple de workflow GitHub Actions :

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx jest tests/levelHelpers.test.js tests/workoutAnticheat.test.js tests/modelsIntegrity.test.js --runInBand --forceExit
```

> Les tests d'intégration HTTP (`auth`, `user`, `workout`, `exercise`) nécessitent un secret `MONGO_URI` configuré dans les variables d'environnement du runner CI.

---

## 🔒 Sécurité

| Mesure | Implémentation |
|--------|---------------|
| Passwords hashés | bcrypt avec salt rounds = 10 |
| JWT court-vécu | Expiration 1 jour (configurable) |
| Vérification email | OTP 6 chiffres, expiration 10 min |
| Brute-force OTP | Blocage après 5 tentatives |
| Headers sécurisés | Helmet (X-Frame-Options, CSP, HSTS, etc.) |
| CORS | Configuré pour les origines autorisées |
| Validation entrées | Joi sur tous les body de requête |
| Ownership check | Chaque workout/record vérifié contre `req.user.id` |
| Logs HTTP | Morgan en mode `dev` |
| Variables sensibles | Jamais en dur, toujours via `.env` |

---

<div align="center">

**Athly API** · Node.js + Express + MongoDB · Authentification JWT + OTP

</div>
