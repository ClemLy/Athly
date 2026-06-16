'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const app  = require('../app');
const User = require('../models/User');

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

  const user = await User.findOne({ email }).select('_id xp level');
  return { token: loginRes.body.token, userId: user._id.toString(), xp: user.xp };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite principale
// ─────────────────────────────────────────────────────────────────────────────

describe("Système Inventaire & Coffres Athly — V2", () => {
  let user;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  // Recrée un utilisateur propre avant chaque test
  beforeEach(async () => {
    await User.deleteMany({});
    user = await createAndLoginUser('TestHero', 'hero@athly.fr');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. openChest — ouverture de coffre
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/inventory/chest/open — openChest', () => {

    it('❌ Bloqué avec 403 si le niveau est inférieur à 11 (niveau = 1 par défaut)', async () => {
      const res = await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/niveau 11/i);
    });

    it('❌ Bloqué avec 400 si niveau 11 mais aucune CHEST_KEY en inventaire', async () => {
      await User.updateOne({ _id: user.userId }, { level: 11 });

      const res = await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('✅ Succès si niveau 11 et CHEST_KEY présente — item tiré et clé consommée', async () => {
      await User.updateOne(
        { _id: user.userId },
        { level: 11, inventory: [{ itemType: 'CHEST_KEY', rarity: 'common', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.drawnItem).toHaveProperty('itemType');
      expect(res.body.drawnItem).toHaveProperty('rarity');

      // La CHEST_KEY doit avoir été consommée
      const updatedUser = await User.findById(user.userId);
      const chestKey = updatedUser.inventory.find((i) => i.itemType === 'CHEST_KEY');
      expect(chestKey).toBeUndefined();

      // L'item tiré doit être présent en inventaire
      const drawnInDb = updatedUser.inventory.find((i) => i.itemType === res.body.drawnItem.itemType);
      expect(drawnInDb).toBeDefined();
      expect(drawnInDb.quantity).toBeGreaterThanOrEqual(1);
    });

    it('✅ 2 CHEST_KEY : une seule consommée, une restante en inventaire', async () => {
      await User.updateOne(
        { _id: user.userId },
        { level: 11, inventory: [{ itemType: 'CHEST_KEY', rarity: 'common', quantity: 2 }] },
      );

      await request(app)
        .post('/api/inventory/chest/open')
        .set('Authorization', `Bearer ${user.token}`);

      const updatedUser = await User.findById(user.userId);
      const chestKey = updatedUser.inventory.find((i) => i.itemType === 'CHEST_KEY');
      expect(chestKey).toBeDefined();
      expect(chestKey.quantity).toBe(1);
    });

    it('❌ Refusé avec 401 sans token', async () => {
      const res = await request(app).post('/api/inventory/chest/open');
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. useItem — utilisation d'un consommable
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/inventory/item/use — useItem', () => {

    it('✅ ENERGY_DRINK : +150 XP et item supprimé de l\'inventaire', async () => {
      const initialXp = 500;
      await User.updateOne(
        { _id: user.userId },
        { xp: initialXp, inventory: [{ itemType: 'ENERGY_DRINK', rarity: 'common', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'ENERGY_DRINK' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.xp).toBe(initialXp + 150);

      // Item consommé (quantité 0 = entrée supprimée)
      const updatedUser = await User.findById(user.userId);
      const drink = updatedUser.inventory.find((i) => i.itemType === 'ENERGY_DRINK');
      expect(drink).toBeUndefined();
    });

    it('✅ ENERGY_DRINK (qty 3) : 1 unité consommée, 2 restantes', async () => {
      await User.updateOne(
        { _id: user.userId },
        { inventory: [{ itemType: 'ENERGY_DRINK', rarity: 'common', quantity: 3 }] },
      );

      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'ENERGY_DRINK' });

      expect(res.statusCode).toBe(200);

      const updatedUser = await User.findById(user.userId);
      const drink = updatedUser.inventory.find((i) => i.itemType === 'ENERGY_DRINK');
      expect(drink.quantity).toBe(2);
    });

    it('✅ STREAK_FREEZE : streakGels passe de 1 à 2', async () => {
      await User.updateOne(
        { _id: user.userId },
        { streakGels: 1, inventory: [{ itemType: 'STREAK_FREEZE', rarity: 'rare', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'STREAK_FREEZE' });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.streakGels).toBe(2);
    });

    it('✅ STREAK_FREEZE : capped à 3 même si streakGels est déjà à 3', async () => {
      await User.updateOne(
        { _id: user.userId },
        { streakGels: 3, inventory: [{ itemType: 'STREAK_FREEZE', rarity: 'rare', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'STREAK_FREEZE' });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.streakGels).toBe(3);
    });

    it('✅ SUPER_STREAK_FREEZE : streakGels forcé à 3 quelle que soit la valeur initiale', async () => {
      await User.updateOne(
        { _id: user.userId },
        { streakGels: 0, inventory: [{ itemType: 'SUPER_STREAK_FREEZE', rarity: 'epic', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'SUPER_STREAK_FREEZE' });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.streakGels).toBe(3);
    });

    it('✅ LEVEL_COUPON : +1 niveau et rang mis à jour (Novice → Initié)', async () => {
      await User.updateOne(
        { _id: user.userId },
        { level: 10, rank: 'Novice', inventory: [{ itemType: 'LEVEL_COUPON', rarity: 'legendary', quantity: 1 }] },
      );

      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'LEVEL_COUPON' });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.level).toBe(11);
      expect(res.body.user.rank).toBe('Initié');
    });

    it('❌ 400 si l\'item n\'est pas dans l\'inventaire', async () => {
      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'ENERGY_DRINK' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('❌ 400 si l\'itemType est invalide ou inconnu', async () => {
      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ itemType: 'FAKE_ITEM' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('❌ 400 si le body est vide (itemType manquant)', async () => {
      const res = await request(app)
        .post('/api/inventory/item/use')
        .set('Authorization', `Bearer ${user.token}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('❌ Refusé avec 401 sans token', async () => {
      const res = await request(app)
        .post('/api/inventory/item/use')
        .send({ itemType: 'ENERGY_DRINK' });

      expect(res.statusCode).toBe(401);
    });
  });
});
