'use strict';

// Mock global du service d'email pour TOUTE la suite de tests.
//
// email.service.js ouvre une vraie connexion SMTP (Brevo) dès son chargement
// (transporter.verify()) et envoie de vrais emails à chaque inscription/mot de
// passe oublié. Comme quasiment tous les tests créent des utilisateurs via
// register() (helper createAndLoginUser), lancer la suite complète sans ce
// mock épuise le quota gratuit d'envoi en quelques minutes.
//
// Chargé via jest.config.js → setupFilesAfterEnv : exécuté avant chaque
// fichier de test, dans le même registre de modules — email.service.js
// n'est donc jamais réellement chargé ni sa connexion SMTP jamais ouverte.
jest.mock('../services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ mocked: true }),
  sendResetPasswordEmail: jest.fn().mockResolvedValue({ mocked: true }),
}));
