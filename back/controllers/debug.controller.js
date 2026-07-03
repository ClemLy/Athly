'use strict';

const crypto      = require('crypto');
const bcrypt       = require('bcrypt');
const User         = require('../models/User');
const Friendship   = require('../models/Friendship');
const { xpForLevel, getRankForLevel } = require('../utils/levelHelpers');
const { addItemAtomic, addUniqueItemOnce } = require('../services/inventory.service');
const { checkAndUnlockAchievements } = require('./reward.controller');

const MOCK_PASSWORD_ROUNDS = 10; // comptes jetables, jamais utilisés pour se connecter

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─────────────────────────────────────────────────────────────────────────────
// syncLevel  POST /api/debug/sync-level
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test réservé au dev/QA (jamais monté en production — voir
 * devOnly.middleware.js). Aligne xp/level/rank backend sur un niveau cible.
 *
 * Contexte : le panneau "God Mode" du front simule XP/niveau/streak
 * uniquement en local (AsyncStorage) pour l'affichage — il ne touche jamais
 * le `user.level` backend, qui est la SEULE source de vérité pour les
 * fonctionnalités gated côté serveur (coffres, niveau 11+). Sans cette
 * route, tester ces fonctionnalités nécessiterait des dizaines de vraies
 * séances. N'affecte jamais inventory/achievements — uniquement xp/level/rank.
 */
exports.syncLevel = async (req, res, next) => {
  try {
    const target = parseInt(req.body.level, 10);
    if (!Number.isFinite(target) || target < 0 || target > 200) {
      return next(createError('level doit être un entier entre 0 et 200.', 400));
    }

    const xp   = xpForLevel(target);
    const rank = getRankForLevel(target);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { level: target, xp, rank } },
      { new: true },
    ).select('level xp rank');

    if (!user) return next(createError('Utilisateur introuvable.', 404));

    return res.status(200).json({
      success: true,
      level:   user.level,
      xp:      user.xp,
      rank:    user.rank,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// giveChests  POST /api/debug/godmode/give-chests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : crédite atomiquement `amount` CHEST_KEY à l'utilisateur
 * connecté, pour tester l'ouverture de coffre sans cumuler 5h de séance par
 * palier. Réutilise addItemAtomic (même garde anti-race que openChest/useItem).
 *
 * Body : { amount?: number } — défaut 1, borné à 50 pour rester un outil de
 * test (pas un moyen de remplir l'inventaire à l'infini en un clic).
 */
exports.giveChests = async (req, res, next) => {
  try {
    const amount = req.body.amount === undefined ? 1 : parseInt(req.body.amount, 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 50) {
      return next(createError('amount doit être un entier entre 1 et 50.', 400));
    }

    const user = await addItemAtomic(req.user.id, 'CHEST_KEY', 'common', amount);
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const chestEntry = user.inventory.find((i) => i.itemType === 'CHEST_KEY');

    return res.status(200).json({
      success:   true,
      message:   `+${amount} coffre(s) ajouté(s).`,
      chestCount: chestEntry ? chestEntry.quantity : 0,
      inventory: user.inventory,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// mockSocial  POST /api/debug/godmode/mock-social
// ─────────────────────────────────────────────────────────────────────────────

// 3 profils types couvrant les usages de l'écran Social :
//  - 2 amis "accepted" complets → Classement/Podium, Groupe de Streak,
//    profil public riche (cadre, trophées, vitrine, records, séances).
//  - 1 ami "pending" (le faux profil est le requester, l'appelant le
//    recipient) → apparaît dans les demandes reçues, pour tester
//    Accepter/Refuser.
// Les données (cadres, inventaires, trophées, records) sont FIXES et non
// aléatoires : chaque relance de l'outil reproduit exactement le même état,
// ce qui rend les scénarios de test répétables.
const MOCK_FRIEND_SPECS = [
  {
    suffix: 1, status: 'accepted', level: 24,
    friendshipXp: 120, friendshipLevel: 2,
    frame: { shapeId: 'hexagon', colorId: 'bronze' },
    inventory: [
      { itemType: 'ENERGY_DRINK',  rarity: 'common',    quantity: 3 },
      { itemType: 'STREAK_FREEZE', rarity: 'rare',      quantity: 2 },
      { itemType: 'CHEST_KEY',     rarity: 'common',    quantity: 1 },
    ],
    achievements: ['ignition', 'promise', 'iron_will', 'marathonien', 'first_friend', 'FIRST_COMMON_ITEM'],
    showcase:     ['promise', 'iron_will', 'marathonien'],
    workoutDays:  [0, 1, 2, 4, 6, 9],  // jours dans le passé (0 = aujourd'hui) → streak de 3
    records: [
      { exercice: 'Développé couché',  series: [{ poids: 80,  repetitions: 8 }, { poids: 85, repetitions: 5 }] },
      { exercice: 'Squat',             series: [{ poids: 110, repetitions: 6 }] },
      { exercice: 'Soulevé de terre',  series: [{ poids: 130, repetitions: 4 }] },
    ],
  },
  {
    suffix: 2, status: 'accepted', level: 38,
    friendshipXp: 240, friendshipLevel: 3,
    frame: { shapeId: 'octagon', colorId: 'silver' },
    inventory: [
      { itemType: 'TRIPLE_XP',    rarity: 'epic',      quantity: 1 },
      { itemType: 'LEVEL_COUPON', rarity: 'legendary', quantity: 1 },
    ],
    achievements: ['ignition', 'promise', 'apprenti', 'titan', 'machine', 'night_owl', 'streak_hunter', 'FIRST_RARE_ITEM', 'FIRST_EPIC_ITEM'],
    showcase:     ['titan', 'night_owl', 'apprenti'],
    workoutDays:  [0, 1, 2, 3, 4, 5, 7, 10, 14],  // streak de 6
    records: [
      { exercice: 'Développé couché',  series: [{ poids: 100, repetitions: 6 }, { poids: 105, repetitions: 3 }] },
      { exercice: 'Squat',             series: [{ poids: 140, repetitions: 5 }] },
      { exercice: 'Développé militaire', series: [{ poids: 55, repetitions: 8 }] },
    ],
  },
  {
    suffix: 3, status: 'pending', level: 12,
    friendshipXp: 0, friendshipLevel: 1,
    frame: { shapeId: 'circle', colorId: 'none' },
    inventory: [],
    achievements: ['ignition'],
    showcase:     [],
    workoutDays:  [1, 3],
    records: [
      { exercice: 'Développé couché', series: [{ poids: 60, repetitions: 10 }] },
    ],
  },
  {
    // Amitié niveau max (Lien de Sang) : pour tester la vitrine "vieille garde"
    // et le trophée/cadre uniques FRIENDSHIP_LEVEL_5 / PROFILE_FRAME_BLOOD_BOND.
    suffix: 4, status: 'accepted', level: 61,
    friendshipXp: 1500, friendshipLevel: 5,
    frame: { shapeId: 'hexagon', colorId: 'gold' },
    inventory: [
      { itemType: 'PROFILE_FRAME_BLOOD_BOND', rarity: 'unique', quantity: 1 },
      { itemType: 'CHEST_KEY',                rarity: 'common', quantity: 2 },
    ],
    achievements: ['ignition', 'promise', 'apprenti', 'centurion', 'iron_discipline', 'first_friend', 'mentor', 'FIRST_UNIQUE_ITEM', 'FRIENDSHIP_LEVEL_5'],
    showcase:     ['centurion', 'mentor', 'iron_discipline'],
    workoutDays:  [0, 1, 2, 3, 5, 6, 8, 11, 15, 20, 27],  // streak de 4, ancienneté marquée
    records: [
      { exercice: 'Développé couché',  series: [{ poids: 90, repetitions: 7 }] },
      { exercice: 'Squat',             series: [{ poids: 125, repetitions: 6 }] },
      { exercice: 'Traction lestée',   series: [{ poids: 20, repetitions: 8 }] },
    ],
  },
];

/**
 * Outil de test : génère (ou régénère) un réseau social factice COMPLET pour
 * l'utilisateur connecté — 3 faux comptes avec cadres équipés, inventaires,
 * trophées + vitrines, historiques de séances et records d'exercices. De quoi
 * tester le profil public riche, le classement XP et le classement par
 * exercice sans aucun vrai compte tiers.
 *
 * Idempotent : les faux amis précédents de CET utilisateur (namespacés par
 * son ObjectId dans l'email) et TOUTES leurs données liées (amitiés, séances,
 * records) sont supprimés avant recréation.
 */
exports.mockSocial = async (req, res, next) => {
  try {
    const Workout        = require('../models/Workout');
    const ExerciseRecord = require('../models/ExerciseRecord');

    const myId = req.user.id;
    const emailPrefix = `mock-${myId}-`;

    // ── Nettoyage complet des faux amis précédents de CET utilisateur ────────
    const previousMocks = await User.find({
      email: { $regex: `^${emailPrefix}` },
    }).select('_id');
    const previousIds = previousMocks.map((u) => u._id);
    if (previousIds.length > 0) {
      await Promise.all([
        Friendship.deleteMany({
          $or: [{ requester: { $in: previousIds } }, { recipient: { $in: previousIds } }],
        }),
        Workout.deleteMany({ user: { $in: previousIds } }),
        ExerciseRecord.deleteMany({ user: { $in: previousIds } }),
      ]);
      await User.deleteMany({ _id: { $in: previousIds } });
    }

    // Mot de passe jetable — ces comptes ne sont jamais destinés à se connecter.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), MOCK_PASSWORD_ROUNDS);

    const created = [];
    for (const spec of MOCK_FRIEND_SPECS) {
      const mockUser = await User.create({
        pseudo:     `FauxAmi_${spec.suffix}`,
        email:      `${emailPrefix}${spec.suffix}@athly.dev`,
        password:   passwordHash,
        isVerified: true,
        level:      spec.level,
        xp:         xpForLevel(spec.level),
        rank:       getRankForLevel(spec.level),
        equippedFrame:         spec.frame,
        inventory:             spec.inventory,
        achievements:          spec.achievements.map((achievementId) => ({ achievementId })),
        showcasedAchievements: spec.showcase,
        totalWorkoutMinutes:   spec.workoutDays.length * 55,
      });

      // Historique de séances finalisées, réparties sur les derniers jours
      const workouts = await Workout.insertMany(
        spec.workoutDays.map((daysAgo, i) => {
          const date = new Date();
          date.setDate(date.getDate() - daysAgo);
          date.setHours(18, 30, 0, 0);
          return {
            user:   mockUser._id,
            name:   `Séance ${i + 1}`,
            status: 'finished',
            date,
            durationSeconds: 3300,
          };
        }),
      );

      // Records d'exercices rattachés à la première séance (workout requis
      // par le schéma) — alimentent le classement par exercice
      if (spec.records.length > 0 && workouts.length > 0) {
        await ExerciseRecord.insertMany(
          spec.records.map((r) => ({
            user:        mockUser._id,
            workout:     workouts[0]._id,
            exerciceNom: r.exercice,
            series:      r.series,
          })),
        );
      }

      await Friendship.create(
        spec.status === 'pending'
          ? { requester: mockUser._id, recipient: myId, status: 'pending' }
          : { requester: myId, recipient: mockUser._id, status: 'accepted', friendshipXp: spec.friendshipXp, friendshipLevel: spec.friendshipLevel },
      );

      // Amitié niveau 5 créée directement (hors addFriendshipXp) : on réplique
      // manuellement son effet de bord pour l'appelant — cadre unique + trophée.
      if (spec.status === 'accepted' && spec.friendshipLevel === 5) {
        await addUniqueItemOnce(myId, 'PROFILE_FRAME_BLOOD_BOND', 'unique');
        await checkAndUnlockAchievements(String(myId));
      }

      created.push({
        pseudo:   mockUser.pseudo,
        level:    spec.level,
        rank:     mockUser.rank,
        status:   spec.status,
        workouts: spec.workoutDays.length,
        records:  spec.records.length,
        trophies: spec.achievements.length,
      });
    }

    return res.status(201).json({
      success: true,
      message: `${created.length} faux profils complets générés (cadres, trophées, vitrines, séances, records).`,
      created,
    });
  } catch (err) {
    next(err);
  }
};
