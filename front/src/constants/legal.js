import { SUPPORT_EMAIL } from '@env';

// ─── Informations légales ─────────────────────────────────────────────────────
// Source unique pour les pages Confidentialité, Conditions et Mentions légales.
// SUPPORT_EMAIL (front/.env, réglages Vercel) : adresse de contact affichée pour
// les demandes RGPD. Sans elle, le dépôt GitHub sert de point de contact.
export const LEGAL_INFO = {
  appName: 'Athly',
  editorName: 'Clémentin Ly',
  contactEmail: SUPPORT_EMAIL || null,
  contactUrl: 'https://github.com/ClemLy/Athly/issues',
  lastUpdated: '5 octobre 2026',
};

export const LEGAL_DOCS = {
  confidentialite: 'Politique de confidentialité',
  conditions: "Conditions d'utilisation",
  'mentions-legales': 'Mentions légales',
};
