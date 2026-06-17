'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../models/User');

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

describe("Système de Parrainage Athly — Brique III", () => {
  let alice, bob;

  const ALICE_CODE = 'ATH-ALICE01';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  // Recrée deux utilisateurs propres avant chaque test
  beforeEach(async () => {
    await User.deleteMany({});
    alice = await createAndLoginUser('Alice', 'alice@athly.fr');
    bob   = await createAndLoginUser('Bob',   'bob@athly.fr');
    // Attribue un code de parrainage à Alice
    await User.updateOne({ _id: alice.userId }, { referralCode: ALICE_CODE });
  });

  // ─── 1. claimReferral — cas de succès ──────────────────────────────────────
  describe("POST /api/referral/claim — succès", () => {

    it("✅ Enregistre le parrain (referredBy) sur le filleul", async () => {
      await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      const updatedBob = await User.findById(bob.userId);
      expect(updatedBob.referredBy.toString()).toBe(alice.userId);
    });

    it("✅ Le filleul reçoit 1 STREAK_FREEZE et 1 LEVEL_COUPON", async () => {
      const res = await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedBob = await User.findById(bob.userId);
      const sf = updatedBob.inventory.find((i) => i.itemType === 'STREAK_FREEZE');
      const lc = updatedBob.inventory.find((i) => i.itemType === 'LEVEL_COUPON');
      expect(sf).toBeDefined();
      expect(sf.quantity).toBeGreaterThanOrEqual(1);
      expect(lc).toBeDefined();
      expect(lc.quantity).toBeGreaterThanOrEqual(1);
    });

    it("✅ Le parrain reçoit 1 STREAK_FREEZE et 1 LEVEL_COUPON", async () => {
      await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      const updatedAlice = await User.findById(alice.userId);
      const sf = updatedAlice.inventory.find((i) => i.itemType === 'STREAK_FREEZE');
      const lc = updatedAlice.inventory.find((i) => i.itemType === 'LEVEL_COUPON');
      expect(sf).toBeDefined();
      expect(sf.quantity).toBeGreaterThanOrEqual(1);
      expect(lc).toBeDefined();
      expect(lc.quantity).toBeGreaterThanOrEqual(1);
    });

    it("✅ Le parrain débloque le trophée FIRST_REFERRAL", async () => {
      const res = await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      expect(res.body.referrerNewAchievements).toContain('FIRST_REFERRAL');

      const updatedAlice = await User.findById(alice.userId);
      const trophy = updatedAlice.achievements.find(
        (a) => a.achievementId === 'FIRST_REFERRAL',
      );
      expect(trophy).toBeDefined();
    });

    it("✅ Incrémente la quantité si le parrain avait déjà un STREAK_FREEZE en inventaire", async () => {
      // Seed : Alice a déjà 1 STREAK_FREEZE
      await User.updateOne(
        { _id: alice.userId },
        { inventory: [{ itemType: 'STREAK_FREEZE', rarity: 'rare', quantity: 1 }] },
      );

      await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      const updatedAlice = await User.findById(alice.userId);
      const sf = updatedAlice.inventory.find((i) => i.itemType === 'STREAK_FREEZE');
      expect(sf.quantity).toBe(2);
    });

    it("✅ Incrémente la quantité si le filleul avait déjà un LEVEL_COUPON en inventaire", async () => {
      // Seed : Bob a déjà 1 LEVEL_COUPON
      await User.updateOne(
        { _id: bob.userId },
        { inventory: [{ itemType: 'LEVEL_COUPON', rarity: 'legendary', quantity: 1 }] },
      );

      await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      const updatedBob = await User.findById(bob.userId);
      const lc = updatedBob.inventory.find((i) => i.itemType === 'LEVEL_COUPON');
      expect(lc.quantity).toBe(2);
    });
  });

  // ─── 2. claimReferral — gardes de sécurité ─────────────────────────────────
  describe("POST /api/referral/claim — erreurs", () => {

    it("❌ 400 : impossible d'utiliser son propre code de parrainage", async () => {
      const res = await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ referralCode: ALICE_CODE });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("❌ 409 : impossible de se faire parrainer une deuxième fois", async () => {
      // Premier claim valide
      await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      // Deuxième tentative → 409
      const res = await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: ALICE_CODE });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);

      // referredBy ne doit pas avoir changé
      const updatedBob = await User.findById(bob.userId);
      expect(updatedBob.referredBy.toString()).toBe(alice.userId);
    });

    it("❌ 404 : code de parrainage inexistant", async () => {
      const res = await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ referralCode: 'ATH-XXXXXX' });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("❌ 400 : champ referralCode absent du body", async () => {
      const res = await request(app)
        .post('/api/referral/claim')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("❌ 401 : sans token d'authentification", async () => {
      const res = await request(app)
        .post('/api/referral/claim')
        .send({ referralCode: ALICE_CODE });

      expect(res.statusCode).toBe(401);
    });
  });
});
