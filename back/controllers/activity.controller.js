'use strict';

const User = require('../models/User');
const { getUnseenFeedForUser, reactToEvent, REACTION_META } = require('../services/activity.service');
const { sendPushToUser } = require('../services/push.service');

/**
 * GET /api/activity/feed
 * Retourne les événements non vus depuis le dernier appel, puis avance le
 * curseur `lastActivityFeedCheckAt` — l'appel suivant ne remontera que les
 * événements postérieurs à celui-ci (pas de doublon en cas d'ouvertures
 * multiples de l'app dans la même journée).
 */
exports.getFeed = async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select('lastActivityFeedCheckAt');
    const since = me?.lastActivityFeedCheckAt || null;

    const events = await getUnseenFeedForUser(req.user.id, since);

    await User.updateOne({ _id: req.user.id }, { $set: { lastActivityFeedCheckAt: new Date() } });

    res.status(200).json({ success: true, events, reactionOptions: REACTION_META });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/activity/:eventId/react
 * Enregistre une réaction (upsert par utilisateur) et notifie en push
 * l'auteur de l'événement — c'est le coeur du côté "taquinerie" du flux.
 */
exports.react = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { emoji } = req.body;

    const { event, notifyActorId } = await reactToEvent(eventId, req.user.id, emoji);

    if (notifyActorId) {
      const reactor = await User.findById(req.user.id).select('pseudo');
      const meta = REACTION_META[emoji];
      await sendPushToUser(notifyActorId, {
        title: 'Athly',
        body: `${reactor?.pseudo ?? 'Un ami'} a réagi ${meta.emoji} : « ${meta.label} »`,
        data: { type: 'activity_reaction', eventId: String(event._id) },
      });
    }

    res.status(200).json({ success: true, reactions: event.reactions });
  } catch (error) {
    next(error);
  }
};
