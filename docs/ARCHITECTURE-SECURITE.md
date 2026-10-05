# Athly : architecture de sécurité et résilience

Référence des protections en place sur la stack (Node.js/Express + PWA Expo Web).
Chaque section pointe vers le fichier source de vérité.

---

## 1. Sécurité API (backend)

| Protection | Implémentation | Fichier |
|---|---|---|
| Headers HTTP durcis | `helmet()` (CSP, HSTS, noSniff, frameguard…) | `back/app.js` |
| CORS restreint | Allowlist via `CORS_ORIGINS` (csv). Sans Origin (app native) → non concerné. Non définie → permissif + warning en prod | `back/app.js` |
| Rate-limiting global | 300 req / 15 min / IP sur `/api` | `back/middleware/rateLimit.middleware.js` |
| Anti brute-force auth | 20 req / 15 min, clé **IP + email ciblé** sur `/api/auth` (login, OTP, reset) | idem |
| Injection NoSQL | Strip récursif des clés `$…` et `a.b` dans body/params/query (express-mongo-sanitize est incompatible Express 5) | `back/middleware/sanitize.middleware.js` |
| Validation entrantes | Schémas Joi sur toutes les routes à body (rejet des champs inconnus par défaut) | `back/validators/*` |
| Payload max | `express.json({ limit: '1mb' })` | `back/app.js` |
| JWT imperméable | Algorithme épinglé HS256, signature+expiration vérifiées, **aucun log de headers/token**, erreur générique côté client | `back/middleware/auth.middleware.js` |
| Cache intermédiaires | `Cache-Control: no-store` sur toutes les réponses `/api` | `back/app.js` |
| Sessions révocables | Chaque requête vérifie que le compte existe encore et que le token a été émis après le dernier changement de mot de passe (`passwordChangedAt`) : un reset ou une suppression de compte coupe toutes les sessions | `back/middleware/auth.middleware.js` |
| Codes OTP | Générés par `crypto.randomInt`, stockés hachés (HMAC lié au compte), comparés à temps constant, 5 essais max, 1 envoi par minute et par compte (refus silencieux, sans révéler l'existence du compte) | `back/services/auth.service.js` |
| Anti-énumération | Mot de passe oublié, renvoi de code et vérification répondent la même chose que l'adresse existe ou non ; login à temps constant (hash leurre) | `back/services/auth.service.js` |
| Mot de passe | 8 caractères minimum, au moins une lettre et un chiffre, 128 maximum (troncature bcrypt) | `back/validators/auth.validator.js` |
| Google | Liaison à un compte existant uniquement si Google certifie l'email (`email_verified`) | `back/services/auth.service.js` |
| Secrets jamais sérialisés | `toJSON`/`toObject` du modèle User retirent mot de passe, codes, compteurs et `googleId` de toute réponse | `back/models/User.js` |
| Erreurs | Messages lisibles en français ; une erreur inattendue ne renvoie jamais son détail technique (stack uniquement en développement local) | `back/middleware/error.middleware.js` |
| Outils de test | `/api/debug` fermé en production et sur tout hébergeur Render sauf opt-in `ENABLE_DEBUG_ROUTES=true` ; God Mode front limité au développement local | `back/middleware/devOnly.middleware.js`, `front/src/constants/devTools.js` |

Notes de déploiement :
- `app.set('trust proxy', 1)` est requis derrière Render pour que `req.ip` soit la vraie IP client.
- **En production, définir `CORS_ORIGINS`** avec le(s) domaine(s) de la PWA.
- Le rate-limiting est désactivé quand `NODE_ENV=test` (les suites Jest enchaînent des centaines de requêtes).

### Intégrité des données de jeu

- **Séances** : un brouillon ne peut fixer que nom, exercices, notes et durée (jamais propriétaire, statut ou XP). La clôture (`/finalize`, `/complete`) est réservée atomiquement : une séance ne rapporte son XP et ses coffres qu'une fois, même en cas de double envoi. Durée prise en compte plafonnée à 6 h.
- **Parrainage, streak de groupe, lobby Multi** : écritures conditionnelles atomiques, aucune double récompense en cas de requêtes simultanées.
- **Accès** : réactions du flux d'activité réservées aux membres du groupe, lobby Multi réservé aux amis de ses participants.
- **RGPD** : la suppression de compte efface séances, records, pesées, amitiés, présence dans les groupes et lobbys, événements et réactions.

## 1 bis. Sécurité de la PWA (Vercel)

En-têtes posés par `front/vercel.json` sur toutes les pages : Content-Security-Policy stricte (scripts du domaine uniquement, aucun script inline, `connect-src` limité à l'API et à Google), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Le token de session est stocké dans le `localStorage` du navigateur : la CSP est la protection principale contre son vol par injection de script.

## 2. Tolérance aux pannes & concurrence

- **Process-level** (`back/server.js`) : `unhandledRejection` logué sans tuer le process ;
  `uncaughtException` → log + exit propre (l'orchestrateur redémarre) ; arrêt gracieux
  SIGTERM/SIGINT (drain des requêtes en cours, fermeture MongoDB, garde-fou 10 s).
- **MongoDB flanche** : Mongoose reconnecte automatiquement (events logués) ; les requêtes
  en échec remontent au error middleware → 500 JSON standardisé, jamais de crash.
- **Race conditions inventaire** (`back/controllers/inventory.controller.js`) :
  consommation d'items **atomique** (`findOneAndUpdate` conditionnel + `$inc`).
  Deux requêtes simultanées sur la dernière `CHEST_KEY` → une seule réussit.
  Test de régression : « 5 ouvertures simultanées → 1 seul succès » (`back/tests/inventory.test.js`).
- **Erreurs de rendu front** : `ErrorBoundary` global (`front/src/components/common/ErrorBoundary.js`)
  monté dans `App.js` : état dégradé + bouton recharger, plus d'écran blanc.

## 3. PWA : hors ligne et performance

- **Service worker** (`front/public/sw.js`, enregistré par `public/register-sw.js`) :
  navigations en *network-first* (4 s max) avec repli sur la coquille hors ligne ;
  fichiers versionnés (`_expo/static`, `assets`) en cache d'abord ; `/api/` jamais caché.
- **Reprise de séance** : la séance en cours est sauvegardée en continu sur l'appareil et
  peut être reprise après une fermeture de l'app (iOS ferme les PWA en arrière-plan).
- **Mode dégradé réseau** (`front/src/api/api.js`) : chaque GET réussi est mis en cache
  AsyncStorage (`athly:apicache:v1:*`) ; si le réseau tombe, les GET sont servis depuis
  ce cache avec `fromCache: true` au lieu d'échouer. **Purgé à la déconnexion**
  (`AuthContext.signOut` → `purgeApiCache`) : rien ne survit sur un appareil partagé.
- **Fuites mémoire** : tous les `setInterval`/listeners du code ont un cleanup vérifié
  (audit 2026-07). Règle : tout `setInterval` dans un effet doit retourner son `clearInterval`.

## 4. CI/CD (`.github/workflows/ci.yml`)

Pipeline sur chaque push/PR vers `main`/`develop` (jobs conditionnés aux chemins modifiés) :

1. **Backend** : ESLint → syntax check → `npm audit --omit=dev --audit-level=high`
   (bloquant) → **près de 500 tests** Jest/Supertest sur **MongoDB en mémoire**
   (`mongodb-memory-server` via `back/tests/globalSetup.js`) : plus aucun besoin de
   service Mongo ni de `MONGO_URI` : l'environnement de test est 100 % hermétique,
   identique en CI et en local. `npm test` local est donc **sans danger** (la base
   Atlas du `.env` est ignorée pendant les tests).
2. **Frontend** : install → `npm audit` (bloquant au niveau critical, voir le commentaire du workflow) → tests unitaires → build PWA complet (`expo export`).

**Blocage du merge** : à activer une fois dans GitHub (Settings → Branches → Branch
protection rules sur `main` et `develop` → *Require status checks to pass* en cochant
les jobs `Backend — Lint, Audit & Tests` et `Frontend — PWA Build`), ou via :

```bash
gh api repos/{owner}/{repo}/branches/develop/protection -X PUT \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=Backend — Lint, Audit & Tests" \
  -f "required_status_checks[contexts][]=Frontend — PWA Build" \
  -F "enforce_admins=false" -F "required_pull_request_reviews=null" -F "restrictions=null"
```
