'use strict';

const ActivityEvent = require('../models/ActivityEvent');
const StreakGroup   = require('../models/StreakGroup');

// Punchlines associées à chaque bouton de réaction (Section IV — flux
// "Taquineries & High-Fives"). Clé stable stockée en DB, libellé affiché
// uniquement côté service pour rester la seule source de vérité.
const REACTION_META = {
  bravo:   { emoji: '💪', label: 'Bien joué mec !' },
  respect: { emoji: '🔥', label: 'Respect !' },
  boo:     { emoji: '👎', label: 'Bouuuuuh !' },
  jealous: { emoji: '👀', label: 'Jalouser' },
};

/**
 * Crée un ActivityEvent pour le groupe de `actorId`, si celui-ci appartient
 * à un groupe. Silencieux si aucun groupe (pas de feed sans groupe) — ne
 * doit jamais faire échouer l'action qui l'a déclenché (PR, coffre...).
 */
async function recordActivityEvent(actorId, type, message, payload = {}) {
  try {
    const group = await StreakGroup.findOne({ members: actorId }).select('_id');
    if (!group) return null;

    return await ActivityEvent.create({ group: group._id, actor: actorId, type, message, payload });
  } catch (err) {
    console.warn(`⚠️ [ACTIVITY] Échec de création d'événement (${type}) :`, err.message);
    return null;
  }
}

/**
 * Événements non encore vus par `userId` dans son groupe, depuis son dernier
 * check (`lastActivityFeedCheckAt`). Exclut les événements dont l'utilisateur
 * est lui-même l'auteur (on ne s'auto-taquine pas).
 */
async function getUnseenFeedForUser(userId, since) {
  const group = await StreakGroup.findOne({ members: userId }).select('_id');
  if (!group) return [];

  const query = { group: group._id, actor: { $ne: userId } };
  if (since) query.createdAt = { $gt: since };

  return ActivityEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('actor', 'pseudo level rank')
    .populate('reactions.user', 'pseudo');
}

/**
 * Ajoute/remplace la réaction de `reactorId` sur un événement (une réaction
 * par utilisateur — un second clic change simplement l'émotion choisie).
 * Retourne l'ID de l'auteur de l'événement (pour notifier), ou null si
 * l'événement n'existe pas ou si on réagit à son propre événement.
 */
async function reactToEvent(eventId, reactorId, emoji) {
  if (!REACTION_META[emoji]) {
    const err = new Error('Réaction invalide.');
    err.statusCode = 400;
    throw err;
  }

  const event = await ActivityEvent.findById(eventId);
  if (!event) {
    const err = new Error('Événement introuvable.');
    err.statusCode = 404;
    throw err;
  }

  event.reactions = event.reactions.filter((r) => String(r.user) !== String(reactorId));
  event.reactions.push({ user: reactorId, emoji });
  await event.save();

  if (String(event.actor) === String(reactorId)) return { event, notifyActorId: null };
  return { event, notifyActorId: event.actor };
}

module.exports = { REACTION_META, recordActivityEvent, getUnseenFeedForUser, reactToEvent };
