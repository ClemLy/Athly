<div align="center">

# ATHLY

**Application mobile de fitness gamifiée. React Native, Expo, Node.js, MongoDB**

![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)
![License](https://img.shields.io/badge/License-GPLv3-blue?style=flat-square)

Athly transforme chaque séance d'entraînement en expérience de jeu. XP, niveaux, streaks, quêtes quotidiennes, plus de 60 trophées, 17 titres RPG, coffres à ouvrir, amis, groupes de streak collective et lobby multijoueur : progresser n'a jamais été aussi complet.

</div>

---

## Structure du dépôt

```
Athly/
  front/    Application mobile et PWA, React Native (Expo)
  back/     API REST, Node.js, Express, MongoDB
  docs/     Documentation transverse (architecture de sécurité)
```

Chaque sous-projet a son propre README détaillé :

- [Documentation Front-end](front/README.md) : fonctionnalités, architecture, gamification, navigation
- [Documentation Back-end](back/README.md) : API REST complète, modèles de données, tests

---

## Prérequis

| Outil | Version minimale |
|-------|--------------------|
| Node.js | 18 ou supérieur |
| npm | 9 ou supérieur |
| Expo Go (téléphone) | dernière version |
| Compte MongoDB Atlas | cluster M0 gratuit suffit |
| Compte SMTP | Brevo, ou équivalent |

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/ClemLy/Athly.git
cd Athly
```

### 2. Configurer le backend

```bash
cd back
npm install
cp .env.example .env
# Ouvrir .env et remplir les valeurs, voir la section Variables d'environnement
```

### 3. Configurer le frontend

```bash
cd ../front
npm install
cp .env.example .env
# Renseigner l'URL du backend, voir la section suivante
```

---

## Variables d'environnement

Le détail complet de chaque variable, avec son usage exact, se trouve dans les fichiers `.env.example` de chaque sous-projet. Résumé minimal pour démarrer :

### `back/.env`

```env
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/athly
JWT_SECRET=secret_long_et_aleatoire
JWT_EXPIRES_IN=1d
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=votre_login_brevo
SMTP_PASS=votre_cle_api_brevo
SMTP_FROM=noreply@votre-domaine.com
# Optionnel, pour activer la connexion Google :
GOOGLE_CLIENT_IDS=
# Optionnel, pour restreindre le CORS en production :
CORS_ORIGINS=
```

### `front/.env`

```env
# Adresse IP locale de la machine, pas localhost : React Native sur un
# téléphone physique ne peut pas résoudre localhost.
API_URL=http://VOTRE_IP_LOCALE:4000/api
TOKEN_KEY=athly_token
APP_ENV=development
# Optionnel, pour activer le bouton Google (un Client ID par plateforme) :
GOOGLE_EXPO_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_WEB_CLIENT_ID=
```

Trouver son IP locale : `ipconfig` sous Windows, `ifconfig` ou `ip addr` sous macOS et Linux.

---

## Lancer l'application

Ouvrir deux terminaux.

**Terminal 1, backend**

```bash
cd back
npm run dev
# Serveur démarré sur http://0.0.0.0:4000
# Vérification : curl http://localhost:4000/health
```

**Terminal 2, frontend**

```bash
cd front
npm start
# Expo affiche un QR code à scanner avec Expo Go
```

Le téléphone et la machine doivent être sur le même réseau Wi-Fi.

---

## Architecture globale

```
Téléphone ou navigateur (Expo Go, PWA)
  React Native / React Native Web
    AuthContext (JWT via SecureStore)
    UserContext, WorkoutLogsContext, QuestContext,
    SavedWorkoutsContext, CustomExercisesContext,
    TutorialContext, ToastContext
    17 services front, exposés via un barrel unique

  Axios -> http://votre-serveur:4000/api

API Node.js (port 4000)
  Routes -> Controllers -> Services -> Mongoose
    /api/auth        inscription, connexion, OTP, Google, réinitialisation
    /api/users       profil, cadre équipé, vitrines, synchronisation XP, RGPD
    /api/workouts    séances, brouillons, finalisation, anti-triche
    /api/exercises   performances, historique, classement
    /api/friends     amis, demandes, classement, profil public
    /api/inventory   coffres, objets, cosmétiques Uniques
    /api/groups      groupes de streak collective
    /api/rewards     trophées serveur, anniversaire
    /api/referral    parrainage
    /api/profile     titres RPG
    /api/lobby       lobby multijoueur
    /api/activity    flux d'activité et réactions
    /api/weight      historique de poids
    /api/debug       outillage God Mode, bloqué en production

  MongoDB Atlas        Brevo SMTP        Google OAuth (optionnel)
```

### Répartition des responsabilités

| Fonctionnalité | Stockage | Calcul |
|-----------------|----------|--------|
| Authentification | MongoDB (backend) | backend |
| Profil utilisateur | MongoDB (backend) | backend |
| Social, groupes, lobby, inventaire, titres | MongoDB (backend) | backend |
| Logs de séances | AsyncStorage (frontend) | frontend |
| XP, streak, niveau local | AsyncStorage (frontend) | frontend |
| Quêtes quotidiennes, rituels | AsyncStorage (frontend) | frontend |
| Synchronisation de l'XP totale | MongoDB, best effort | frontend calcule, backend fait autorité |

---

## Build (Android et PWA)

### APK Android via EAS Build

```bash
cd front
npm install -g eas-cli
eas login
eas build --platform android --profile production
```

Le profil `production` dans `front/eas.json` pointe vers l'API déployée. Pour cibler un autre backend, modifier `API_URL` dans la section `env` de ce profil.

### PWA web

```bash
cd front
npm run build:web
# expo export --platform web, puis copie du service worker
```

---

## Tests

**Backend**

```bash
cd back
npm test
```

26 fichiers de tests, exécutés contre une instance MongoDB en mémoire, sans dépendance réseau externe. Couvre l'authentification, le profil, les séances, le social, les groupes, l'inventaire, les trophées, les titres, le lobby multijoueur et l'ensemble des formules de gamification.

**Frontend**

```bash
cd front
npm test
```

3 suites Jest sur les modules de données et services purs.

---

## Intégration continue

Le workflow GitHub Actions (`.github/workflows/ci.yml`) exécute deux jobs indépendants, filtrés par dossier modifié :

- Backend : lint, vérification syntaxique, audit de sécurité npm, suite de tests complète, sans base de données externe.
- Frontend : audit de sécurité npm, build de la PWA (`expo export --platform web`), pour détecter tout composant natif incompatible avec le web.

---

## Déploiement

| Composant | Plateforme | Notes |
|-----------|------------|-------|
| Backend | Render (tier gratuit) | Démarrage à froid d'environ 20 secondes, absorbé par le timeout Axios du front |
| Base de données | MongoDB Atlas M0 | Gratuit |
| Emails | Brevo SMTP | Tier gratuit à 300 emails par jour |
| Application mobile | EAS Build | APK Android via `eas build --profile production` |
| PWA | Build statique | `npm run build:web`, à héberger sur tout service de fichiers statiques |

---

## Sécurité

Le détail complet des protections (headers HTTP, rate limiting, validation, assainissement anti-injection, tolérance aux pannes) est documenté dans [docs/ARCHITECTURE-SECURITE.md](docs/ARCHITECTURE-SECURITE.md).

---

## Licence

Distribué sous licence GNU GPLv3. Voir le fichier [LICENSE](LICENSE).

---

<div align="center">

Athly : React Native + Expo, Node.js + Express, MongoDB Atlas

</div>
