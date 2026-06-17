'use strict';

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../app');
const User       = require('../models/User');
const Friendship = require('../models/Friendship');
const { CATALOG_SIZE } = require('../controllers/reward.controller');

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

describe("Système Récompenses & Trophées Athly — Briques I & V", () => {
  let alice, bob;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await mongoose.connection.close();
  });

  // Recrée deux utilisateurs propres avant chaque test
  beforeEach(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    alice = await createAndLoginUser('Alice', 'alice@athly.fr');
    bob   = await createAndLoginUser('Bob',   'bob@athly.fr');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. setBirthdate — système anti-triche anniversaire
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/rewards/birthdate — setBirthdate", () => {

    it("✅ Enregistre l'anniversaire, offre une CHEST_KEY et débloque BIRTHDAY_SET", async () => {
      const res = await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: '1995-03-15' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.chestKeyAdded).toBe(true);
      expect(res.body.newlyUnlocked).toContain('BIRTHDAY_SET');

      // Vérification en base
      const updatedUser = await User.findById(alice.userId);
      expect(updatedUser.isBirthdateSet).toBe(true);
      expect(updatedUser.birthdate).not.toBeNull();

      const chestKey = updatedUser.inventory.find((i) => i.itemType === 'CHEST_KEY');
      expect(chestKey).toBeDefined();
      expect(chestKey.quantity).toBeGreaterThanOrEqual(1);

      const trophy = updatedUser.achievements.find((a) => a.achievementId === 'BIRTHDAY_SET');
      expect(trophy).toBeDefined();
    });

    it("✅ Incrémente la quantité si une CHEST_KEY existait déjà en inventaire", async () => {
      // Seed : Alice a déjà 2 CHEST_KEY
      await User.updateOne(
        { _id: alice.userId },
        { inventory: [{ itemType: 'CHEST_KEY', rarity: 'common', quantity: 2 }] },
      );

      await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: '1990-07-04' });

      const updatedUser = await User.findById(alice.userId);
      const chestKey = updatedUser.inventory.find((i) => i.itemType === 'CHEST_KEY');
      expect(chestKey.quantity).toBe(3);
    });

    it("❌ 403 anti-triche : impossible de modifier la date une deuxième fois", async () => {
      // Première saisie
      await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: '1995-03-15' });

      // Deuxième tentative
      const res = await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: '2000-01-01' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);

      // La date originale doit être inchangée
      const user = await User.findById(alice.userId);
      expect(user.birthdate.getFullYear()).toBe(1995);
    });

    it("❌ 400 si le format de date est invalide", async () => {
      const res = await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: 'pas-une-date' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("❌ 400 si la date est dans le futur", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const res = await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: futureDate.toISOString() });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("❌ 400 si le champ birthdate est absent", async () => {
      const res = await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it("❌ 401 sans token", async () => {
      const res = await request(app)
        .post('/api/rewards/birthdate')
        .send({ birthdate: '1995-03-15' });

      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. getUserAchievements — liste complète des trophées
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/rewards/achievements — getUserAchievements", () => {

    it("✅ Retourne la liste complète avec les bons stats (aucun trophée débloqué)", async () => {
      const res = await request(app)
        .get('/api/rewards/achievements')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.total).toBe(CATALOG_SIZE);
      expect(res.body.stats.unlocked).toBe(0);
      expect(res.body.stats.percentage).toBe(0);
      expect(res.body.achievements).toHaveLength(CATALOG_SIZE);

      // Tous les trophées sont verrouillés
      const allLocked = res.body.achievements.every((a) => !a.unlocked);
      expect(allLocked).toBe(true);

      // Les trophées cachés non débloqués masquent nom et description
      const hiddenLocked = res.body.achievements.find(
        (a) => a.id === 'BIRTHDAY_SET',
      );
      expect(hiddenLocked.name).toBe('???');
    });

    it("✅ Révèle le trophée BIRTHDAY_SET et met à jour les stats après déblocage", async () => {
      await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: '1992-06-10' });

      const res = await request(app)
        .get('/api/rewards/achievements')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.stats.unlocked).toBeGreaterThanOrEqual(1);

      const birthdayTrophy = res.body.achievements.find((a) => a.id === 'BIRTHDAY_SET');
      expect(birthdayTrophy.unlocked).toBe(true);
      expect(birthdayTrophy.unlockedAt).not.toBeNull();
      expect(birthdayTrophy.name).not.toBe('???');

      // Les trophées verrouillés ont unlockedAt === null
      const lockedOne = res.body.achievements.find((a) => !a.unlocked);
      expect(lockedOne.unlockedAt).toBeNull();
    });

    it("❌ 401 sans token", async () => {
      const res = await request(app).get('/api/rewards/achievements');
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. checkAchievements — vérification et déblocage automatique
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/rewards/check — checkAchievements", () => {

    it("✅ FIRST_COMMON_ITEM débloqué si l'inventaire contient un objet Commun", async () => {
      await User.updateOne(
        { _id: alice.userId },
        { inventory: [{ itemType: 'ENERGY_DRINK', rarity: 'common', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).toContain('FIRST_COMMON_ITEM');

      // Persistance en base
      const user = await User.findById(alice.userId);
      const trophy = user.achievements.find((a) => a.achievementId === 'FIRST_COMMON_ITEM');
      expect(trophy).toBeDefined();
    });

    it("✅ FIRST_RARE_ITEM débloqué si l'inventaire contient un objet Rare", async () => {
      await User.updateOne(
        { _id: alice.userId },
        { inventory: [{ itemType: 'STREAK_FREEZE', rarity: 'rare', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.newlyUnlocked).toContain('FIRST_RARE_ITEM');
    });

    it("✅ FIRST_LEGENDARY_ITEM débloqué si l'inventaire contient un objet Légendaire", async () => {
      await User.updateOne(
        { _id: alice.userId },
        { inventory: [{ itemType: 'LEVEL_COUPON', rarity: 'legendary', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.newlyUnlocked).toContain('FIRST_LEGENDARY_ITEM');
    });

    it("✅ FRIENDSHIP_LEVEL_5 débloqué si une amitié est au niveau 5", async () => {
      // Seed : amitié Alice-Bob au niveau 5
      await Friendship.create({
        requester:       alice.userId,
        recipient:       bob.userId,
        status:          'accepted',
        friendshipLevel: 5,
        friendshipXp:    1500,
      });

      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).toContain('FRIENDSHIP_LEVEL_5');
    });

    it("✅ FIRST_REFERRAL débloqué si l'utilisateur a parrainé quelqu'un", async () => {
      // Seed : Bob a été parrainé par Alice (alice est la référente)
      await User.updateOne({ _id: bob.userId }, { referredBy: alice.userId });

      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).toContain('FIRST_REFERRAL');
    });

    it("✅ Idempotence : un trophée déjà débloqué n'est pas re-accordé", async () => {
      // Débloquer BIRTHDAY_SET via setBirthdate
      await request(app)
        .post('/api/rewards/birthdate')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ birthdate: '1995-03-15' });

      // Deuxième appel à check : BIRTHDAY_SET ne doit pas réapparaître
      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).not.toContain('BIRTHDAY_SET');

      // Le trophée existe une seule fois en base
      const user = await User.findById(alice.userId);
      const allBirthday = user.achievements.filter((a) => a.achievementId === 'BIRTHDAY_SET');
      expect(allBirthday).toHaveLength(1);
    });

    it("✅ Déblocage multiple en un seul appel (common + rare dans le même inventaire)", async () => {
      await User.updateOne(
        { _id: alice.userId },
        {
          inventory: [
            { itemType: 'ENERGY_DRINK', rarity: 'common',    quantity: 1 },
            { itemType: 'STREAK_FREEZE', rarity: 'rare',     quantity: 2 },
            { itemType: 'TRIPLE_XP',    rarity: 'epic',      quantity: 1 },
          ],
        },
      );

      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).toContain('FIRST_COMMON_ITEM');
      expect(res.body.newlyUnlocked).toContain('FIRST_RARE_ITEM');
      expect(res.body.newlyUnlocked).toContain('FIRST_EPIC_ITEM');
      expect(res.body.count).toBe(3);
    });

    it("✅ Retourne un tableau vide si aucune condition n'est remplie", async () => {
      const res = await request(app)
        .post('/api/rewards/check')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.newlyUnlocked).toHaveLength(0);
      expect(res.body.count).toBe(0);
    });

    it("❌ 401 sans token", async () => {
      const res = await request(app).post('/api/rewards/check');
      expect(res.statusCode).toBe(401);
    });
  });
});
