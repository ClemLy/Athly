'use strict';

const User       = require('../models/User');
const Friendship = require('../models/Friendship');
const { LOCAL_TROPHY_IDS } = require('../data/localTrophyCatalog');

// ─── Catalogue des trophées ───────────────────────────────────────────────────
// Source de vérité unique. Chaque entrée décrit un trophée du jeu.
// hidden: true → le trophée est masqué jusqu'à son déblocage (surprise).

const ACHIEVEMENT_CATALOG = {
  // ── Profil ───────────────────────────────────────────────────────────────────
  BIRTHDAY_SET: {
    id:          'BIRTHDAY_SET',
    name:        "Né(e) pour Athly",
    description: "Vous avez renseigné votre date de naissance.",
    category:    'profile',
    hidden:      true,
  },
  BIRTHDAY_CELEBRATED: {
    id:          'BIRTHDAY_CELEBRATED',
    name:        'Fêter son anniversaire',
    description: "Vous avez réclamé votre cadeau d'anniversaire sur Athly.",
    category:    'profile',
    hidden:      false,
  },

  // ── Collection (inventaire) ───────────────────────────────────────────────
  FIRST_COMMON_ITEM: {
    id:          'FIRST_COMMON_ITEM',
    name:        'Premier Butin',
    description: "Vous avez obtenu votre premier objet Commun.",
    category:    'collection',
    hidden:      false,
  },
  FIRST_RARE_ITEM: {
    id:          'FIRST_RARE_ITEM',
    name:        'Chasseur de Raretés',
    description: "Vous avez obtenu votre premier objet Rare.",
    category:    'collection',
    hidden:      false,
  },
  FIRST_EPIC_ITEM: {
    id:          'FIRST_EPIC_ITEM',
    name:        'Touche Épique',
    description: "Vous avez obtenu votre premier objet Épique.",
    category:    'collection',
    hidden:      false,
  },
  FIRST_LEGENDARY_ITEM: {
    id:          'FIRST_LEGENDARY_ITEM',
    name:        'Légende Vivante',
    description: "Vous avez obtenu votre premier objet Légendaire.",
    category:    'collection',
    hidden:      false,
  },
  FIRST_UNIQUE_ITEM: {
    id:          'FIRST_UNIQUE_ITEM',
    name:        'ATHLY UNIQUE',
    description: "Vous avez obtenu votre premier objet Unique.",
    category:    'collection',
    hidden:      false,
  },

  // ── Coffres (paliers gradués) ─────────────────────────────────────────────
  CHEST_1: {
    id:          'CHEST_1',
    name:        'Premier Trésor',
    description: 'Vous avez ouvert votre premier coffre.',
    category:    'collection',
    hidden:      false,
  },
  CHEST_10: {
    id:          'CHEST_10',
    name:        'Chasseur de Coffres',
    description: 'Vous avez ouvert 10 coffres.',
    category:    'collection',
    hidden:      false,
  },
  CHEST_50: {
    id:          'CHEST_50',
    name:        'Pilleur Aguerri',
    description: 'Vous avez ouvert 50 coffres.',
    category:    'collection',
    hidden:      false,
  },
  CHEST_100: {
    id:          'CHEST_100',
    name:        'Maître du Butin',
    description: 'Vous avez ouvert 100 coffres.',
    category:    'collection',
    hidden:      false,
  },
  CHEST_200: {
    id:          'CHEST_200',
    name:        'Seigneur des Coffres',
    description: 'Vous avez ouvert 200 coffres.',
    category:    'collection',
    hidden:      false,
  },

  // ── Social ────────────────────────────────────────────────────────────────
  FIRST_REFERRAL: {
    id:          'FIRST_REFERRAL',
    name:        'Recruteur Athly',
    description: "Vous avez parrainé votre premier ami.",
    category:    'social',
    hidden:      false,
  },
  FRIENDSHIP_LEVEL_5: {
    id:          'FRIENDSHIP_LEVEL_5',
    name:        'Lien de Sang',
    description: "Vous avez atteint le niveau d'amitié maximum (5) avec un ami.",
    category:    'social',
    hidden:      false,
  },
};

// Nombre total de trophées dans le catalogue (utile pour les stats)
const CATALOG_SIZE = Object.keys(ACHIEVEMENT_CATALOG).length;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// True si `date` tombe le même jour/mois que `birthdate`, quelle que soit l'année.
// Comparaison en UTC pour rester déterministe indépendamment du fuseau du serveur.
function isSameDayAndMonth(birthdate, date) {
  return (
    birthdate.getUTCDate()  === date.getUTCDate() &&
    birthdate.getUTCMonth() === date.getUTCMonth()
  );
}

// ─── checkAndUnlockAchievements ───────────────────────────────────────────────
/**
 * Vérifie l'état de l'utilisateur et débloque tous les trophées dont les
 * conditions sont remplies mais pas encore accordés.
 *
 * Conçue pour être appelée après chaque action clé :
 *   - Ouverture de coffre (inventory.controller → openChest)
 *   - Acceptation d'amitié ou montée de niveau (friend.controller)
 *   - Saisie de la date de naissance (setBirthdate)
 *   - Validation de séance de groupe (groupStreak.controller)
 *
 * @param {string} userId  ObjectId (string) de l'utilisateur
 * @returns {string[]}     Liste des IDs de trophées nouvellement débloqués
 */
async function checkAndUnlockAchievements(userId) {
  const user = await User.findById(userId);
  if (!user) return [];

  const unlockedIds  = new Set(user.achievements.map((a) => a.achievementId));
  const newlyUnlocked = [];

  function tryUnlock(achievementId) {
    if (unlockedIds.has(achievementId)) return;
    user.achievements.push({ achievementId });
    unlockedIds.add(achievementId);
    newlyUnlocked.push(achievementId);
  }

  // ── Trophées anniversaire ──────────────────────────────────────────────────
  if (user.isBirthdateSet) tryUnlock('BIRTHDAY_SET');
  if (user.lastBirthdayRewardedYear != null) tryUnlock('BIRTHDAY_CELEBRATED');

  // ── Trophées de collection : 1 item par rareté dans l'inventaire ──────────
  const RARITY_ACHIEVEMENTS = {
    common:    'FIRST_COMMON_ITEM',
    rare:      'FIRST_RARE_ITEM',
    epic:      'FIRST_EPIC_ITEM',
    legendary: 'FIRST_LEGENDARY_ITEM',
    unique:    'FIRST_UNIQUE_ITEM',
  };

  for (const [rarity, achievementId] of Object.entries(RARITY_ACHIEVEMENTS)) {
    if (!unlockedIds.has(achievementId)) {
      const hasItem = user.inventory.some((i) => i.rarity === rarity && i.quantity > 0);
      if (hasItem) tryUnlock(achievementId);
    }
  }

  // ── Trophées de coffres : paliers gradués sur totalChestsOpened ───────────
  const CHEST_ACHIEVEMENTS = [
    [1,   'CHEST_1'],
    [10,  'CHEST_10'],
    [50,  'CHEST_50'],
    [100, 'CHEST_100'],
    [200, 'CHEST_200'],
  ];
  for (const [threshold, achievementId] of CHEST_ACHIEVEMENTS) {
    if (!unlockedIds.has(achievementId) && user.totalChestsOpened >= threshold) {
      tryUnlock(achievementId);
    }
  }

  // ── Trophées sociaux ───────────────────────────────────────────────────────

  // Premier parrainage : l'utilisateur a recruté au moins un autre joueur
  if (!unlockedIds.has('FIRST_REFERRAL')) {
    const hasReferred = await User.exists({ referredBy: userId });
    if (hasReferred) tryUnlock('FIRST_REFERRAL');
  }

  // Amitié niveau max : au moins une Friendship acceptée au niveau 5
  if (!unlockedIds.has('FRIENDSHIP_LEVEL_5')) {
    const hasMaxFriend = await Friendship.exists({
      $or: [{ requester: userId }, { recipient: userId }],
      status:          'accepted',
      friendshipLevel: 5,
    });
    if (hasMaxFriend) tryUnlock('FRIENDSHIP_LEVEL_5');
  }

  if (newlyUnlocked.length > 0) {
    user.markModified('achievements');
    await user.save();
  }

  return newlyUnlocked;
}

// ─────────────────────────────────────────────────────────────────────────────
// setBirthdate  POST /api/rewards/birthdate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre la date de naissance de l'utilisateur.
 *
 * Anti-triche : isBirthdateSet passe à true de façon irréversible.
 * Toute tentative de modification ultérieure est bloquée avec une 403.
 *
 * Récompenses automatiques :
 *  - 1 CHEST_KEY ajoutée à l'inventaire (coffre de bienvenue).
 *  - Trophée caché BIRTHDAY_SET débloqué via checkAndUnlockAchievements.
 */
exports.setBirthdate = async (req, res, next) => {
  try {
    const myId        = req.user.id;
    const { birthdate } = req.body;

    if (!birthdate) return next(createError('Le champ birthdate est obligatoire.', 400));

    const dateObj = new Date(birthdate);
    if (isNaN(dateObj.getTime())) {
      return next(createError('Format de date invalide. Utilisez ISO 8601 (ex: 1995-03-15).', 400));
    }
    if (dateObj >= new Date()) {
      return next(createError("La date de naissance doit être dans le passé.", 400));
    }

    const user = await User.findById(myId);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    // ── Garde anti-triche ──────────────────────────────────────────────────
    if (user.isBirthdateSet) {
      return next(createError("La date de naissance ne peut être modifiée qu'une seule fois.", 403));
    }

    // Enregistrement
    user.birthdate      = dateObj;
    user.isBirthdateSet = true;

    // Coffre de bienvenue : +1 CHEST_KEY
    const existingKey = user.inventory.find((i) => i.itemType === 'CHEST_KEY');
    if (existingKey) {
      existingKey.quantity += 1;
    } else {
      user.inventory.push({ itemType: 'CHEST_KEY', rarity: 'common', quantity: 1 });
    }
    user.markModified('inventory');
    await user.save();

    // Déblocage des trophées (déclenche BIRTHDAY_SET et éventuellement d'autres)
    const newlyUnlocked = await checkAndUnlockAchievements(myId);

    return res.status(200).json({
      success:        true,
      message:        'Date de naissance enregistrée. Profitez de votre coffre offert !',
      isBirthdateSet: true,
      chestKeyAdded:  true,
      newlyUnlocked,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// checkBirthday  POST /api/rewards/birthday/check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * À appeler au login / au chargement de l'app.
 *
 * Si aujourd'hui est le jour de naissance de l'utilisateur et que le cadeau
 * n'a pas encore été réclamé cette année civile :
 *  - Octroie 1 CHEST_KEY (cadeau de bienvenue, prépare la Brique II).
 *  - Débloque le trophée BIRTHDAY_CELEBRATED (prépare la Brique V).
 *  - Marque `lastBirthdayRewardedYear` avec l'année en cours.
 *
 * Idempotent : rejouée plusieurs fois le même jour, la récompense n'est
 * accordée qu'une seule fois (contrôle sur lastBirthdayRewardedYear).
 */
exports.checkBirthday = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    if (!user.isBirthdateSet || !user.birthdate) {
      return res.status(200).json({ success: true, isBirthday: false, rewarded: false });
    }

    const now = new Date();
    const isBirthday = isSameDayAndMonth(user.birthdate, now);

    if (!isBirthday) {
      return res.status(200).json({ success: true, isBirthday: false, rewarded: false });
    }

    const currentYear = now.getUTCFullYear();
    if (user.lastBirthdayRewardedYear === currentYear) {
      return res.status(200).json({
        success:   true,
        isBirthday: true,
        rewarded:  false,
        pseudo:    user.pseudo || user.name || null,
      });
    }

    // Cadeau de bienvenue : +1 CHEST_KEY
    const existingKey = user.inventory.find((i) => i.itemType === 'CHEST_KEY');
    if (existingKey) {
      existingKey.quantity += 1;
    } else {
      user.inventory.push({ itemType: 'CHEST_KEY', rarity: 'common', quantity: 1 });
    }
    user.markModified('inventory');

    user.lastBirthdayRewardedYear = currentYear;
    await user.save();

    // Déblocage des trophées (déclenche BIRTHDAY_CELEBRATED)
    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);

    return res.status(200).json({
      success:       true,
      isBirthday:    true,
      rewarded:      true,
      chestKeyAdded: true,
      newlyUnlocked,
      pseudo:        user.pseudo || user.name || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getUserAchievements  GET /api/rewards/achievements
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la liste complète des trophées (débloqués + à accomplir).
 * Les trophées cachés non débloqués ne révèlent pas leur nom ni description.
 */
exports.getUserAchievements = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const user = await User.findById(myId).select('achievements');
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    // Index rapide : achievementId → unlockedAt
    const unlockedMap = new Map(
      user.achievements.map((a) => [a.achievementId, a.unlockedAt]),
    );

    const achievements = Object.values(ACHIEVEMENT_CATALOG).map((entry) => {
      const unlocked   = unlockedMap.has(entry.id);
      const unlockedAt = unlockedMap.get(entry.id) ?? null;

      // Masquage des trophées cachés non débloqués
      if (entry.hidden && !unlocked) {
        return {
          id:          entry.id,
          name:        '???',
          description: 'Ce trophée est encore secret.',
          category:    entry.category,
          hidden:      true,
          unlocked:    false,
          unlockedAt:  null,
        };
      }

      return { ...entry, unlocked, unlockedAt };
    });

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    return res.status(200).json({
      success: true,
      stats: {
        total:      CATALOG_SIZE,
        unlocked:   unlockedCount,
        percentage: Math.round((unlockedCount / CATALOG_SIZE) * 100),
      },
      achievements,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// checkAchievements  POST /api/rewards/check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déclenche manuellement la vérification et le déblocage des trophées.
 * Exposé comme endpoint pour les clients et les tests.
 * Idempotent : un trophée déjà débloqué n'est jamais accordé deux fois.
 */
exports.checkAchievements = async (req, res, next) => {
  try {
    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);

    return res.status(200).json({
      success:        true,
      newlyUnlocked,
      count:          newlyUnlocked.length,
      message:        newlyUnlocked.length > 0
        ? `${newlyUnlocked.length} nouveau(x) trophée(s) débloqué(s) !`
        : 'Aucun nouveau trophée pour le moment.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// syncLocalAchievements  PUT /api/rewards/achievements/sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synchronise les trophées du catalogue LOCAL (V1, évalués côté client depuis
 * les logs de séances AsyncStorage) vers le compte backend, pour qu'ils
 * apparaissent dans le profil public consulté par les amis.
 *
 * Body : { ids: string[] } — filtré contre l'allowlist LOCAL_TROPHY_IDS :
 *  - Un id hors catalogue local (y compris un id du catalogue BACKEND, ex.
 *    "FRIENDSHIP_LEVEL_5") est silencieusement ignoré — jamais auto-octroyé.
 *  - Additif uniquement : ne retire jamais un trophée déjà synchronisé
 *    (le client peut renvoyer un sous-ensemble sans effacer l'historique).
 */
exports.syncLocalAchievements = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return next(createError('ids doit être un tableau.', 400));
    }

    const user = await User.findById(req.user.id).select('achievements');
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const alreadyUnlocked = new Set(user.achievements.map((a) => a.achievementId));
    const validIds  = ids.filter((id) => typeof id === 'string' && LOCAL_TROPHY_IDS.has(id));
    const toAdd     = validIds.filter((id) => !alreadyUnlocked.has(id));
    const ignored   = ids.filter((id) => !LOCAL_TROPHY_IDS.has(id));

    if (toAdd.length > 0) {
      await User.updateOne(
        { _id: req.user.id },
        { $push: { achievements: { $each: toAdd.map((achievementId) => ({ achievementId })) } } },
      );
    }

    return res.status(200).json({
      success: true,
      synced:  toAdd,
      added:   toAdd.length,
      ignored: ignored.length,
    });
  } catch (err) {
    next(err);
  }
};

// Exporté pour être importé depuis d'autres contrôleurs (openChest, acceptFriend…)
exports.checkAndUnlockAchievements = checkAndUnlockAchievements;
exports.ACHIEVEMENT_CATALOG        = ACHIEVEMENT_CATALOG;
exports.CATALOG_SIZE               = CATALOG_SIZE;
exports.isSameDayAndMonth          = isSameDayAndMonth;
