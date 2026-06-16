'use strict';

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../app');
const User       = require('../models/User');
const Friendship = require('../models/Friendship');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Inscrit un user, bypass OTP en DB, connecte et renvoie { token, userId }. */
async function createAndLoginUser(pseudo, email) {
  await request(app)
    .post('/api/auth/register')
    .send({ pseudo, email, password: 'Password123!' });

  await User.updateOne({ email }, { isVerified: true });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' });

  const user = await User.findOne({ email }).select('_id');
  return { token: res.body.token, userId: user._id.toString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite principale
// ─────────────────────────────────────────────────────────────────────────────
describe('Système d\'Amis Athly — V2', () => {
  let alice, bob; // { token, userId }

  // ── Setup global : connexion DB + création des deux comptes de test ────────
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await User.deleteMany({});
    await Friendship.deleteMany({});

    alice = await createAndLoginUser('Alice', 'alice@athly.fr');
    bob   = await createAndLoginUser('Bob',   'bob@athly.fr');
  });

  // ── Teardown global ────────────────────────────────────────────────────────
  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await mongoose.connection.close();
  });

  // ── Reset des amitiés entre chaque test pour l'isolation ──────────────────
  afterEach(async () => {
    await Friendship.deleteMany({});
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. sendFriendRequest — envoi de demande
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/friends/request — sendFriendRequest', () => {

    it('✅ Alice envoie une demande à Bob avec succès', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.friendship).toMatchObject({
        requester: alice.userId,
        recipient: bob.userId,
        status:    'pending',
      });
    });

    it('❌ Impossible de s\'envoyer une demande à soi-même', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: alice.userId });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/vous-même/i);
    });

    it('❌ Impossible d\'envoyer une demande si une relation pending existe déjà', async () => {
      // 1ère demande — crée la relation
      await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      // 2ème demande — doit échouer
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('❌ Impossible si la relation existe dans le sens inverse (Bob → Alice)', async () => {
      // Bob envoie à Alice en premier
      await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ friendId: alice.userId });

      // Alice essaie d'envoyer à Bob — doit échouer (relation inverse existe)
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('❌ Refusé sans token (401)', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(401);
    });

    it('❌ friendId invalide (400)', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: 'pas-un-objectid' });

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. acceptFriendRequest — acceptation
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /api/friends/accept/:requestId — acceptFriendRequest', () => {
    let requestId;

    // Crée une demande Alice → Bob avant chaque test de ce bloc
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });
      requestId = res.body.friendship._id;
    });

    it('✅ Bob accepte la demande d\'Alice', async () => {
      const res = await request(app)
        .put(`/api/friends/accept/${requestId}`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.friendship.status).toBe('accepted');
    });

    it('❌ Alice (requester) ne peut pas accepter sa propre demande', async () => {
      const res = await request(app)
        .put(`/api/friends/accept/${requestId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('❌ Accepter une demande inexistante renvoie 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/friends/accept/${fakeId}`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.statusCode).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. declineFriendRequest — refus
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /api/friends/decline/:requestId — declineFriendRequest', () => {
    let requestId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });
      requestId = res.body.friendship._id;
    });

    it('✅ Bob refuse la demande et le document est supprimé', async () => {
      const res = await request(app)
        .put(`/api/friends/decline/${requestId}`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérification en base : le document ne doit plus exister
      const inDb = await Friendship.findById(requestId);
      expect(inDb).toBeNull();
    });

    it('✅ Après refus, Alice peut renvoyer une demande à Bob', async () => {
      // Bob refuse
      await request(app)
        .put(`/api/friends/decline/${requestId}`)
        .set('Authorization', `Bearer ${bob.token}`);

      // Alice renvoie — doit réussir car le document a été supprimé
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      expect(res.statusCode).toBe(201);
    });

    it('❌ Alice (requester) ne peut pas refuser sa propre demande', async () => {
      const res = await request(app)
        .put(`/api/friends/decline/${requestId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. getFriendsList — liste des amis
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/friends/list — getFriendsList', () => {

    it('✅ Liste vide si aucune amitié acceptée', async () => {
      const res = await request(app)
        .get('/api/friends/list')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.friends).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('✅ Bob apparaît dans la liste d\'Alice après acceptation', async () => {
      // Alice envoie, Bob accepte
      const sendRes = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      await request(app)
        .put(`/api/friends/accept/${sendRes.body.friendship._id}`)
        .set('Authorization', `Bearer ${bob.token}`);

      // Vérifie la liste côté Alice
      const res = await request(app)
        .get('/api/friends/list')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);

      const friend = res.body.friends[0];
      expect(friend.user._id).toBe(bob.userId);
      expect(friend.user).toHaveProperty('pseudo');
      expect(friend.user).toHaveProperty('level');
      expect(friend.user).toHaveProperty('rank');
      // Le mot de passe ne doit jamais être exposé
      expect(friend.user).not.toHaveProperty('password');
    });

    it('✅ Bob voit aussi Alice dans sa propre liste (relation bidirectionnelle)', async () => {
      const sendRes = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      await request(app)
        .put(`/api/friends/accept/${sendRes.body.friendship._id}`)
        .set('Authorization', `Bearer ${bob.token}`);

      const res = await request(app)
        .get('/api/friends/list')
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.friends[0].user._id).toBe(alice.userId);
    });

    it('❌ Refusé sans token (401)', async () => {
      const res = await request(app).get('/api/friends/list');
      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. getPendingRequests — demandes reçues
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/friends/pending — getPendingRequests', () => {

    it('✅ Bob voit la demande d\'Alice dans ses requêtes en attente', async () => {
      await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      const res = await request(app)
        .get('/api/friends/pending')
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.requests[0].requester._id).toBe(alice.userId);
    });

    it('✅ Alice ne voit pas sa propre demande dans ses pending (elle est requester)', async () => {
      await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendId: bob.userId });

      const res = await request(app)
        .get('/api/friends/pending')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });
});
