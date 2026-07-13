// ─── Barrel des services ──────────────────────────────────────────────────────
// Point d'entrée unique : `import { getFriendsList, haptics } from '../services';`
// Tous les services n'exportent que des fonctions/constantes nommées, sans
// collision de noms (vérifié) — l'agrégation en `export *` est donc sûre.
// Règle : ne jamais importer ce barrel DEPUIS un fichier de ce dossier
// (import direct entre services) pour exclure tout cycle de dépendances.

export * from './auth.service';
export * from './customExercises.service';
export * from './debug.service';
export * from './haptics.service';
export * from './inventory.service';
export * from './lobby.service';
export * from './notificationService';
export * from './onboarding.service';
export * from './profile.service';
export * from './quest.service';
export * from './reward.service';
export * from './savedWorkouts.service';
export * from './social.service';
export * from './stats.service';
export * from './title.service';
export * from './weight.service';
export * from './workouts.service';
export * from './xpSync.service';
