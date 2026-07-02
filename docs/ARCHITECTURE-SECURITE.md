# Athly — Architecture de sécurité & résilience

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

Notes de déploiement :
- `app.set('trust proxy', 1)` est requis derrière Render pour que `req.ip` soit la vraie IP client.
- **En production, définir `CORS_ORIGINS`** avec le(s) domaine(s) de la PWA.
- Le rate-limiting est désactivé quand `NODE_ENV=test` (les suites Jest enchaînent des centaines de requêtes).

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
  monté dans `App.js` — état dégradé + bouton recharger, plus d'écran blanc.

## 3. PWA — offline & performance

- **Service worker** (`front/public/sw.js`, cache `athly-shell-v2`) :
  navigations en *network-first* avec fallback shell hors-ligne ; assets statiques en
  *stale-while-revalidate* (chargement instantané) ; `/api/` jamais caché par le SW.
- **Mode dégradé réseau** (`front/src/api/api.js`) : chaque GET réussi est mis en cache
  AsyncStorage (`athly:apicache:v1:*`) ; si le réseau tombe, les GET sont servis depuis
  ce cache avec `fromCache: true` au lieu d'échouer. **Purgé à la déconnexion**
  (`AuthContext.signOut` → `purgeApiCache`) : rien ne survit sur un appareil partagé.
- **Fuites mémoire** : tous les `setInterval`/listeners du code ont un cleanup vérifié
  (audit 2026-07). Règle : tout `setInterval` dans un effet doit retourner son `clearInterval`.

## 4. CI/CD (`.github/workflows/ci.yml`)

Pipeline sur chaque push/PR vers `main`/`develop` (jobs conditionnés aux chemins modifiés) :

1. **Backend** : ESLint → syntax check → `npm audit --omit=dev --audit-level=high`
   (bloquant) → **199 tests** Jest/Supertest sur **MongoDB en mémoire**
   (`mongodb-memory-server` via `back/tests/globalSetup.js`) — plus aucun besoin de
   service Mongo ni de `MONGO_URI` : l'environnement de test est 100 % hermétique,
   identique en CI et en local. `npm test` local est donc **sans danger** (la base
   Atlas du `.env` est ignorée pendant les tests).
2. **Frontend** : install → `npm audit` (bloquant) → build PWA complet (`expo export`).

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
