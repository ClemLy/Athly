'use strict';

const crypto      = require('crypto');
const bcrypt       = require('bcrypt');
const User         = require('../models/User');
const Friendship   = require('../models/Friendship');
const StreakGroup  = require('../models/StreakGroup');
const Workout      = require('../models/Workout');
const { xpForLevel, getRankForLevel } = require('../utils/levelHelpers');
const { addItemAtomic, addUniqueItemOnce } = require('../services/inventory.service');
const { checkAndUnlockAchievements } = require('./reward.controller');
const { recordActivityEvent } = require('../services/activity.service');
const { sendPushToUser } = require('../services/push.service');
const { SHAKE_TROLL_MESSAGES } = require('../data/shakeMessages');
const { uniqueDiscriminator } = require('../services/auth.service');

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
 * connecté, pour tester l'ouverture de coffre sans cumuler 2h de séance par
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
// giveAllItems  POST /api/debug/godmode/give-all-items
// ─────────────────────────────────────────────────────────────────────────────

// Rareté d'affichage de chaque itemType — miroir de front/src/services/
// inventory.service.js (ITEM_CATALOG). Dupliqué volontairement ici : ce
// contrôleur n'a pas de dépendance vers le code front, et cette table est un
// simple outil de QA (pas une règle de jeu, qui reste dans chest.service.js).
const ITEM_RARITY_MAP = {
  ENERGY_DRINK:            'common',
  CHEST_KEY:               'common',
  STREAK_FREEZE:           'rare',
  DOUBLE_XP:               'rare',
  SUPER_STREAK_FREEZE:     'epic',
  TRIPLE_XP:               'epic',
  LEVEL_COUPON:            'legendary',
  QUINTUPLE_XP:            'legendary',
  PROFILE_FRAME_BLOOD_BOND:'unique',
  FRAME_COLOR_BLOOD_SANG:  'unique',
  THEME_UNLOCK_BLOOD_SANG: 'unique',
};

/**
 * Outil de test : injecte 1 exemplaire de CHAQUE itemType existant dans
 * l'inventaire de l'utilisateur connecté — permet de tester en un clic tous
 * les consommables ET tous les cosmétiques Uniques réclamables (cadre,
 * couleur, thème), sans enchaîner des dizaines d'actions de jeu.
 *
 * La liste des itemTypes vient directement de l'enum Mongoose (User.js) :
 * toujours synchronisée avec le schéma, aucun risque de dérive si un nouvel
 * item est ajouté un jour sans mettre à jour ce contrôleur.
 */
exports.giveAllItems = async (req, res, next) => {
  try {
    const itemTypes = User.schema.path('inventory').schema.path('itemType').enumValues;

    for (const itemType of itemTypes) {
      const rarity = ITEM_RARITY_MAP[itemType] || 'common';
      await addItemAtomic(req.user.id, itemType, rarity, 1);
    }

    const user = await User.findById(req.user.id).select('inventory');
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    return res.status(200).json({
      success:   true,
      message:   `${itemTypes.length} objet(s) ajouté(s) (1 exemplaire de chaque).`,
      inventory: user.inventory,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateChestsOpened  POST /api/debug/godmode/simulate-chests-opened
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : incrémente directement `totalChestsOpened` sans passer par
 * de vraies ouvertures de coffre — les trophées gradués (CHEST_1…CHEST_200)
 * et le déblocage du thème "Rouge Sang" à 100 coffres nécessiteraient sinon
 * des dizaines/centaines d'actions manuelles pour être testés.
 *
 * Réplique le même octroi que openChest au palier 100 (voir
 * inventory.controller.js) pour rester cohérent avec le vrai parcours.
 *
 * Body : { amount?: number } — défaut 1, borné à 250 (couvre CHEST_200).
 */
exports.simulateChestsOpened = async (req, res, next) => {
  try {
    const amount = req.body.amount === undefined ? 1 : parseInt(req.body.amount, 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 250) {
      return next(createError('amount doit être un entier entre 1 et 250.', 400));
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $inc: { totalChestsOpened: amount } },
      { returnDocument: 'after' },
    ).select('totalChestsOpened');
    if (!updated) return next(createError('Utilisateur introuvable.', 404));

    let themeUnlockGranted = false;
    if (updated.totalChestsOpened >= 100) {
      const granted = await addUniqueItemOnce(req.user.id, 'THEME_UNLOCK_BLOOD_SANG', 'unique');
      themeUnlockGranted = Boolean(granted);
    }

    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);

    return res.status(200).json({
      success: true,
      message: `+${amount} coffre(s) ouvert(s) simulé(s) (total : ${updated.totalChestsOpened}).`,
      totalChestsOpened: updated.totalChestsOpened,
      themeUnlockGranted,
      newlyUnlocked,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateReferral  POST /api/debug/godmode/simulate-referral
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : crée un compte factice "filleul" avec referredBy pointant
 * vers l'utilisateur connecté, pour débloquer FIRST_REFERRAL sans avoir à
 * faire créer un vrai second compte et réclamer un code de parrainage.
 */
exports.simulateReferral = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), MOCK_PASSWORD_ROUNDS);

    await User.create({
      pseudo:     `Filleul_${Date.now().toString(36)}`,
      email:      `mock-referral-${myId}-${Date.now()}@athly.dev`,
      password:   passwordHash,
      isVerified: true,
      referredBy: myId,
    });

    const newlyUnlocked = await checkAndUnlockAchievements(myId);

    return res.status(201).json({
      success: true,
      message: 'Parrainage simulé : un filleul factice a été créé.',
      newlyUnlocked,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateBirthday  POST /api/debug/godmode/simulate-birthday
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : force la date de naissance à aujourd'hui (année neutre) et
 * marque le cadeau d'anniversaire comme déjà réclamé cette année — débloque
 * BIRTHDAY_SET et BIRTHDAY_CELEBRATED sans attendre le vrai jour J.
 *
 * Contourne volontairement la garde anti-triche "une seule saisie" de
 * setBirthdate (voir reward.controller.js) : c'est un outil de dev, pas le
 * parcours utilisateur normal.
 */
exports.simulateBirthday = async (req, res, next) => {
  try {
    const now = new Date();
    const birthdate = new Date(Date.UTC(2000, now.getUTCMonth(), now.getUTCDate()));

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          isBirthdateSet: true,
          birthdate,
          lastBirthdayRewardedYear: now.getUTCFullYear(),
        },
      },
      { new: true },
    );
    if (!user) return next(createError('Utilisateur introuvable.', 404));

    const newlyUnlocked = await checkAndUnlockAchievements(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Anniversaire simulé (aujourd\'hui).',
      newlyUnlocked,
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

// ─────────────────────────────────────────────────────────────────────────────
// simulateGroup  POST /api/debug/godmode/simulate-group
// ─────────────────────────────────────────────────────────────────────────────

// 3 coéquipiers factices couvrant les 3 statuts non-« sommeil » de la Météo
// des séances — le 4e statut (💤 En sommeil) s'obtient naturellement en ne
// touchant à rien pour un membre. Namespacés par l'ObjectId de l'appelant
// (comme MOCK_FRIEND_SPECS) pour rester idempotent et ne jamais fuiter d'un
// testeur à l'autre.
const MOCK_GROUPMATE_WEATHER = [
  { suffix: 1, pseudo: 'Coequipier_Pret',  weather: 'ready' },
  { suffix: 2, pseudo: 'Coequipier_Actif', weather: 'active' },
  { suffix: 3, pseudo: 'Coequipier_Valide', weather: 'done' },
];

const SIMULATED_GROUP_STREAK = 5;

/**
 * Outil de test : crée (ou régénère) un groupe de streak complet avec 3
 * coéquipiers factices, un par statut de Météo des séances testable sans
 * seconde app/appareil (ready/active/done — le 4e, sleeping, s'obtient en ne
 * touchant à aucun des trois). Seul moyen de tester weatherStatus, le
 * multiplicateur de groupe et le bouton "Secouer" en solo.
 *
 * Idempotent : le groupe et les coéquipiers précédents de CET utilisateur
 * (namespacés par son ObjectId) sont supprimés avant recréation.
 */
exports.simulateGroup = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const emailPrefix = `mock-group-${myId}-`;

    // ── Nettoyage du groupe et des coéquipiers précédents de CET utilisateur ──
    const previousMocks = await User.find({ email: { $regex: `^${emailPrefix}` } }).select('_id');
    const previousIds = previousMocks.map((u) => u._id);
    if (previousIds.length > 0) {
      await Workout.deleteMany({ user: { $in: previousIds } });
      await Friendship.deleteMany({
        $or: [{ requester: { $in: previousIds } }, { recipient: { $in: previousIds } }],
      });
      await User.deleteMany({ _id: { $in: previousIds } });
    }
    await StreakGroup.deleteMany({ members: myId });

    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), MOCK_PASSWORD_ROUNDS);
    const now = new Date();
    const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

    const memberIds = [myId];
    for (const spec of MOCK_GROUPMATE_WEATHER) {
      const mockUser = await User.create({
        pseudo:     spec.pseudo,
        email:      `${emailPrefix}${spec.suffix}@athly.dev`,
        password:   passwordHash,
        isVerified: true,
        level:      15,
        xp:         xpForLevel(15),
        rank:       getRankForLevel(15),
        lastActiveAt: spec.weather === 'ready' || spec.weather === 'active' || spec.weather === 'done' ? now : null,
      });

      if (spec.weather === 'active') {
        await Workout.create({ user: mockUser._id, status: 'in_progress', date: todayAt(12, 0) });
      } else if (spec.weather === 'done') {
        await Workout.create({ user: mockUser._id, status: 'finished', date: todayAt(8, 0) });
      }

      await Friendship.create({ requester: myId, recipient: mockUser._id, status: 'accepted' });
      memberIds.push(mockUser._id);
    }

    const group = await StreakGroup.create({
      name: 'Groupe de Test (God Mode)',
      members: memberIds,
      currentStreak: SIMULATED_GROUP_STREAK,
      lastValidatedDate: now,
    });

    return res.status(201).json({
      success: true,
      message: `Groupe de test créé (3 coéquipiers : Prêt/Actif/Validé, streak ${SIMULATED_GROUP_STREAK}j).`,
      groupId: group._id,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateActivityEvent  POST /api/debug/godmode/simulate-activity-event
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : publie un ActivityEvent factice au nom d'un coéquipier du
 * groupe de l'utilisateur connecté (jamais en son propre nom — le flux
 * n'affiche jamais ses propres événements), pour tester ActivityFeedModal et
 * les réactions sans attendre qu'un vrai coéquipier batte un record ou ouvre
 * un coffre Légendaire.
 *
 * Body : { type?: 'pr_broken' | 'chest_legendary' } — défaut aléatoire.
 */
exports.simulateActivityEvent = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const requestedType = (req.body || {}).type;
    const type = requestedType === 'chest_legendary' ? 'chest_legendary'
      : requestedType === 'pr_broken' ? 'pr_broken'
      : (Math.random() < 0.5 ? 'pr_broken' : 'chest_legendary');

    const group = await StreakGroup.findOne({ members: myId });
    if (!group) {
      return next(createError('Aucun groupe — utilise "Simuler un groupe" avant de tester le flux d\'activité.', 400));
    }

    const otherMemberId = group.members.find((m) => m.toString() !== myId);
    if (!otherMemberId) {
      return next(createError('Ton groupe ne contient aucun autre membre.', 400));
    }

    const actor = await User.findById(otherMemberId).select('pseudo');
    const pseudo = actor?.pseudo ?? 'Un coéquipier';

    const message = type === 'chest_legendary'
      ? `${pseudo} a ouvert un coffre Légendaire !`
      : `${pseudo} a brisé son record au Développé couché !`;
    const payload = type === 'chest_legendary'
      ? { itemType: 'LEVEL_COUPON' }
      : { exercise: 'Développé couché', weight: 100 };

    const event = await recordActivityEvent(otherMemberId, type, message, payload);

    return res.status(201).json({
      success: true,
      message: `Événement simulé : ${message}`,
      eventId: event?._id ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateStreakBreak  POST /api/debug/godmode/simulate-streak-break
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : recule artificiellement `lastValidatedDate` du groupe de
 * l'utilisateur connecté de 2 jours (en gardant currentStreak > 0), pour que
 * le prochain `getMyGroup` déclenche la détection paresseuse de rupture de
 * streak (voir detectAndApplyStreakBreak dans groupStreak.controller.js) et
 * affiche le bandeau Hall of Shame — sans attendre un vrai jour manqué.
 *
 * Les coéquipiers factices (créés par "Simuler un groupe") n'ont par
 * construction aucune séance ni Gel de Streak sur le jour manqué : ils
 * deviennent naturellement les "briseurs" désignés.
 */
exports.simulateStreakBreak = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const group = await StreakGroup.findOne({ members: myId });
    if (!group) {
      return next(createError('Aucun groupe — utilise "Simuler un groupe" avant de tester le Hall of Shame.', 400));
    }

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    group.currentStreak = group.currentStreak > 0 ? group.currentStreak : SIMULATED_GROUP_STREAK;
    group.lastValidatedDate = twoDaysAgo;
    group.shameBreakers = [];
    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Rupture de streak simulée — recharge l\'onglet Groupe pour voir le Hall of Shame.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateShakeSelf  POST /api/debug/godmode/simulate-shake-self
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : envoie une VRAIE notification push au token Expo enregistré
 * de l'utilisateur connecté (pas à un autre membre), avec le même texte
 * troll que le vrai bouton "Secouer" — seul moyen de vérifier de bout en
 * bout que l'infra push (Expo → appareil) fonctionne réellement en solo,
 * sans second compte/appareil pour recevoir la notification.
 */
exports.simulateShakeSelf = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('pushToken');
    if (!user?.pushToken) {
      return next(createError("Aucun token push enregistré sur ce compte — ouvre l'app avec les notifications autorisées d'abord.", 400));
    }

    const trollMessage = SHAKE_TROLL_MESSAGES[Math.floor(Math.random() * SHAKE_TROLL_MESSAGES.length)];
    const pushed = await sendPushToUser(req.user.id, {
      title: 'Athly (Test) t\'a secoué ! 🚨',
      body:  trollMessage,
      data:  { type: 'shake', test: true },
    });

    return res.status(200).json({
      success: true,
      pushed,
      message: pushed ? 'Notification envoyée à ton appareil.' : "Échec d'envoi — le token est peut-être périmé.",
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// simulateSearchableFriend  POST /api/debug/godmode/simulate-searchable-friend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outil de test : crée un compte factice PAS déjà ami (contrairement à
 * mockSocial, qui pré-accepte les faux profils) — seul moyen de tester en
 * solo le parcours complet "Ajouter un ami" : recherche par tag exact,
 * carte Preview, puis envoi réel de la demande.
 *
 * Idempotent : rejouer l'outil retourne le même compte de test (même tag)
 * plutôt que d'en empiler des dizaines — sauf s'il a depuis été ami ou
 * mis en pending, auquel cas un nouveau compte "cherchable" est recréé.
 */
exports.simulateSearchableFriend = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const emailPrefix = `mock-searchable-${myId}-`;

    const existing = await User.findOne({ email: { $regex: `^${emailPrefix}` } }).select('_id pseudo discriminator');
    if (existing) {
      const relation = await Friendship.findOne({
        $or: [
          { requester: myId, recipient: existing._id },
          { requester: existing._id, recipient: myId },
        ],
      });
      if (!relation) {
        return res.status(200).json({
          success: true,
          message: 'Compte de test déjà disponible.',
          pseudo: existing.pseudo,
          discriminator: existing.discriminator,
          tag: `${existing.pseudo}#${existing.discriminator}`,
        });
      }
      // Déjà ami/pending avec ce compte : on le retire pour en recréer un frais
      // (sinon la recherche renverrait toujours relationStatus != 'none').
      await Friendship.deleteOne({ _id: relation._id });
      await User.deleteOne({ _id: existing._id });
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), MOCK_PASSWORD_ROUNDS);
    const pseudo = 'TestAmi';

    const created = await User.create({
      pseudo,
      email: `${emailPrefix}${Date.now()}@athly.dev`,
      password: passwordHash,
      isVerified: true,
      discriminator: await uniqueDiscriminator(pseudo),
      level: 18,
      xp: xpForLevel(18),
      rank: getRankForLevel(18),
    });

    return res.status(201).json({
      success: true,
      message: 'Compte de test créé.',
      pseudo: created.pseudo,
      discriminator: created.discriminator,
      tag: `${created.pseudo}#${created.discriminator}`,
    });
  } catch (err) {
    next(err);
  }
};
