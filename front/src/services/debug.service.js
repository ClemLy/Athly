import API from '../api/api';

// Outil de test God Mode → backend (voir back/controllers/debug.controller.js).
// Aligne xp/level/rank backend sur `level` — jamais exposé en production
// (l'endpoint renvoie 404 côté serveur si NODE_ENV=production).
export async function syncBackendLevel(level) {
  const res = await API.post('/debug/sync-level', { level });
  return res.data;
}

// Crédite `amount` CHEST_KEY dans l'inventaire backend (défaut 1).
export async function giveChests(amount = 1) {
  const res = await API.post('/debug/godmode/give-chests', { amount });
  return res.data;
}

// Génère (ou régénère) un faux réseau social : 2 amis acceptés + 1 demande
// en attente reçue, pour tester Classement/Groupe/Accepter-Refuser.
export async function generateMockSocial() {
  const res = await API.post('/debug/godmode/mock-social');
  return res.data;
}

// Injecte 1 exemplaire de CHAQUE objet existant (consommables + cosmétiques
// Uniques réclamables) dans l'inventaire, pour tout tester en un clic.
export async function giveAllItems() {
  const res = await API.post('/debug/godmode/give-all-items');
  return res.data;
}

// Simule `amount` coffres ouverts (sans vraies ouvertures) — débloque les
// trophées gradués CHEST_1…CHEST_200 et le thème Rouge Sang au palier 100.
export async function simulateChestsOpened(amount = 1) {
  const res = await API.post('/debug/godmode/simulate-chests-opened', { amount });
  return res.data;
}

// Crée un filleul factice (referredBy) pour débloquer FIRST_REFERRAL.
export async function simulateReferral() {
  const res = await API.post('/debug/godmode/simulate-referral');
  return res.data;
}

// Force la date de naissance à aujourd'hui pour débloquer BIRTHDAY_SET
// et BIRTHDAY_CELEBRATED sans attendre le vrai jour J.
export async function simulateBirthday() {
  const res = await API.post('/debug/godmode/simulate-birthday');
  return res.data;
}

// ─── Vague 1 : groupe, météo, activité, Hall of Shame, secouer ───────────────

// Crée (ou régénère) un groupe de streak avec 3 coéquipiers factices, un par
// statut de Météo des séances (Prêt/Actif/Validé) — teste weatherStatus, le
// multiplicateur de groupe et le bouton Secouer sans second appareil.
export async function simulateGroup() {
  const res = await API.post('/debug/godmode/simulate-group');
  return res.data;
}

// Publie un ActivityEvent factice au nom d'un coéquipier (jamais soi-même) —
// teste ActivityFeedModal et les réactions. type: 'pr_broken' | 'chest_legendary'.
export async function simulateActivityEvent(type) {
  const res = await API.post('/debug/godmode/simulate-activity-event', type ? { type } : {});
  return res.data;
}

// Recule lastValidatedDate du groupe pour déclencher le Hall of Shame au
// prochain chargement de l'onglet Groupe.
export async function simulateStreakBreak() {
  const res = await API.post('/debug/godmode/simulate-streak-break');
  return res.data;
}

// Envoie une vraie notification push au token Expo de l'utilisateur connecté
// (même texte troll que le vrai bouton Secouer) — vérifie l'infra push de
// bout en bout sans second compte/appareil.
export async function simulateShakeSelf() {
  const res = await API.post('/debug/godmode/simulate-shake-self');
  return res.data;
}

// ─── Vague 2 : tag Discord, ajout d'ami ───────────────────────────────────────

// Crée un compte de test PAS déjà ami (contrairement à generateMockSocial) —
// seul moyen de tester en solo le parcours complet "Ajouter un ami" :
// recherche par tag exact, carte Preview, envoi réel de la demande.
export async function simulateSearchableFriend() {
  const res = await API.post('/debug/godmode/simulate-searchable-friend');
  return res.data;
}
