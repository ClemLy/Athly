'use strict';

const User       = require('../models/User');
const Friendship = require('../models/Friendship');

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

  // ── Trophée anniversaire ───────────────────────────────────────────────────
  if (user.isBirthdateSet) tryUnlock('BIRTHDAY_SET');

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

// Exporté pour être importé depuis d'autres contrôleurs (openChest, acceptFriend…)
exports.checkAndUnlockAchievements = checkAndUnlockAchievements;
exports.ACHIEVEMENT_CATALOG        = ACHIEVEMENT_CATALOG;
exports.CATALOG_SIZE               = CATALOG_SIZE;
