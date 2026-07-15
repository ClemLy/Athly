'use strict';

const WeightHistory = require('../models/WeightHistory');
const User          = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// getWeightHistory  GET /api/weight/history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Historique complet des pesées de l'utilisateur connecté, trié
 * chronologiquement — alimente le graphique double courbe (poids / objectif)
 * de l'écran Statistiques.
 */
exports.getWeightHistory = async (req, res, next) => {
  try {
    const history = await WeightHistory.find({ user: req.user.id })
      .select('weight date')
      .sort({ date: 1 });

    return res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// logWeight  POST /api/weight
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre une nouvelle pesée et met à jour `user.poids` (poids courant
 * affiché ailleurs dans l'app — profil, objectif) pour qu'il reste toujours
 * synchronisé avec la dernière entrée de l'historique.
 *
 * Body : { weight: number, date?: ISO string } — date par défaut = maintenant
 * (permet de renseigner une pesée d'un jour précédent depuis la modale de
 * rappel hebdomadaire sans forcer "aujourd'hui").
 */
exports.logWeight = async (req, res, next) => {
  try {
    const { weight } = req.body;
    const date = req.body.date ? new Date(req.body.date) : new Date();

    // `user.poids` ne doit refléter que la pesée la plus RÉCENTE — une saisie
    // rétroactive (date passée) ne doit jamais écraser une entrée plus fraîche.
    const latest = await WeightHistory.findOne({ user: req.user.id }).sort({ date: -1 });

    const entry = await WeightHistory.create({ user: req.user.id, weight, date });

    if (!latest || date >= latest.date) {
      await User.updateOne({ _id: req.user.id }, { $set: { poids: weight } });
    }

    return res.status(201).json({
      success: true,
      message: 'Pesée enregistrée.',
      entry: { _id: entry._id, weight: entry.weight, date: entry.date },
    });
  } catch (err) {
    next(err);
  }
};
