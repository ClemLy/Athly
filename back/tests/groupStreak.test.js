'use strict';

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../app');
const User       = require('../models/User');
const Friendship  = require('../models/Friendship');
const StreakGroup = require('../models/StreakGroup');
const Workout    = require('../models/Workout');

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

describe("Streaks de Groupe & Niveaux d'Amitié Athly — V2", () => {
  let alice, bob, carol, dave;

  // ── Setup global ──────────────────────────────────────────────────────────
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});

    alice = await createAndLoginUser('Alice', 'alice@athly.fr');
    bob   = await createAndLoginUser('Bob',   'bob@athly.fr');
    carol = await createAndLoginUser('Carol', 'carol@athly.fr');
    dave  = await createAndLoginUser('Dave',  'dave@athly.fr');

    // Amitiés acceptées créées directement en DB (bypass API pour la vitesse)
    await Friendship.create({ requester: alice.userId, recipient: bob.userId,   status: 'accepted' });
    await Friendship.create({ requester: alice.userId, recipient: carol.userId, status: 'accepted' });
    await Friendship.create({ requester: alice.userId, recipient: dave.userId,  status: 'accepted' });
    await Friendship.create({ requester: bob.userId,   recipient: carol.userId, status: 'accepted' });
  });

  // ── Teardown global ───────────────────────────────────────────────────────
  afterAll(async () => {
    await User.deleteMany({});
    await Friendship.deleteMany({});
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
    await mongoose.connection.close();
  });

  // ── Reset groupes et séances entre chaque test ────────────────────────────
  afterEach(async () => {
    await StreakGroup.deleteMany({});
    await Workout.deleteMany({});
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. inviteToGroup — création et invitation
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/groups/invite — inviteToGroup", () => {

    it("✅ Alice crée un groupe et invite Bob — Bob dans pendingInvites", async () => {
      const res = await request(app)
        .post('/api/groups/invite')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendIds: [bob.userId], name: 'Les Guerriers du Lundi' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.group.members).toContain(alice.userId);
      expect(res.body.group.pendingInvites).toContain(bob.userId);
      expect(res.body.group.name).toBe('Les Guerriers du Lundi');
    });

    it("✅ Alice ajoute Carol à son groupe existant", async () => {
      // Seed : groupe existant avec Alice membre + Bob en pending
      await StreakGroup.create({
        members:        [alice.userId],
        pendingInvites: [bob.userId],
      });

      const res = await request(app)
        .post('/api/groups/invite')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendIds: [carol.userId] });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await StreakGroup.findOne({ members: alice.userId });
      expect(updated.pendingInvites.map(String)).toContain(carol.userId);
    });

    it("❌ Invitation bloquée si le groupe est déjà plein", async () => {
      // Seed : groupe avec 5 membres (capacité max atteinte)
      const fakeIds = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
      await StreakGroup.create({ members: [alice.userId, ...fakeIds] });

      const res = await request(app)
        .post('/api/groups/invite')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendIds: [bob.userId] });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("❌ Invitation bloquée si l'invité est déjà membre d'un autre groupe", async () => {
      // Seed : Bob est déjà dans un autre groupe
      await StreakGroup.create({ members: [bob.userId] });

      const res = await request(app)
        .post('/api/groups/invite')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendIds: [bob.userId] });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("❌ Invitation bloquée si l'invité n'est pas un ami accepté", async () => {
      // Un ObjectId valide mais sans relation d'amitié avec Alice
      const strangerObjectId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/groups/invite')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendIds: [strangerObjectId] });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("❌ Refusé sans token (401)", async () => {
      const res = await request(app)
        .post('/api/groups/invite')
        .send({ friendIds: [bob.userId] });

      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. respondToGroupInvite — réponse à une invitation
  // ───────────────────────────────────────────────────────────────────────────
  describe("PUT /api/groups/respond/:groupId — respondToGroupInvite", () => {
    let groupId;

    beforeEach(async () => {
      const group = await StreakGroup.create({
        members:        [alice.userId],
        pendingInvites: [bob.userId, carol.userId],
      });
      groupId = group._id.toString();
    });

    it("✅ Bob accepte l'invitation et devient membre", async () => {
      const res = await request(app)
        .put(`/api/groups/respond/${groupId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await StreakGroup.findById(groupId);
      expect(updated.members.map(String)).toContain(bob.userId);
      expect(updated.pendingInvites.map(String)).not.toContain(bob.userId);
    });

    it("✅ Carol refuse l'invitation et est retirée des pendingInvites", async () => {
      const res = await request(app)
        .put(`/api/groups/respond/${groupId}`)
        .set('Authorization', `Bearer ${carol.token}`)
        .send({ accept: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await StreakGroup.findById(groupId);
      expect(updated.members.map(String)).not.toContain(carol.userId);
      expect(updated.pendingInvites.map(String)).not.toContain(carol.userId);
    });

    it("❌ Acceptation bloquée si l'utilisateur est déjà dans un autre groupe", async () => {
      // Bob est déjà membre d'un autre groupe
      await StreakGroup.create({ members: [bob.userId] });

      const res = await request(app)
        .put(`/api/groups/respond/${groupId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: true });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("❌ 403 si l'utilisateur n'a pas d'invitation pour ce groupe", async () => {
      // Dave n'est pas dans pendingInvites du groupe
      const res = await request(app)
        .put(`/api/groups/respond/${groupId}`)
        .set('Authorization', `Bearer ${dave.token}`)
        .send({ accept: true });

      expect(res.statusCode).toBe(403);
    });

    it("❌ 400 si le champ accept n'est pas un booléen", async () => {
      const res = await request(app)
        .put(`/api/groups/respond/${groupId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ accept: 'oui' });

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. shakeMember — bouton Ping
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/groups/:groupId/shake/:memberId — shakeMember", () => {
    let groupId;

    beforeEach(async () => {
      const group = await StreakGroup.create({
        members: [alice.userId, bob.userId],
      });
      groupId = group._id.toString();
    });

    it("✅ Alice secoue Bob qui n'a pas encore fait sa séance — 200 OK", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/shake/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.targetId).toBe(bob.userId);
    });

    it("❌ Impossible de secouer un membre qui a déjà validé sa séance aujourd'hui", async () => {
      await Workout.create({ user: bob.userId, status: 'finished', date: new Date() });

      const res = await request(app)
        .post(`/api/groups/${groupId}/shake/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("❌ Impossible de se secouer soi-même", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/shake/${alice.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(422);
    });

    it("❌ 404 si la cible n'est pas membre du groupe", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/shake/${carol.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(404);
    });

    it("❌ 403 si l'appelant n'est pas membre du groupe", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/shake/${alice.userId}`)
        .set('Authorization', `Bearer ${dave.token}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. checkAndUpdateGroupStreaks — validation quotidienne
  // ───────────────────────────────────────────────────────────────────────────
  describe("POST /api/groups/:groupId/check-streak — checkAndUpdateGroupStreaks", () => {

    it("✅ Streak incrémentée et XP d'amitié mis à jour quand tous valident", async () => {
      const group = await StreakGroup.create({ members: [alice.userId, bob.userId] });

      const today = new Date();
      await Workout.create({ user: alice.userId, status: 'finished', date: today });
      await Workout.create({ user: bob.userId,   status: 'finished', date: today });

      // XP d'amitié avant
      const fBefore = await Friendship.findOne({
        $or: [
          { requester: alice.userId, recipient: bob.userId },
          { requester: bob.userId,   recipient: alice.userId },
        ],
      });
      const xpBefore = fBefore?.friendshipXp ?? 0;

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.allValidated).toBe(true);
      expect(res.body.currentStreak).toBe(1);
      expect(res.body.xpGain).toBeGreaterThan(0);

      // Streak incrémentée en DB
      const updatedGroup = await StreakGroup.findById(group._id);
      expect(updatedGroup.currentStreak).toBe(1);
      expect(updatedGroup.lastValidatedDate).not.toBeNull();

      // XP d'amitié Alice-Bob augmenté
      const fAfter = await Friendship.findById(fBefore._id);
      expect(fAfter.friendshipXp).toBeGreaterThan(xpBefore);
    });

    it("✅ Streak non incrémentée si un membre n'a pas validé sa séance", async () => {
      const group = await StreakGroup.create({ members: [alice.userId, bob.userId] });

      // Seule Alice a une séance
      await Workout.create({ user: alice.userId, status: 'finished', date: new Date() });

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.allValidated).toBe(false);
      expect(res.body.pendingMembers).toContain(bob.userId);

      const unchanged = await StreakGroup.findById(group._id);
      expect(unchanged.currentStreak).toBe(0);
    });

    it("✅ Idempotence : un groupe déjà validé aujourd'hui renvoie alreadyValidated=true", async () => {
      const group = await StreakGroup.create({
        members:           [alice.userId, bob.userId],
        currentStreak:     5,
        lastValidatedDate: new Date(), // déjà validé aujourd'hui
      });

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.alreadyValidated).toBe(true);

      // Streak inchangée
      const unchanged = await StreakGroup.findById(group._id);
      expect(unchanged.currentStreak).toBe(5);
    });

    it("✅ XP d'amitié augmente entre toutes les paires d'un groupe à 3 membres", async () => {
      // Alice + Bob + Carol dans le même groupe (Alice-Carol et Bob-Carol sont amis)
      const group = await StreakGroup.create({ members: [alice.userId, bob.userId, carol.userId] });

      const today = new Date();
      await Workout.create({ user: alice.userId, status: 'finished', date: today });
      await Workout.create({ user: bob.userId,   status: 'finished', date: today });
      await Workout.create({ user: carol.userId,  status: 'finished', date: today });

      await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      // Vérification paire Alice-Bob
      const fAliceBob = await Friendship.findOne({
        $or: [{ requester: alice.userId, recipient: bob.userId }, { requester: bob.userId, recipient: alice.userId }],
      });
      expect(fAliceBob.friendshipXp).toBeGreaterThan(0);

      // Vérification paire Bob-Carol (amis directs)
      const fBobCarol = await Friendship.findOne({
        $or: [{ requester: bob.userId, recipient: carol.userId }, { requester: carol.userId, recipient: bob.userId }],
      });
      expect(fBobCarol.friendshipXp).toBeGreaterThan(0);
    });

    it("❌ 403 si l'appelant n'est pas membre du groupe", async () => {
      const group = await StreakGroup.create({ members: [alice.userId, bob.userId] });

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${dave.token}`);

      expect(res.statusCode).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. getMyGroup — consultation du groupe
  // ───────────────────────────────────────────────────────────────────────────
  describe("GET /api/groups/my-group — getMyGroup", () => {

    it("✅ Retourne le groupe avec membres et pendingInvites populés", async () => {
      await StreakGroup.create({
        members:        [alice.userId, bob.userId],
        pendingInvites: [carol.userId],
        currentStreak:  3,
      });

      const res = await request(app)
        .get('/api/groups/my-group')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.group).not.toBeNull();
      expect(res.body.group.currentStreak).toBe(3);

      // Membres populés avec pseudo et level
      const memberIds = res.body.group.members.map((m) => m._id);
      expect(memberIds).toContain(alice.userId);
      expect(memberIds).toContain(bob.userId);
      expect(res.body.group.members[0]).toHaveProperty('pseudo');

      // Invitations en attente populées
      const pendingIds = res.body.group.pendingInvites.map((p) => p._id);
      expect(pendingIds).toContain(carol.userId);
    });

    it("✅ Retourne group=null si l'utilisateur n'appartient à aucun groupe", async () => {
      const res = await request(app)
        .get('/api/groups/my-group')
        .set('Authorization', `Bearer ${dave.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.group).toBeNull();
    });

    it("❌ Refusé avec 401 sans token", async () => {
      const res = await request(app).get('/api/groups/my-group');
      expect(res.statusCode).toBe(401);
    });
  });
});
