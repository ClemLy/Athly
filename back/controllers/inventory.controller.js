'use strict';

const User              = require('../models/User');
const { drawChestItem } = require('../services/chest.service');
const { consumeItemAtomic, addItemAtomic, addUniqueItemOnce, purgeEmptyEntries } = require('../services/inventory.service');
const { levelFromXP, getRankForLevel } = require('../utils/levelHelpers');
const { checkAndUnlockAchievements }   = require('./reward.controller');
const { checkAndUnlockTitles }         = require('./title.controller');
const { recordActivityEvent }          = require('../services/activity.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const MIN_LEVEL_FOR_CHEST = 11;

// Coffres cumulés à vie nécessaires pour débloquer le thème cosmétique
// Unique "Rouge Sang Unique" (Réglages → Apparence).
const CHESTS_FOR_BLOOD_SANG_THEME = 100;

// ─── Cosmétiques Uniques réclamables (voir claimUniqueItem) ──────────────────
// itemType (inventaire) → { cosmetic (flag persisté), equip (auto-équipement) }
// equip est optionnel : uniquement pour les cosmétiques de cadre (forme/couleur).
const CLAIMABLE_COSMETICS = {
  PROFILE_FRAME_BLOOD_BOND: {
    cosmetic: 'FRAME_SHAPE_DRAGONFANG',
    equip:    { field: 'equippedFrame.shapeId', value: 'dragonfang' },
  },
  FRAME_COLOR_BLOOD_SANG: {
    cosmetic: 'FRAME_COLOR_BLOODSANG',
    equip:    { field: 'equippedFrame.colorId', value: 'bloodsang' },
  },
  THEME_UNLOCK_BLOOD_SANG: {
    cosmetic: 'THEME_BLOODSANG',
    equip:    null, // le thème de profil est une préférence locale (voir profileThemes.js front)
  },
};

/**
 * Crédite atomiquement `amount` XP et recalcule level/rank si un palier est
 * franchi. Deux écritures ($inc puis $set conditionnel) mais aucune lecture
 * intermédiaire mutable : pas de fenêtre de perte d'XP entre deux consommations
 * simultanées (contrairement à un read → mutate en mémoire → save()).
 */
async function applyXpGain(userId, amount) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { xp: amount } },
    { returnDocument: 'after' },
  );
  if (!updated) return null;

  const newLevel = levelFromXP(updated.xp);
  if (newLevel === updated.level) return updated;

  return User.findOneAndUpdate(
    { _id: userId },
    { $set: { level: newLevel, rank: getRankForLevel(newLevel) } },
    { returnDocument: 'after' },
  );
}

// Effets des consommables — chaque effet est une opération atomique côté DB,
// jamais un mutate-en-mémoire + save() (qui perdrait des écritures concurrentes
// sur xp/streakGels si deux items sont utilisés au même instant).
const ITEM_EFFECTS = {
  ENERGY_DRINK:        (userId) => applyXpGain(userId, 150),
  DOUBLE_XP:           (userId) => applyXpGain(userId, 200),
  TRIPLE_XP:           (userId) => applyXpGain(userId, 300),
  QUINTUPLE_XP:        (userId) => applyXpGain(userId, 500),

  // Pipeline d'agrégation dans l'update : le plafond à 3 est calculé côté
  // MongoDB en une seule écriture atomique (pas de read-then-clamp en JS).
  STREAK_FREEZE: (userId) => User.findOneAndUpdate(
    { _id: userId },
    [{ $set: { streakGels: { $min: [{ $add: ['$streakGels', 1] }, 3] } } }],
    { returnDocument: 'after', updatePipeline: true },
  ),
  SUPER_STREAK_FREEZE: (userId) => User.findOneAndUpdate(
    { _id: userId },
    { $set: { streakGels: 3 } },
    { returnDocument: 'after' },
  ),

  LEVEL_COUPON: async (userId) => {
    const updated = await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { level: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) return null;
    return User.findOneAndUpdate(
      { _id: userId },
      { $set: { rank: getRankForLevel(updated.level) } },
      { returnDocument: 'after' },
    );
  },
};

const VALID_USE_ITEMS = Object.keys(ITEM_EFFECTS);

// ─────────────────────────────────────────────────────────────────────────────
// openChest  POST /api/inventory/chest/open
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ouvre un coffre.
 *
 * Sécurités :
 *  - Niveau minimum 11 (Rang Initié) requis.
 *  - L'utilisateur doit posséder au moins une CHEST_KEY dans son inventaire.
 *
 * Flux :
 *  1. Consomme 1 CHEST_KEY.
 *  2. Tire un item aléatoire via l'algorithme de tirage pondéré.
 *  3. Ajoute l'item à l'inventaire (incrémente si déjà présent).
 *  4. Incrémente le compteur totalChestsOpened (trophées gradués, thème
 *     cosmétique Unique à 100 coffres) et débloque les trophées éligibles.
 */
exports.openChest = async (req, res, next) => {
  try {
    // Consommation atomique : clé décrémentée UNIQUEMENT si possédée ET niveau
    // suffisant, en une seule écriture — aucune fenêtre de double-spend.
    const afterConsume = await consumeItemAtomic(req.user.id, 'CHEST_KEY', {
      level: { $gte: MIN_LEVEL_FOR_CHEST },
    });

    if (!afterConsume) {
      // Diagnostic du refus pour renvoyer l'erreur historique appropriée.
      const user = await User.findById(req.user.id).select('level inventory');
      if (!user) return next(createError('Utilisateur introuvable.', 404));
      if (user.level < MIN_LEVEL_FOR_CHEST) {
        return next(createError("Fonctionnalité bloquée jusqu'au niveau 11.", 403));
      }
      return next(createError('Aucun coffre disponible dans votre inventaire.', 400));
    }

    const drawnItem = drawChestItem();
    await addItemAtomic(req.user.id, drawnItem.itemType, drawnItem.rarity);

    // Flux d'activité (Section IV) : un coffre Légendaire mérite d'être
    // annoncé au groupe — silencieux si l'utilisateur n'a pas de groupe.
    if (drawnItem.rarity === 'legendary') {
      const opener = await User.findById(req.user.id).select('pseudo');
      const pseudo = opener?.pseudo ?? 'Un membre';
      await recordActivityEvent(
        req.user.id,
        'chest_legendary',
        `${pseudo} a ouvert un coffre Légendaire !`,
        { itemType: drawnItem.itemType },
      );
    }

    // Compteur à vie — indépendant de l'inventaire courant (purgé plus bas).
    const afterCount = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $inc: { totalChestsOpened: 1 } },
      { returnDocument: 'after' },
    ).select('totalChestsOpened');

    // Palier 100 coffres : octroie l'item Unique à réclamer (idempotent —
    // addUniqueItemOnce ne ré-ajoute jamais si déjà possédé/réclamé).
    let themeUnlockGranted = false;
    if (afterCount && afterCount.totalChestsOpened >= CHESTS_FOR_BLOOD_SANG_THEME) {
      const granted = await addUniqueItemOnce(req.user.id, 'THEME_UNLOCK_BLOOD_SANG', 'unique');
      themeUnlockGranted = Boolean(granted);
    }

    const finalUser    = await purgeEmptyEntries(req.user.id);
    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);
    const newlyUnlockedTitles = await checkAndUnlockTitles(req.user.id).catch(() => []);

    return res.status(200).json({
      success:   true,
      message:   'Coffre ouvert !',
      drawnItem,
      inventory: finalUser.inventory,
      totalChestsOpened: afterCount ? afterCount.totalChestsOpened : null,
      themeUnlockGranted,
      newlyUnlocked,
      newlyUnlockedTitles,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// claimUniqueItem  POST /api/inventory/claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Réclame un cosmétique Unique en attente dans l'inventaire (cadre "Lien de
 * Sang", couleur "Rouge Sang Unique", thème "Rouge Sang Unique"…).
 *
 * Body : { itemType: string } — doit être une clé de CLAIMABLE_COSMETICS.
 *
 * Flux atomique :
 *  1. Consomme 1 unité de l'item (garde anti double-spend habituelle).
 *  2. Débloque définitivement le cosmétique ($addToSet unlockedCosmetics)
 *     et, pour les cadres, l'équipe automatiquement — en une seule écriture
 *     avec l'étape précédente pour éviter toute fenêtre incohérente.
 *
 * Idempotent au sens sécurité : sans l'item en inventaire, rien ne se passe.
 */
exports.claimUniqueItem = async (req, res, next) => {
  try {
    const { itemType } = req.body;
    const spec = CLAIMABLE_COSMETICS[itemType];

    if (!itemType || !spec) {
      return next(createError(
        `itemType invalide. Valeurs acceptées : ${Object.keys(CLAIMABLE_COSMETICS).join(', ')}.`,
        400,
      ));
    }

    const consumed = await consumeItemAtomic(req.user.id, itemType);
    if (!consumed) {
      const exists = await User.exists({ _id: req.user.id });
      if (!exists) return next(createError('Utilisateur introuvable.', 404));
      return next(createError('Vous ne possédez pas cet objet à réclamer.', 400));
    }

    const update = { $addToSet: { unlockedCosmetics: spec.cosmetic } };
    if (spec.equip) update.$set = { [spec.equip.field]: spec.equip.value };

    const updated = await User.findOneAndUpdate(
      { _id: req.user.id },
      update,
      { returnDocument: 'after' },
    ).select('unlockedCosmetics equippedFrame inventory');

    const finalUser = await purgeEmptyEntries(req.user.id);
    const newlyUnlockedTitles = await checkAndUnlockTitles(req.user.id).catch(() => []);

    return res.status(200).json({
      success:           true,
      message:           'Cosmétique Unique débloqué !',
      unlockedCosmetic:  spec.cosmetic,
      equippedFrame:     updated.equippedFrame,
      unlockedCosmetics: updated.unlockedCosmetics,
      inventory:         finalUser.inventory,
      newlyUnlockedTitles,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// useItem  POST /api/inventory/item/use
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Utilise un consommable de l'inventaire.
 *
 * Body : { itemType: string }
 *
 * Flux :
 *  1. Valide l'itemType.
 *  2. Vérifie la possession et consomme 1 unité.
 *  3. Applique l'effet (XP, streakGels, level, rang…).
 */
exports.useItem = async (req, res, next) => {
  try {
    const { itemType } = req.body;

    if (!itemType || !VALID_USE_ITEMS.includes(itemType)) {
      return next(createError(
        `itemType invalide. Valeurs acceptées : ${VALID_USE_ITEMS.join(', ')}.`,
        400,
      ));
    }

    // Consommation atomique : même garde anti double-spend que openChest.
    const consumed = await consumeItemAtomic(req.user.id, itemType);

    if (!consumed) {
      const exists = await User.exists({ _id: req.user.id });
      if (!exists) return next(createError('Utilisateur introuvable.', 404));
      return next(createError('Vous ne possédez pas cet objet.', 400));
    }

    // Effet 100% atomique côté DB (xp/level/rank/streakGels) — voir ITEM_EFFECTS.
    const user = await ITEM_EFFECTS[itemType](req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const finalUser = await purgeEmptyEntries(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Objet utilisé avec succès.",
      user: {
        xp:         user.xp,
        level:      user.level,
        rank:       user.rank,
        streakGels: user.streakGels,
        inventory:  finalUser.inventory,
      },
    });
  } catch (err) {
    next(err);
  }
};
