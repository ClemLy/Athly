'use strict';

const CloudItem = require('../models/CloudItem');
const { CLOUD_KINDS } = require('../models/CloudItem');
const User = require('../models/User');
const Workout = require('../models/Workout');
const userService = require('../services/user.service');

// ─── Sauvegarde du compte (voir models/CloudItem.js) ──────────────────────────

// Garde-fous : un compte réel reste très loin de ces plafonds (20 000 séances,
// c'est plus de 50 ans à raison d'une séance par jour).
const MAX_ITEMS = { logs: 20000, savedWorkouts: 500, customExercises: 1000, prefs: 50 };
const MAX_ITEM_BYTES = { logs: 64 * 1024, savedWorkouts: 64 * 1024, customExercises: 16 * 1024, prefs: 8 * 1024 };

function businessError(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function kindFrom(req) {
  const { kind } = req.params;
  if (!CLOUD_KINDS.includes(kind)) throw businessError(404, "Cette sauvegarde n'existe pas.", 'CLOUD_KIND_UNKNOWN');
  return kind;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cloud/:kind : tous les éléments sauvegardés (y compris suppressions)
// ─────────────────────────────────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const kind = kindFrom(req);
    const docs = await CloudItem.find({ user: req.user.id, kind })
      .select('clientId data deleted -_id')
      .lean();
    const items = docs.map((d) => ({ id: d.clientId, data: d.deleted ? null : d.data, deleted: !!d.deleted }));
    return res.status(200).json({ success: true, items });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cloud/:kind/sync : applique un lot de modifications du téléphone
// Body : { puts: [élément complet avec son id], dels: [id] }
// ─────────────────────────────────────────────────────────────────────────────
exports.sync = async (req, res, next) => {
  try {
    const kind = kindFrom(req);
    const user = req.user.id;
    const { puts = [], dels = [] } = req.body;

    const tooBig = puts.find((p) => Buffer.byteLength(JSON.stringify(p)) > MAX_ITEM_BYTES[kind]);
    if (tooBig) {
      throw businessError(413, 'Un des éléments à sauvegarder est trop volumineux.', 'CLOUD_ITEM_TOO_LARGE');
    }

    if (puts.length > 0) {
      const putIds = puts.map((p) => p.id);
      const [alive, alreadyAlive] = await Promise.all([
        CloudItem.countDocuments({ user, kind, deleted: false }),
        CloudItem.countDocuments({ user, kind, deleted: false, clientId: { $in: putIds } }),
      ]);
      if (alive + (puts.length - alreadyAlive) > MAX_ITEMS[kind]) {
        throw businessError(413, 'Ta sauvegarde a atteint sa taille maximale.', 'CLOUD_FULL');
      }
    }

    const ops = [
      ...puts.map((p) => ({
        updateOne: {
          filter: { user, kind, clientId: p.id },
          update: { $set: { data: p, deleted: false } },
          upsert: true,
        },
      })),
      // Une suppression gagne sur une écriture du même lot (le téléphone
      // n'envoie jamais les deux pour un même id).
      ...dels.map((id) => ({
        updateOne: {
          filter: { user, kind, clientId: id },
          update: { $set: { data: null, deleted: true } },
          upsert: true,
        },
      })),
    ];
    if (ops.length > 0) await CloudItem.bulkWrite(ops, { ordered: true });

    // L'XP du compte suit l'historique sauvegardé (voir recomputeXpFromBackup)
    let xp;
    if (kind === 'logs' && ops.length > 0) {
      xp = (await userService.recomputeXpFromBackup(user)).xp;
    }

    return res.status(200).json({ success: true, saved: puts.length, deleted: dels.length, xp });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cloud/recovery : de quoi reconstruire un historique perdu avant la
// sauvegarde du compte.
//  - workouts : séances terminées enregistrées par le serveur (exercices,
//    séries, durée, date) ;
//  - xpFloor : XP déjà acquise avant la sauvegarde (quêtes et rituels
//    compris), sans le double comptage (voir user.service → ensureXpFloor).
// ─────────────────────────────────────────────────────────────────────────────
exports.recovery = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('xp xpFloor');
    if (!user) throw businessError(404, 'Ce compte est introuvable.', 'USER_NOT_FOUND');
    const xpFloor = await userService.ensureXpFloor(user);

    const workouts = await Workout.find({ user: req.user.id, status: { $in: Workout.FINAL_STATUSES } })
      .select('name date completedAt updatedAt durationSeconds shortSession exercises.name exercises.targetMuscle exercises.sets.weight exercises.sets.reps exercises.sets.completed')
      .sort({ updatedAt: -1 })
      .limit(5000)
      .lean();

    return res.status(200).json({
      success: true,
      xpFloor,
      workouts: workouts.map((w) => ({
        id: String(w._id),
        name: w.name,
        finishedAt: w.completedAt || w.updatedAt || w.date,
        durationSeconds: w.durationSeconds || 0,
        shortSession: !!w.shortSession,
        exercises: (w.exercises || []).map((e) => ({
          name: e.name,
          targetMuscle: e.targetMuscle || '',
          sets: (e.sets || []).map((st) => ({ weight: st.weight || 0, reps: st.reps || 0, completed: !!st.completed })),
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
};
