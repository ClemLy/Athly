import { APP_ENV } from '@env';

// ─── Outils de développement (God Mode, bypass anti-triche…) ─────────────────
// Disponibles uniquement en développement local (expo start) ou sur un build
// de recette explicitement marqué APP_ENV=staging. Jamais sur la PWA publique :
// sinon n'importe quel utilisateur pourrait s'injecter de l'XP, puis la
// synchroniser vers le serveur et fausser les classements entre amis.
export const DEV_TOOLS_ENABLED = (typeof __DEV__ !== 'undefined' && __DEV__) || APP_ENV === 'staging';
