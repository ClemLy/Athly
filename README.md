<div align="center">

# 🏋️ ATHLY

**Application mobile de fitness gamifiée — React Native + Node.js**

![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

> Transformez chaque séance d'entraînement en expérience de jeu. XP, streaks, quêtes quotidiennes, trophées et rituels de récupération — progresser n'a jamais été aussi addictif.

</div>

---

## Structure du dépôt

```
Athly/
├── front/    ← Application mobile React Native (Expo)
└── back/     ← API REST Node.js / Express / MongoDB
```

Les deux sous-projets ont chacun leur propre README détaillé :
- [📱 Documentation Front-end](front/README.md) — architecture, composants, gamification
- [⚙️ Documentation Back-end](back/README.md) — API REST, modèles, tests

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Expo Go (téléphone) | dernière version |
| Compte MongoDB Atlas | cluster M0 gratuit suffit |
| Compte SMTP | Brevo, Gmail, Yahoo… |

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/ClemLy/Athly.git
cd Athly
```

### 2. Configurer le back-end

```bash
cd back
npm install

# Créer le fichier de variables d'environnement
cp .env.example .env
# → Ouvrir .env et remplir les valeurs (voir section ci-dessous)
```

### 3. Configurer le front-end

```bash
cd ../front
npm install

# Créer le fichier de variables d'environnement
cp .env.example .env
# → Renseigner l'IP locale de votre machine (voir section ci-dessous)
```

---

## Variables d'environnement

### `back/.env`

```env
# Serveur
PORT=4000
NODE_ENV=development

# MongoDB Atlas — remplacer par votre URI de connexion
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/athly

# JWT — générer avec : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=votre_secret_jwt_long_et_aleatoire
JWT_EXPIRES_IN=1d

# SMTP — exemple avec Brevo
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=votre_login_brevo
SMTP_PASS=votre_cle_api_brevo
SMTP_FROM=noreply@votre-domaine.com
```

### `front/.env`

```env
# Adresse IP locale de votre machine (pas localhost — React Native ne le résout pas)
# Sur Windows : ipconfig | grep IPv4
# Sur macOS/Linux : ifconfig | grep "inet "
API_URL=http://VOTRE_IP_LOCALE:4000/api

# Clé de stockage du token JWT (SecureStore)
TOKEN_KEY=athly_token

APP_ENV=development
```

> **Trouver votre IP locale :**
> - Windows : `ipconfig` → chercher "Adresse IPv4"
> - macOS / Linux : `ifconfig` ou `ip addr` → chercher l'adresse en `192.168.x.x`

---

## Lancer l'application

Ouvrir **deux terminaux** :

**Terminal 1 — Back-end**
```bash
cd back
npm run dev
# Serveur démarré sur http://0.0.0.0:4000
# Vérification : curl http://localhost:4000/health
```

**Terminal 2 — Front-end**
```bash
cd front
npm start
# Expo affiche un QR code → scanner avec Expo Go sur votre téléphone
```

> Le téléphone et la machine doivent être sur **le même réseau Wi-Fi**.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────┐
│                  TÉLÉPHONE (Expo Go)                 │
│                                                      │
│  React Native App                                    │
│  ├── AuthContext (JWT via SecureStore)               │
│  ├── WorkoutLogsContext (AsyncStorage — source vérité│
│  ├── QuestContext · TutorialContext · ToastContext   │
│  └── 8 services front (stats, quêtes, auth…)        │
│                                                      │
│         Axios → http://192.168.x.x:4000/api         │
└──────────────────────────┬──────────────────────────┘
                           │  réseau local
┌──────────────────────────▼──────────────────────────┐
│              NODE.JS API (port 4000)                 │
│                                                      │
│  Routes → Controllers → Services → Mongoose          │
│  ├── /api/auth     (register, login, OTP, reset)    │
│  ├── /api/users    (profil, RGPD)                   │
│  ├── /api/workouts (CRUD, draft, finalize)          │
│  └── /api/exercises (performances, historique)       │
│                                                      │
│         MongoDB Atlas (cloud)   Brevo SMTP           │
└─────────────────────────────────────────────────────┘
```

**Répartition des responsabilités :**

| Fonctionnalité | Stockage | Calcul |
|---------------|----------|--------|
| Authentification | MongoDB (back) | back |
| Profil utilisateur | MongoDB (back) | back |
| Logs de séances | AsyncStorage (front) | front |
| XP, streak, niveau | AsyncStorage (front) | front |
| Quêtes quotidiennes | AsyncStorage (front) | front |
| Rituels de récupération | AsyncStorage (front) | front |
| Sync séances | MongoDB (best-effort) | front → back |

---

## Build APK (Android)

Pour générer un APK de production via EAS Build :

```bash
cd front

# Installer EAS CLI (une seule fois)
npm install -g eas-cli
eas login

# Build production
eas build --platform android --profile production
```

Le profil `production` dans `eas.json` pointe vers l'API déployée sur Render (`https://athly-api.onrender.com`). Pour viser votre propre backend, modifier `API_URL` dans la section `env` du profil `production` de `eas.json`.

---

## Tests

**Back-end**
```bash
cd back
npm test
```
73 tests : formule XP/niveau (24), anti-cheat serveur (13), intégrité des schémas Mongoose (36). Les tests unitaires tournent sans connexion MongoDB.

**Front-end**
```bash
cd front
npm test
```

---

## Déploiement

| Composant | Plateforme | Notes |
|-----------|-----------|-------|
| Back-end | Render (Free tier) | Cold-start ~20s — absorbé par le timeout Axios 30s du front |
| Base de données | MongoDB Atlas M0 | Gratuit |
| Emails | Brevo SMTP | Tier gratuit : 300 emails/jour |
| App mobile | EAS Build | APK Android via `eas build --profile production` |

---

<div align="center">

Athly · React Native + Expo · Node.js + Express · MongoDB Atlas

</div>
