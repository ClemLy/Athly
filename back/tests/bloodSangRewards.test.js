'use strict';

const request     = require('supertest');
const mongoose    = require('mongoose');
const app         = require('../app');
const User        = require('../models/User');
const StreakGroup = require('../models/StreakGroup');
const Workout     = require('../models/Workout');
const { xpForLevel, getRankForLevel } = require('../utils/levelHelpers');

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

async function createAndLoginUser(pseudo, email) {
  await request(app)
    .post('/api/auth/register')
    .send({ pseudo, email, password: 'Password123!' });

  await User.updateOne({ email }, { isVerified: true });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' });

  const user = await User.findOne({ email }).select('_id');
  return { token: loginRes.body.token, userId: user._id.toString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite principale
// ─────────────────────────────────────────────────────────────────────────────

describe('Prestige visuel Rouge Sang Unique — cadre, couleur, thème, coffres, God Mode', () => {
  let alice;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    alice = await createAndLoginUser('AliceFit', 'alice@athly.fr');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. POST /api/inventory/claim — claimUniqueItem
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/inventory/claim — claimUniqueItem', () => {

    it('✅ Réclame le cadre "Lien de Sang" : consomme l\'item, débloque et équipe la forme Croc de Dragon', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $push: { inventory: { itemType: 'PROFILE_FRAME_BLOOD_BOND', rarity: 'unique', quantity: 1 } } },
      );

      const res = await request(app)
        .post('/api/inventory/claim')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ itemType: 'PROFILE_FRAME_BLOOD_BOND' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.unlockedCosmetic).toBe('FRAME_SHAPE_DRAGONFANG');
      expect(res.body.equippedFrame.shapeId).toBe('dragonfang');

      const user = await User.findById(alice.userId);
      expect(user.unlockedCosmetics).toContain('FRAME_SHAPE_DRAGONFANG');
      expect(user.equippedFrame.shapeId).toBe('dragonfang');
      expect(user.inventory.find((i) => i.itemType === 'PROFILE_FRAME_BLOOD_BOND')).toBeUndefined();
    });

    it('✅ Réclame la couleur "Rouge Sang Unique" : débloque et équipe la couleur bloodsang', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $push: { inventory: { itemType: 'FRAME_COLOR_BLOOD_SANG', rarity: 'unique', quantity: 1 } } },
      );

      const res = await request(app)
        .post('/api/inventory/claim')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ itemType: 'FRAME_COLOR_BLOOD_SANG' });

      expect(res.statusCode).toBe(200);
      expect(res.body.unlockedCosmetic).toBe('FRAME_COLOR_BLOODSANG');
      expect(res.body.equippedFrame.colorId).toBe('bloodsang');

      const user = await User.findById(alice.userId);
      expect(user.unlockedCosmetics).toContain('FRAME_COLOR_BLOODSANG');
      expect(user.equippedFrame.colorId).toBe('bloodsang');
    });

    it('✅ Réclame le thème "Rouge Sang Unique" : débloque le flag sans toucher au cadre équipé', async () => {
      await User.updateOne(
        { _id: alice.userId },
        {
          $push: { inventory: { itemType: 'THEME_UNLOCK_BLOOD_SANG', rarity: 'unique', quantity: 1 } },
          $set:  { equippedFrame: { shapeId: 'hex', colorId: 'silver' } },
        },
      );

      const res = await request(app)
        .post('/api/inventory/claim')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ itemType: 'THEME_UNLOCK_BLOOD_SANG' });

      expect(res.statusCode).toBe(200);
      expect(res.body.unlockedCosmetic).toBe('THEME_BLOODSANG');

      const user = await User.findById(alice.userId);
      expect(user.unlockedCosmetics).toContain('THEME_BLOODSANG');
      // Le cadre équipé n'est pas affecté par le déblocage d'un thème.
      expect(user.equippedFrame.shapeId).toBe('hex');
      expect(user.equippedFrame.colorId).toBe('silver');
    });

    it('❌ 400 si l\'utilisateur ne possède pas l\'item à réclamer', async () => {
      const res = await request(app)
        .post('/api/inventory/claim')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ itemType: 'PROFILE_FRAME_BLOOD_BOND' });

      expect(res.statusCode).toBe(400);
      const user = await User.findById(alice.userId);
      expect(user.unlockedCosmetics).toEqual([]);
    });

    it('❌ 400 si itemType n\'est pas un cosmétique réclamable (ex: consommable classique)', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { $push: { inventory: { itemType: 'ENERGY_DRINK', rarity: 'common', quantity: 1 } } },
      );

      const res = await request(app)
        .post('/api/inventory/claim')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ itemType: 'ENERGY_DRINK' });

      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/inventory/claim').send({ itemType: 'PROFILE_FRAME_BLOOD_BOND' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. openChest — totalChestsOpened, trophées gradués, déblocage thème 100
  // ───────────────────────────────────────────────────────────────────────────
  describe('openChest — compteur de coffres, trophées gradués et thème 100 coffres', () => {

    async function giveChestKeyAndSetLevel(extraFields = {}) {
      await User.updateOne(
        { _id: alice.userId },
        {
          $set: { level: 11, xp: xpForLevel(11), rank: getRankForLevel(11), ...extraFields },
          $push: { inventory: { itemType: 'CHEST_KEY', rarity: 'common', quantity: 1 } },
        },
      );
    }

    it('✅ Premier coffre ouvert débloque le trophée CHEST_1', async () => {
      await giveChestKeyAndSetLevel();

      const res = await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.totalChestsOpened).toBe(1);
      expect(res.body.newlyUnlocked).toContain('CHEST_1');
      expect(res.body.newlyUnlocked).not.toContain('CHEST_10');
      expect(res.body.themeUnlockGranted).toBe(false);
    });

    it('✅ Franchir 100 coffres octroie l\'item Unique de thème + le trophée CHEST_100', async () => {
      await giveChestKeyAndSetLevel({ totalChestsOpened: 99 });

      const res = await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.totalChestsOpened).toBe(100);
      expect(res.body.themeUnlockGranted).toBe(true);
      expect(res.body.newlyUnlocked).toContain('CHEST_100');

      const user = await User.findById(alice.userId);
      const themeItem = user.inventory.find((i) => i.itemType === 'THEME_UNLOCK_BLOOD_SANG');
      expect(themeItem).toBeDefined();
      expect(themeItem.rarity).toBe('unique');
      expect(themeItem.quantity).toBe(1);
    });

    it('🔒 Idempotent : l\'item de thème n\'est jamais dupliqué au-delà de 100 coffres', async () => {
      await User.updateOne(
        { _id: alice.userId },
        {
          $set: {
            level: 11, xp: xpForLevel(11), rank: getRankForLevel(11),
            totalChestsOpened: 105,
            inventory: [
              { itemType: 'CHEST_KEY', rarity: 'common', quantity: 1 },
              { itemType: 'THEME_UNLOCK_BLOOD_SANG', rarity: 'unique', quantity: 1 },
            ],
          },
        },
      );

      const res = await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.themeUnlockGranted).toBe(false);

      const user = await User.findById(alice.userId);
      const themeItems = user.inventory.filter((i) => i.itemType === 'THEME_UNLOCK_BLOOD_SANG');
      expect(themeItems).toHaveLength(1);
      expect(themeItems[0].quantity).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. checkAndUpdateGroupStreaks — couleur Rouge Sang Unique à 30j / 5 membres
  // ───────────────────────────────────────────────────────────────────────────
  describe('checkAndUpdateGroupStreaks — couleur "Rouge Sang Unique" (30j de streak à 5 membres)', () => {
    let members;

    beforeEach(async () => {
      const bob   = await createAndLoginUser('Bob',   'bob@athly.fr');
      const carol = await createAndLoginUser('Carol', 'carol@athly.fr');
      const dave  = await createAndLoginUser('Dave',  'dave@athly.fr');
      const eve   = await createAndLoginUser('Eve',   'eve@athly.fr');
      members = [alice, bob, carol, dave, eve];
    });

    async function markAllValidatedToday() {
      const today = new Date();
      await Promise.all(members.map((m) => Workout.create({ user: m.userId, status: 'finished', date: today })));
    }

    it('✅ Groupe de 5 membres franchissant 30 jours : chaque membre reçoit l\'item Unique', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const group = await StreakGroup.create({
        members:           members.map((m) => m.userId),
        currentStreak:     29,
        lastValidatedDate: yesterday,
      });
      await markAllValidatedToday();

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.currentStreak).toBe(30);
      expect(res.body.bloodSangUnlocked).toBe(true);

      for (const m of members) {
        const user = await User.findById(m.userId);
        const item = user.inventory.find((i) => i.itemType === 'FRAME_COLOR_BLOOD_SANG');
        expect(item).toBeDefined();
        expect(item.rarity).toBe('unique');
        expect(item.quantity).toBe(1);
      }

      const updatedGroup = await StreakGroup.findById(group._id);
      expect(updatedGroup.bloodSangAwarded).toBe(true);
    });

    it('🔒 Un groupe de 4 membres à 30 jours ne débloque rien (taille maximale requise)', async () => {
      const fourMembers = members.slice(0, 4);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const group = await StreakGroup.create({
        members:           fourMembers.map((m) => m.userId),
        currentStreak:     29,
        lastValidatedDate: yesterday,
      });
      const today = new Date();
      await Promise.all(fourMembers.map((m) => Workout.create({ user: m.userId, status: 'finished', date: today })));

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.currentStreak).toBe(30);
      expect(res.body.bloodSangUnlocked).toBe(false);

      const user = await User.findById(alice.userId);
      expect(user.inventory.find((i) => i.itemType === 'FRAME_COLOR_BLOOD_SANG')).toBeUndefined();
    });

    it('🔒 Idempotent : un groupe déjà récompensé ne redonne pas l\'item en continuant sa streak', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const group = await StreakGroup.create({
        members:           members.map((m) => m.userId),
        currentStreak:     30,
        lastValidatedDate: yesterday,
        bloodSangAwarded:  true,
      });
      await markAllValidatedToday();

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.currentStreak).toBe(31);
      expect(res.body.bloodSangUnlocked).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. God Mode — give-all-items
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/debug/godmode/give-all-items', () => {

    it('✅ Injecte 1 exemplaire de chaque itemType existant (consommables + cosmétiques Uniques)', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/give-all-items')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);

      const expectedTypes = User.schema.path('inventory').schema.path('itemType').enumValues;
      expect(res.body.inventory).toHaveLength(expectedTypes.length);

      for (const itemType of expectedTypes) {
        const entry = res.body.inventory.find((i) => i.itemType === itemType);
        expect(entry).toBeDefined();
        expect(entry.quantity).toBe(1);
      }

      // Les 3 cosmétiques Uniques sont bien inclus
      expect(res.body.inventory.map((i) => i.itemType)).toEqual(
        expect.arrayContaining(['PROFILE_FRAME_BLOOD_BOND', 'FRAME_COLOR_BLOOD_SANG', 'THEME_UNLOCK_BLOOD_SANG']),
      );
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/debug/godmode/give-all-items');
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. God Mode — simulateurs de trophées backend difficiles à déclencher
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/debug/godmode/simulate-chests-opened', () => {

    it('✅ Incrémente totalChestsOpened et débloque les trophées de palier franchis', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-chests-opened')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ amount: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.totalChestsOpened).toBe(10);
      expect(res.body.newlyUnlocked).toEqual(expect.arrayContaining(['CHEST_1', 'CHEST_10']));
      expect(res.body.themeUnlockGranted).toBe(false);

      const user = await User.findById(alice.userId);
      expect(user.totalChestsOpened).toBe(10);
    });

    it('✅ Octroie l\'item de thème Rouge Sang au palier 100', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-chests-opened')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ amount: 100 });

      expect(res.statusCode).toBe(200);
      expect(res.body.themeUnlockGranted).toBe(true);
      expect(res.body.newlyUnlocked).toContain('CHEST_100');

      const user = await User.findById(alice.userId);
      expect(user.inventory.find((i) => i.itemType === 'THEME_UNLOCK_BLOOD_SANG')).toBeDefined();
    });

    it('❌ 400 si amount hors bornes (1–250)', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-chests-opened')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ amount: 500 });
      expect(res.statusCode).toBe(400);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/debug/godmode/simulate-chests-opened').send({ amount: 1 });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/debug/godmode/simulate-referral', () => {

    it('✅ Crée un filleul factice et débloque FIRST_REFERRAL', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-referral')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.newlyUnlocked).toContain('FIRST_REFERRAL');

      const referred = await User.exists({ referredBy: alice.userId });
      expect(referred).toBeTruthy();
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/debug/godmode/simulate-referral');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/debug/godmode/simulate-birthday', () => {

    it('✅ Force la date de naissance à aujourd\'hui et débloque les 2 trophées anniversaire', async () => {
      const res = await request(app)
        .post('/api/debug/godmode/simulate-birthday')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).toEqual(expect.arrayContaining(['BIRTHDAY_SET', 'BIRTHDAY_CELEBRATED']));

      const user = await User.findById(alice.userId);
      expect(user.isBirthdateSet).toBe(true);
      expect(user.lastBirthdayRewardedYear).toBe(new Date().getUTCFullYear());
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/debug/godmode/simulate-birthday');
      expect(res.statusCode).toBe(401);
    });
  });
});
