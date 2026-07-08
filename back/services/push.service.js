'use strict';

const User = require('../models/User');

// ─── Service d'envoi de notifications push (Expo) ─────────────────────────────
// Seul point du backend qui parle réellement à un appareil. Tout le reste de
// l'app (shakeMember, réactions du flux d'activité…) passe par sendPushToUser
// plutôt que d'appeler expo-server-sdk directement — un seul endroit à changer
// si le fournisseur de push évolue un jour.
//
// Conçu pour ne JAMAIS faire échouer l'appelant : un push est un bonus UX, pas
// une opération critique. Toute erreur (token absent, invalide, Expo down) est
// avalée et loguée — les fonctions retournent simplement `false`.
//
// expo-server-sdk est distribué en pur ESM ("type": "module", pas de build
// CJS) alors que tout ce backend est en CommonJS : on ne peut pas le
// `require()` directement (SyntaxError au chargement). Un `import()`
// dynamique fonctionne depuis du code CJS et est mis en cache par le moteur
// après le premier appel — le coût de chargement n'est payé qu'une fois.
let expoModulePromise = null;
async function getExpoModule() {
  if (!expoModulePromise) {
    expoModulePromise = import('expo-server-sdk');
  }
  return expoModulePromise;
}

/**
 * Envoie une notification push à UN utilisateur via son pushToken enregistré.
 * No-op silencieux si l'utilisateur n'a pas de token (jamais ouvert l'app côté
 * notifications, ou les a refusées).
 *
 * @param {string} userId
 * @param {{ title: string, body: string, data?: object }} message
 * @returns {Promise<boolean>} true si un ticket d'envoi a été obtenu
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const { Expo } = await getExpoModule();
    const expo = new Expo();
    const user = await User.findById(userId).select('pushToken');
    if (!user || !user.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
      return false;
    }

    const [ticket] = await expo.sendPushNotificationsAsync([{
      to:     user.pushToken,
      sound:  'default',
      title,
      body,
      data,
    }]);

    if (ticket?.status === 'error') {
      console.warn(`⚠️ [PUSH] Échec d'envoi à ${userId} :`, ticket.message, ticket.details);
      // Token périmé/désinstallé : on le retire pour ne plus retenter dans le vide.
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await User.updateOne({ _id: userId }, { $set: { pushToken: null } });
      }
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`⚠️ [PUSH] Erreur d'envoi à ${userId} :`, err.message);
    return false;
  }
}

/**
 * Envoie la même notification à plusieurs utilisateurs (best-effort, en
 * parallèle). Utile pour les événements de groupe (ex: annonce à toute
 * l'équipe). Ne lève jamais — chaque envoi individuel gère déjà ses erreurs.
 *
 * @param {string[]} userIds
 * @param {{ title: string, body: string, data?: object }} message
 */
async function sendPushToUsers(userIds, message) {
  await Promise.all(userIds.map((id) => sendPushToUser(id, message)));
}

module.exports = { sendPushToUser, sendPushToUsers };
