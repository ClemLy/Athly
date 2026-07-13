<div align="center">

# ATHLY : API Backend

**Node.js, Express, MongoDB, JWT, Google OAuth, Nodemailer**

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=flat-square&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?style=flat-square&logo=mongodb)
![JWT](https://img.shields.io/badge/Auth-JWT_+_OTP_+_Google-orange?style=flat-square)
![Jest](https://img.shields.io/badge/Tests-Jest_30-C21325?style=flat-square&logo=jest)

API REST pour l'application mobile Athly. Gère l'authentification (mot de passe, OTP email, Google OAuth), les profils, les séances d'entraînement, ainsi que l'ensemble du système social et de gamification (amis, groupes de streak, coffres, titres, trophées, lobby multijoueur, parrainage).

</div>

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Stack technique](#stack-technique)
3. [Installation et lancement](#installation-et-lancement)
4. [Variables d'environnement](#variables-denvironnement)
5. [Structure du projet](#structure-du-projet)
6. [Architecture](#architecture)
7. [Authentification](#authentification)
8. [Documentation de l'API](#documentation-de-lapi)
9. [Modèles de données](#modèles-de-données)
10. [Services et logique métier](#services-et-logique-métier)
11. [Catalogues de données](#catalogues-de-données)
12. [Formules de gamification](#formules-de-gamification)
13. [Tests](#tests)
14. [Intégration continue](#intégration-continue)
15. [Sécurité](#sécurité)

---

## Vue d'ensemble

L'API Athly est un backend Node.js, Express et MongoDB. L'authentification (inscription, connexion, vérification email, connexion Google, réinitialisation de mot de passe) passe obligatoirement par ce backend. Une fois connecté, les données de progression immédiate (logs de séances, XP calculé, quêtes, rituels) sont calculées et stockées côté client dans AsyncStorage pour la fluidité, tandis que le backend fait autorité pour tout ce qui touche à la persistance cloud, au multijoueur et aux fonctionnalités sociales : profil, inventaire, coffres, titres, trophées, amis, groupes de streak et lobby multijoueur.

### Rôle du backend

| Fonction | Description |
|----------|--------------|
| Authentification | Inscription, connexion par mot de passe, connexion Google OAuth, vérification email par OTP, réinitialisation de mot de passe |
| Profil utilisateur | Données physiques, objectifs, équipements, XP et niveau, cadre de profil équipé, RGPD |
| Séances | Création, brouillon, finalisation, historique, anti-triche serveur |
| Performances | Enregistrement des séries par exercice, historique de progression, classement par exercice |
| Synchronisation XP | Réception de l'XP totale calculée côté client, recalcul du niveau et du rang, ratchet anti-régression |
| Inventaire et coffres | Ouverture de coffres, utilisation d'objets, réclamation de cosmétiques Uniques |
| Amis et classement | Demandes d'amis, liste, recherche par tag, classement XP, profil public |
| Groupes de streak | Groupe de 5 membres maximum, invitations, streak collective, action Secouer |
| Titres RPG | Catalogue de 17 titres déblocables, équipement |
| Trophées | Catalogue serveur, synchronisation des trophées locaux, anniversaire, parrainage |
| Lobby multijoueur | Création de lobby, invitations, statut prêt, bonus d'XP de groupe |
| Flux d'activité | Réactions entre amis (bravo, respect, hue, jaloux) sur des événements marquants |
| Poids | Historique de pesées |
| Email transactionnel | Codes OTP et notifications via SMTP (Brevo) |
| Notifications push | Enregistrement du token Expo, envoi via expo-server-sdk |
| Outillage de test (God Mode) | Endpoints réservés au développement pour simuler des états de jeu |

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime | Node.js | 20.x (CI), 18+ en local |
| Framework HTTP | Express | 5.2.1 |
| ODM | Mongoose | 9.7.3 |
| Base de données | MongoDB Atlas (production), mongodb-memory-server (tests) | |
| Authentification par mot de passe | JSON Web Token | 9.0.3 |
| Authentification sociale | google-auth-library | 10.x |
| Hash des mots de passe | bcrypt | 6.0.0 |
| Email | Nodemailer (SMTP) | 9.0.3 |
| Notifications push | expo-server-sdk | 6.x |
| Validation | Joi | 18.2.3 |
| Sécurité HTTP | Helmet | 8.0.0 |
| Rate limiting | express-rate-limit | 8.x |
| CORS | cors | 2.8.5 |
| Logging | Morgan | 1.10.0 |
| Variables d'environnement | dotenv | 17.2.3 |
| Tests | Jest, Supertest, mongodb-memory-server | 30.4.2 |
| Dev | Nodemon | 3.1.11 |

---

## Installation et lancement

### Prérequis

- Node.js 18 ou supérieur
- Un cluster MongoDB (Atlas ou local) pour la production. Les tests n'en nécessitent pas : ils démarrent leur propre instance en mémoire.
- Un compte SMTP pour l'envoi d'emails (Brevo recommandé, tier gratuit à 300 emails par jour)
- Optionnel : des Client IDs Google OAuth si la connexion Google doit être active

### Étapes

```bash
git clone https://github.com/ClemLy/Athly.git
cd Athly/back

npm install

cp .env.example .env
# Éditer .env, voir la section Variables d'environnement ci-dessous

npm run dev    # développement, avec rechargement à chaud (nodemon)
npm start      # production
```

### Vérifier que le serveur tourne

```bash
curl http://localhost:4000/health
# {"status":"OK","uptime":42.3}
```

---

## Variables d'environnement

Toutes les variables sont documentées avec leur usage exact dans `.env.example`. Résumé :

```env
# Serveur
PORT=4000
NODE_ENV=development

# MongoDB (obligatoire au démarrage)
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

# JWT (obligatoire au démarrage)
JWT_SECRET=secret_long_et_aleatoire
JWT_EXPIRES_IN=1d

# Refresh token (optionnel, non utilisé par l'implémentation actuelle)
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRES_IN=7d

# Email SMTP (exemple Brevo)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=votre_login_brevo
SMTP_PASS=votre_cle_api_brevo
SMTP_FROM=noreply@votre-domaine.com

# Google OAuth (optionnel : sans valeur, POST /api/auth/google répond 501)
# Liste séparée par des virgules : un Client ID par plateforme front
# (iOS, Android, Web, Expo Go), car le claim "aud" du token contient
# exactement celui qui l'a émis.
GOOGLE_CLIENT_IDS=

# CORS (production uniquement)
# Allowlist des origines web autorisées, séparées par des virgules.
# Les requêtes sans header Origin (app mobile native) ne sont pas concernées.
# Non définie : comportement permissif en développement, avertissement en production.
CORS_ORIGINS=
```

Ne jamais committer le fichier `.env` : il est dans `.gitignore`. Les identifiants SMTP doivent être des clés d'application dédiées, jamais un mot de passe de compte personnel.

---

## Structure du projet

```
back/
  server.js                    Point d'entrée : connexion DB puis listen()
  app.js                       Configuration Express : middlewares, montage des routes
  eslint.config.mjs
  jest.config.js

  config/
    db.js                      Connexion Mongoose (connectDB)
    env.js                     Lecture et validation des variables d'environnement

  models/                      8 schémas Mongoose
    User.js
    Workout.js
    ExerciseRecord.js
    Friendship.js
    StreakGroup.js
    WorkoutLobby.js
    ActivityEvent.js
    WeightHistory.js

  controllers/                 14 fichiers, handlers HTTP
    auth.controller.js
    user.controller.js
    workout.controller.js
    exercise.controller.js
    friend.controller.js
    inventory.controller.js
    groupStreak.controller.js
    reward.controller.js
    referral.controller.js
    title.controller.js
    workoutLobby.controller.js
    weight.controller.js
    activity.controller.js
    debug.controller.js

  services/                    9 fichiers, logique métier pure et testable
    auth.service.js
    user.service.js
    workout.service.js
    exercise.service.js
    email.service.js
    push.service.js
    chest.service.js
    inventory.service.js
    activity.service.js

  routes/                      14 fichiers, déclaration des endpoints
  validators/                  7 fichiers, schémas Joi
  middleware/
    auth.middleware.js         Vérification JWT (protect)
    devOnly.middleware.js      Bloque une route en production (404)
    validate.middleware.js     Validation Joi du corps de requête
    sanitize.middleware.js     Assainissement anti-injection NoSQL
    rateLimit.middleware.js    Limiteurs global et authentification
    error.middleware.js        Gestionnaire d'erreurs global
    not-found.middleware.js    404 handler

  data/
    titleCatalog.js            17 titres RPG déblocables
    localTrophyCatalog.js      Miroir des 40 trophées locaux du front, plus le trophée Souverain Absolu
    shakeMessages.js           Messages aléatoires du bouton Secouer

  utils/
    levelHelpers.js            Source de vérité XP et niveau (xpForLevel, levelFromXP, getRankForLevel)
    profanityFilter.js         Filtre de pseudos

  tests/                       26 fichiers de tests, voir la section Tests
  scripts/
    populateWorkouts.js        Seed de données de test
    jest-staged.js             Utilisé par lint-staged
```

---

## Architecture

### Flux d'une requête

```
Client (React Native / PWA)
        |
        v
   Express Router
        |
        +--> Middleware auth.middleware (JWT protect)
        |         Vérifie le Bearer token, injecte req.user
        |
        +--> Middleware validate.middleware (Joi)
        |         Valide req.body contre le schéma de la route
        |
        v
   Controller
        |    Handler HTTP : lit la requête, appelle le service, formate la réponse
        v
   Service
        |    Logique métier pure, indépendante d'Express
        v
   Model (Mongoose)
        |
        v
   MongoDB
```

Séparation stricte : les routes ne font que déclarer method plus path plus middleware plus controller. Les controllers ne contiennent aucune requête Mongoose directe pour la logique complexe (délégation au service), à l'exception de quelques controllers qui restent volontairement compacts pour des opérations simples de lecture ou d'écriture directe (par exemple `activity.controller.js`, `weight.controller.js`). Les services ne connaissent jamais `req` ou `res`.

### Gestion des erreurs

Toutes les erreurs non gérées remontent au middleware `error.middleware.js`, qui normalise la réponse :

```json
{
  "success": false,
  "message": "Description de l'erreur",
  "status": 400
}
```

### Résilience

- `unhandledRejection` est logué sans tuer le process.
- `uncaughtException` déclenche un arrêt propre (log puis exit, l'orchestrateur redémarre).
- Arrêt gracieux sur SIGTERM et SIGINT : drain des requêtes en cours, fermeture de la connexion MongoDB, garde-fou de 10 secondes.
- MongoDB se reconnecte automatiquement en cas de coupure (Mongoose), les événements sont logués.
- Les opérations sensibles à la concurrence (par exemple la consommation du dernier objet d'inventaire) utilisent des mises à jour atomiques (`findOneAndUpdate` conditionnel avec `$inc`), pas de lecture puis écriture.

Voir `docs/ARCHITECTURE-SECURITE.md` à la racine du dépôt pour le détail complet des protections et de la tolérance aux pannes.

---

## Authentification

### Inscription par email

```
POST /api/auth/register
  Crée le compte (isVerified: false)
  Génère un code OTP à 6 chiffres, valide 10 minutes
  Envoie un email avec le code
  Génère un code de parrainage et un discriminant à 4 chiffres

POST /api/auth/verify-email
  Vérifie le code OTP
  isVerified passe à true
  Retourne le token JWT (connexion automatique)
```

### Connexion Google

```
POST /api/auth/google
  Vérifie l'idToken auprès de Google (audience parmi GOOGLE_CLIENT_IDS)
  Crée le compte au premier login (isVerified: true d'office, email garanti par Google)
  Retourne le token JWT
```

Sans `GOOGLE_CLIENT_IDS` configuré côté serveur, la route répond 501 plutôt que de faire planter le démarrage du serveur.

### Réinitialisation de mot de passe

```
POST /api/auth/forgot-password
  Génère un code de réinitialisation, valide 15 minutes
  Envoie l'email
  Répond toujours 200, même si l'email n'existe pas (ne révèle jamais l'existence d'un compte)

POST /api/auth/reset-password
  Vérifie le code
  Hash le nouveau mot de passe
  Invalide le code
```

### Protection contre le brute-force

- Maximum 5 tentatives de vérification OTP avant blocage (nécessite un nouveau code).
- Les codes OTP expirent automatiquement (10 minutes pour la vérification, 15 minutes pour la réinitialisation).
- Le rate limiter d'authentification limite à 20 requêtes par 15 minutes, avec une clé combinant IP et email ciblé.

### Utiliser le token JWT

```
Authorization: Bearer <token>
```

Expiration selon `JWT_EXPIRES_IN` (défaut 1 jour). Algorithme épinglé HS256, jamais de log du token ou des headers d'authentification.

---

## Documentation de l'API

URL de base : `http://votre-serveur:4000/api`

Sauf mention contraire, toutes les routes ci-dessous nécessitent `Authorization: Bearer <token>`.

### 1. Authentification : `/api/auth` (public)

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/register` | Créer un compte, envoie un OTP de vérification |
| POST | `/login` | Connexion par email et mot de passe |
| POST | `/google` | Connexion ou création de compte via Google OAuth |
| POST | `/verify-email` | Valider le code OTP reçu par email |
| POST | `/resend-verification` | Renvoyer un nouveau code de vérification |
| POST | `/forgot-password` | Demander un code de réinitialisation |
| POST | `/reset-password` | Réinitialiser le mot de passe avec le code reçu |

Exemple, connexion réussie :

```json
POST /api/auth/login
{ "email": "athlete@mail.com", "password": "motdepasse123" }

200 OK
{
  "message": "Connexion réussie.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "_id": "...", "pseudo": "Athlete", "xp": 2400, "level": 8, "rank": "Initié" }
}
```

### 2. Utilisateurs : `/api/users`

| Méthode | Route | Description |
|---------|-------|--------------|
| GET | `/me` | Profil complet de l'utilisateur connecté |
| PUT | `/me` | Mettre à jour le profil (champs optionnels) |
| PUT | `/me/frame` | Mettre à jour le cadre de profil équipé (forme et couleur) |
| PUT | `/me/showcase` | Mettre à jour la vitrine de trophées mis en avant (3 maximum) |
| PUT | `/me/records-showcase` | Mettre à jour les records d'exercices mis en avant (6 maximum) |
| PUT | `/me/push-token` | Enregistrer ou effacer le token de notification push Expo |
| POST | `/me/complete-onboarding` | Marquer le tutoriel interactif comme terminé (idempotent) |
| POST | `/me/sync-xp` | Synchroniser l'XP totale calculée côté client vers le serveur |
| DELETE | `/delete-account` | Supprimer définitivement le compte et toutes ses données (RGPD) |

`POST /me/sync-xp` est le point d'entrée qui fait du serveur la source de vérité pour tout ce qui est contrôlé côté backend (déblocage de coffres au niveau 11, conditions de titres). Il applique un ratchet : l'XP ne redescend jamais, un envoi tardif ou redondant est toujours sans danger.

```json
POST /api/users/me/sync-xp
{ "xp": 15420 }

200 OK
{ "success": true, "level": 22, "xp": 15420, "rank": "Initié", "newlyUnlockedTitles": ["PERFORM_LEVEL_20"] }
```

Suppression de compte : cascade `ExerciseRecord` puis `Workout` puis `User`.

### 3. Séances : `/api/workouts`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/` | Créer et enregistrer une séance déjà terminée |
| GET | `/` | Lister toutes les séances de l'utilisateur, triées par date décroissante |
| GET | `/:id` | Détail complet d'une séance |
| DELETE | `/:id` | Supprimer une séance |
| POST | `/draft` | Créer un brouillon de séance |
| PATCH | `/:id/draft` | Mettre à jour un brouillon (auto-save pendant l'entraînement) |
| POST | `/:id/finalize` | Finaliser une séance : calcule les totaux et applique l'anti-triche serveur |
| POST | `/:id/complete` | Marquer une séance comme complétée (variante allégée de finalize) |

Anti-triche temporel, appliqué côté serveur en miroir du calcul client :

```javascript
if (shortSession === true || duration < 300)   xp = 0             // moins de 5 minutes
else if (duration < 900)                        xp = round(xp / 10) // 5 à 15 minutes
// 15 minutes ou plus : XP plein
```

### 4. Exercices : `/api/exercises`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/` | Enregistrer les performances d'un exercice pour une séance |
| GET | `/leaderboard` | Classement des amis sur un exercice donné |
| GET | `/my-records` | Tous mes records personnels |
| GET | `/history/:name` | Historique de progression d'un exercice (pour les graphes) |
| GET | `/workout/:workoutId` | Tous les records associés à une séance |

### 5. Amis : `/api/friends`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/request` | Envoyer une demande d'ami |
| PUT | `/accept/:requestId` | Accepter une demande reçue |
| PUT | `/decline/:requestId` | Refuser une demande reçue |
| DELETE | `/request/:requestId` | Annuler une demande envoyée |
| DELETE | `/:friendshipId` | Retirer un ami |
| GET | `/list` | Liste de tous mes amis acceptés |
| GET | `/pending` | Demandes reçues en attente |
| GET | `/search` | Rechercher un utilisateur par tag exact (Pseudo suivi de son discriminant) |
| GET | `/leaderboard` | Classement XP entre amis |
| GET | `/profile/:friendId` | Profil public d'un ami |

Chaque amitié possède son propre niveau (1 à 5), qui progresse avec l'XP d'interactions partagées (paliers à 0, 100, 300, 700 et 1500).

### 6. Inventaire : `/api/inventory`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/chest/open` | Ouvrir un coffre (consomme une CHEST_KEY) |
| POST | `/item/use` | Utiliser un objet consommable |
| POST | `/claim` | Réclamer un cosmétique Unique débloqué |

Un coffre s'obtient toutes les 2 heures de séance cumulées, débloqué à partir du rang Initié (niveau 11). Table de drop : commun 60 pour cent, rare 25 pour cent, épique 12 pour cent, légendaire 3 pour cent.

### 7. Groupes de streak : `/api/groups`

| Méthode | Route | Description |
|---------|-------|--------------|
| GET | `/my-group` | Mon groupe actuel, invitations en attente |
| POST | `/leave` | Quitter le groupe |
| POST | `/invite` | Inviter un ami dans le groupe |
| PUT | `/respond/:groupId` | Accepter ou refuser une invitation |
| POST | `/:groupId/shake/:memberId` | Secouer un membre en retard (notification push) |
| POST | `/:groupId/check-streak` | Vérifier et mettre à jour la streak collective du jour |

Un groupe compte 5 membres maximum. La streak collective s'incrémente si tous les membres valident leur journée. Une streak de groupe de 30 jours à taille maximale débloque, une seule fois, le cosmétique Unique Rouge Sang pour chaque membre.

### 8. Récompenses : `/api/rewards`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/birthdate` | Enregistrer la date de naissance (verrouillée après la première saisie) |
| POST | `/birthday/check` | Vérifier si c'est l'anniversaire du jour et distribuer la récompense |
| GET | `/achievements` | Trophées débloqués côté serveur (catalogue de 20 entrées) |
| PUT | `/achievements/sync` | Synchroniser les trophées débloqués localement côté client |
| POST | `/check` | Forcer une réévaluation des conditions de trophées |

### 9. Parrainage : `/api/referral`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/claim` | Valider un code de parrainage reçu |

Récompense le filleul et le parrain d'un Gel de Streak et d'un Coupon de niveau chacun. Impossible d'utiliser son propre code ou un compte déjà parrainé.

### 10. Titres RPG : `/api/profile`

| Méthode | Route | Description |
|---------|-------|--------------|
| GET | `/titles` | Mes titres débloqués et le titre actuellement équipé |
| POST | `/equip-title` | Équiper un titre parmi ceux débloqués |

Catalogue de 17 titres, déblocables par des conditions variées (niveau, records, séances en groupe, entraide).

### 11. Lobby multijoueur : `/api/lobby`

| Méthode | Route | Description |
|---------|-------|--------------|
| POST | `/create` | Créer un lobby |
| GET | `/:id` | État du lobby |
| POST | `/:id/invite` | Inviter un ami |
| POST | `/:id/join` | Rejoindre un lobby existant |
| POST | `/:id/ready` | Se déclarer prêt |
| POST | `/:id/unready` | Annuler son statut prêt |
| POST | `/:id/finish` | Terminer la séance en groupe |

Bonus d'XP de groupe selon le nombre de participants : 2 membres 15 pour cent, 3 membres 25 pour cent, 4 membres 35 pour cent, 5 membres 50 pour cent.

### 12. Flux d'activité : `/api/activity`

| Méthode | Route | Description |
|---------|-------|--------------|
| GET | `/feed` | Événements récents des amis (record battu, coffre légendaire) |
| POST | `/:eventId/react` | Réagir à un événement (bravo, respect, hue, jaloux) |

### 13. Poids : `/api/weight`

| Méthode | Route | Description |
|---------|-------|--------------|
| GET | `/history` | Historique de pesées |
| POST | `/` | Enregistrer une nouvelle pesée |

### 14. Outillage de développement : `/api/debug` (bloqué en production)

Bloc d'endpoints God Mode utilisés pour simuler des états de jeu pendant le développement et les tests manuels (synchronisation de niveau, attribution de coffres et d'objets, simulation de parrainage, d'anniversaire, de groupe, d'événements sociaux, d'invitation de lobby, attribution de tous les titres). Chaque route est protégée par `devOnly.middleware.js`, qui répond 404 dès que `NODE_ENV=production`, pour ne même pas révéler leur existence.

### Santé

```
GET /health   (public)
200 OK  { "status": "OK", "uptime": 3600.42 }
```

---

## Modèles de données

### User

Le modèle central. Identité, vérification email, Google OAuth, profil physique, gamification (XP, niveau, rang calculé), inventaire, coffres, titres débloqués et équipé, cosmétiques Uniques, onboarding, push token, parrainage, trophées, vitrine, cadre de profil équipé. Deux index composés notables : email unique, et le combo pseudo plus discriminant unique (insensible à la casse), qui permet à deux comptes de partager le même pseudo affiché tout en restant identifiables sans ambiguïté pour l'ajout d'ami.

### Workout

Une séance : liste d'exercices avec leurs séries (poids, répétitions, complété), volume total, sets complétés, XP gagné, durée, statut (`draft`, `in_progress`, `finished`, `completed`). Porte les méthodes d'instance `computeTotals()` et `finalize(options)`.

### ExerciseRecord

Performance d'un exercice pour une séance donnée : nom, liste de séries (poids et répétitions), note, poids recommandé pour la prochaine séance.

### Friendship

Relation entre deux utilisateurs (`requester`, `recipient`), statut (`pending`, `accepted`, `rejected`), XP et niveau d'amitié (1 à 5).

### StreakGroup

Groupe de streak collective : membres, invitations en attente, streak courante, date de dernière validation, historique des Secouer envoyés, statut d'attribution du cosmétique Rouge Sang.

### WorkoutLobby

Lobby multijoueur : créateur, membres avec leur statut individuel (`waiting`, `ready`, `finished`), statut global du lobby (`waiting`, `active`, `completed`), pourcentage de bonus d'XP calculé selon le nombre de membres.

### ActivityEvent

Événement du flux d'activité social (record battu, coffre légendaire ouvert) avec ses réactions (`bravo`, `respect`, `boo`, `jealous`) par ami.

### WeightHistory

Historique de pesées : poids et date, un enregistrement par entrée.

---

## Services et logique métier

### auth.service.js

Inscription, connexion par mot de passe, connexion Google, vérification email, renvoi de code, mot de passe oublié, réinitialisation. Génère également les codes de parrainage et discriminants uniques utilisés par `user.service.js`.

### user.service.js

Lecture et mise à jour du profil, mise à jour du cadre équipé, de la vitrine de trophées et de records, enregistrement du push token, marquage de l'onboarding, synchronisation de l'XP avec ratchet anti-régression, suppression de compte en cascade.

### workout.service.js

Création, lecture, suppression de séances, gestion des brouillons, finalisation avec calcul des totaux et application de l'anti-triche temporel serveur.

### exercise.service.js

Enregistrement des performances, historique de progression par exercice, classement entre amis sur un exercice donné.

### email.service.js

Templates HTML de la marque (fond sombre, logo Athly) pour les codes de vérification et de réinitialisation, envoyés via Nodemailer.

### push.service.js

Envoi de notifications push via expo-server-sdk, utilisé pour Secouer, les invitations de groupe et de lobby, les réactions du flux d'activité.

### chest.service.js

Table de drop pondérée et tirage aléatoire d'un objet à l'ouverture d'un coffre.

### inventory.service.js

Logique de consommation atomique des objets d'inventaire, pour éviter toute condition de course sur la dernière unité disponible.

### activity.service.js

Construction et filtrage du flux d'activité social visible par un utilisateur.

---

## Catalogues de données

### `data/titleCatalog.js`

17 titres RPG déblocables, avec leurs conditions (niveau, records personnels, séances en groupe, participation communautaire).

### `data/localTrophyCatalog.js`

Miroir des métadonnées d'affichage des 40 trophées locaux définis côté front, plus le trophée capstone Souverain Absolu qui se débloque automatiquement une fois tous les autres trophées obtenus. Les conditions de déblocage sont évaluées côté client (elles dépendent des logs de séances stockés en AsyncStorage) : ce fichier ne porte que les métadonnées et sert d'allowlist pour la synchronisation.

### `data/shakeMessages.js`

Messages aléatoires envoyés par notification push lors d'un Secouer entre membres de groupe.

### Catalogue de trophées serveur

Défini directement dans `reward.controller.js` (`ACHIEVEMENT_CATALOG`), 20 entrées réparties en trois catégories : profil (anniversaire, parrainage), social (amitié, groupe), collection (raretés d'objets et paliers de coffres ouverts).

---

## Formules de gamification

### Courbe XP et niveau

Source de vérité unique : `utils/levelHelpers.js`, identique à la formule utilisée côté front.

```javascript
xpForLevel(n) = Math.round(4665 * (1.03 ** min(n, 200) - 1))
levelFromXP(xp)   // recherche binaire inverse, plafonnée au niveau 200

// Repères : niveau 1 environ 140 XP, niveau 10 environ 1600 XP,
// niveau 100 environ 85 000 XP, niveau 200 environ 1 720 000 XP
```

### Rangs

Dix paliers, du niveau 1 au niveau 200 et au-delà : Novice, Initié (11), Athlète (31), Compétiteur (51), Warrior (71), Élite (91), Maître (111), Grand Maître (141), Légende (171), ATHLY GOD (200).

### Bonus de groupe (lobby multijoueur)

| Membres | Bonus d'XP |
|---------|------------|
| 2 | 15 pour cent |
| 3 | 25 pour cent |
| 4 | 35 pour cent |
| 5 | 50 pour cent |

---

## Tests

```bash
npm test                    # suite complète
npm test -- --watch         # mode watch
npm test -- --coverage      # couverture de code
```

26 fichiers de tests, exécutés contre une instance MongoDB en mémoire (mongodb-memory-server), démarrée et arrêtée automatiquement par `tests/globalSetup.js` et `tests/globalTeardown.js`. Aucune connexion réseau requise, y compris en intégration continue.

| Fichier | Périmètre |
|---------|-----------|
| `levelHelpers.test.js` | Formule XP et niveau : bornes, plafond, bijectivité |
| `workoutAnticheat.test.js` | Anti-triche serveur sur la finalisation de séance |
| `modelsIntegrity.test.js` | Intégrité des 8 schémas Mongoose |
| `health.test.js` | Point de santé |
| `auth.test.js` | Inscription, connexion, vérification, mot de passe oublié |
| `googleAuth.test.js` | Connexion et création de compte via Google OAuth |
| `discriminator.test.js` | Unicité du combo pseudo et discriminant |
| `user.test.js` | Profil, cadre, vitrines, push token, onboarding, synchronisation XP, suppression de compte |
| `workout.test.js` | CRUD séances, brouillon, finalisation, complétion |
| `exercise.test.js` | Enregistrement de performances, historique, classement |
| `friendship.test.js` | Demandes d'amis, acceptation, refus, retrait, recherche |
| `socialEngine.test.js` | Classement, profil public, niveaux d'amitié |
| `groupStreak.test.js` | Groupes, invitations, streak collective, Secouer |
| `inventory.test.js` | Ouverture de coffres, consommation atomique, réclamation de cosmétiques |
| `reward.test.js` | Trophées serveur, synchronisation, anniversaire |
| `trophyUnification.test.js` | Cohérence du catalogue combiné local plus serveur |
| `bloodSangRewards.test.js` | Attribution du cosmétique Unique de groupe |
| `referral.test.js` | Parrainage, récompenses, garde-fous anti-triche |
| `titles.test.js` | Déblocage et équipement des titres |
| `activityFeed.test.js` | Flux d'activité et réactions |
| `weight.test.js` | Historique de pesées |
| `workoutLobby.test.js` | Cycle de vie complet du lobby multijoueur |
| `debug.test.js` | Endpoints God Mode, blocage en production |
| `profanityFilter.test.js` | Filtre de pseudos |
| `deepIntegration.test.js` | Scénarios croisés de bout en bout |

---

## Intégration continue

Le workflow GitHub Actions (`.github/workflows/ci.yml`) exécute deux jobs indépendants, chacun déclenché uniquement si son dossier a changé :

- **Backend** : installation, lint ESLint, vérification syntaxique de `server.js`, audit de sécurité npm sur les dépendances de production (bloquant à partir du niveau élevé), puis suite de tests complète. Aucune base de données externe n'est requise, la suite Jest démarre sa propre instance en mémoire.
- **Frontend** : installation avec `--legacy-peer-deps`, audit de sécurité npm, puis build de la PWA via `expo export --platform web`, qui détecte immédiatement tout composant natif non compatible avec le web.

Un push qui ne touche que `front/` ne déclenche pas le job backend, et inversement.

---

## Sécurité

| Mesure | Implémentation |
|--------|-----------------|
| Mots de passe hashés | bcrypt |
| JWT à courte durée de vie | Expiration configurable, 1 jour par défaut |
| Vérification email | OTP à 6 chiffres, expiration 10 minutes |
| Brute-force OTP | Blocage après 5 tentatives |
| Headers sécurisés | Helmet (CSP, HSTS, noSniff, frameguard) |
| CORS | Allowlist via `CORS_ORIGINS`, permissif uniquement en développement |
| Rate limiting global | 300 requêtes par 15 minutes et par IP sur `/api` |
| Rate limiting authentification | 20 requêtes par 15 minutes, clé IP plus email ciblé |
| Injection NoSQL | Assainissement récursif des clés suspectes avant toute route |
| Validation des entrées | Schémas Joi sur toutes les routes à corps de requête |
| Limite de payload | 1 Mo maximum par requête |
| Vérification de propriété | Chaque séance ou record est vérifié contre `req.user.id` |
| Cache | `Cache-Control: no-store` sur toutes les réponses `/api` |
| Logs HTTP | Morgan, désactivé pendant les tests |
| Variables sensibles | Jamais en dur, toujours via `.env` |

Détail complet de l'architecture de sécurité et de résilience : `docs/ARCHITECTURE-SECURITE.md` à la racine du dépôt.

---

<div align="center">

Athly API : Node.js, Express, MongoDB. Authentification par mot de passe, OTP et Google OAuth.

</div>
