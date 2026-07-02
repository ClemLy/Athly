'use strict';

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../app');
const User       = require('../models/User');
const Friendship = require('../models/Friendship');
const Workout    = require('../models/Workout');
const StreakGroup = require('../models/StreakGroup');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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

async function makeFriends(a, b) {
  return Friendship.create({ requester: a, recipient: b, status: 'accepted' });
}

async function finishedWorkoutToday(userId) {
  return Workout.create({
    user:   userId,
    name:   'Séance test',
    status: 'finished',
    date:   new Date(),
    durationSeconds: 3600,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite : Moteur MMO-RPG social — Briques II / III / IV
// ─────────────────────────────────────────────────────────────────────────────

describe('Moteur RPG & Social Athly — Briques II, III, IV', () => {
  let alice, bob, carol;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}), Friendship.deleteMany({}),
      Workout.deleteMany({}), StreakGroup.deleteMany({}),
    ]);
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}), Friendship.deleteMany({}),
      Workout.deleteMany({}), StreakGroup.deleteMany({}),
    ]);
    alice = await createAndLoginUser('AliceFit',  'alice@athly.fr');
    bob   = await createAndLoginUser('BobMuscle', 'bob@athly.fr');
    carol = await createAndLoginUser('CarolGains','carol@athly.fr');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Recherche d'utilisateurs
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/friends/search — searchUsers', () => {

    it('✅ Trouve les pseudos correspondants avec le statut de relation', async () => {
      await makeFriends(alice.userId, bob.userId);

      const res = await request(app)
        .get('/api/friends/search?q=bob')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.results[0].user.pseudo).toBe('BobMuscle');
      expect(res.body.results[0].relationStatus).toBe('accepted');
    });

    it("✅ relationStatus pending_sent/received selon le sens de la demande", async () => {
      await Friendship.create({ requester: alice.userId, recipient: carol.userId, status: 'pending' });

      const fromAlice = await request(app)
        .get('/api/friends/search?q=carol')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(fromAlice.body.results[0].relationStatus).toBe('pending_sent');

      const fromCarol = await request(app)
        .get('/api/friends/search?q=alice')
        .set('Authorization', `Bearer ${carol.token}`);
      expect(fromCarol.body.results[0].relationStatus).toBe('pending_received');
    });

    it('✅ Ne se trouve jamais soi-même dans les résultats', async () => {
      const res = await request(app)
        .get('/api/friends/search?q=alice')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.body.results.every((r) => r.user.pseudo !== 'AliceFit')).toBe(true);
    });

    it('❌ 400 si la recherche fait moins de 2 caractères', async () => {
      const res = await request(app)
        .get('/api/friends/search?q=a')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(400);
    });

    it('🔒 Les caractères regex sont neutralisés (pas d\'injection de pattern)', async () => {
      const res = await request(app)
        .get('/api/friends/search?q=' + encodeURIComponent('.*'))
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0); // ".*" littéral ne matche aucun pseudo
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Profil public d'un ami
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/friends/profile/:friendId — getFriendProfile', () => {

    it('✅ Renvoie le profil complet pour un ami accepté', async () => {
      await makeFriends(alice.userId, bob.userId);
      await User.updateOne({ _id: bob.userId }, { level: 15, xp: 15000, rank: 'Initié' });

      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.profile.user.pseudo).toBe('BobMuscle');
      expect(res.body.profile.user.level).toBe(15);
      expect(res.body.profile.friendshipLevel).toBe(1);
      expect(res.body.profile.user.password).toBeUndefined();
      expect(res.body.profile.user.email).toBeUndefined();
    });

    it("❌ 403 si la relation n'est pas acceptée (aucune fuite entre inconnus)", async () => {
      const res = await request(app)
        .get(`/api/friends/profile/${bob.userId}`)
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Classement dynamique
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/friends/leaderboard — getLeaderboard', () => {

    it('✅ Classe moi + mes amis par XP décroissant avec positions', async () => {
      await makeFriends(alice.userId, bob.userId);
      await makeFriends(alice.userId, carol.userId);
      await User.updateOne({ _id: alice.userId }, { xp: 500 });
      await User.updateOne({ _id: bob.userId },   { xp: 2000 });
      await User.updateOne({ _id: carol.userId }, { xp: 1000 });

      const res = await request(app)
        .get('/api/friends/leaderboard')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(3);
      expect(res.body.leaderboard[0].user.pseudo).toBe('BobMuscle');
      expect(res.body.leaderboard[0].position).toBe(1);
      expect(res.body.leaderboard[2].user.pseudo).toBe('AliceFit');
      expect(res.body.leaderboard[2].isMe).toBe(true);
    });

    it("✅ Le classement n'inclut pas les non-amis", async () => {
      await makeFriends(alice.userId, bob.userId);
      // carol n'est pas amie avec alice

      const res = await request(app)
        .get('/api/friends/leaderboard')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.count).toBe(2);
      expect(res.body.leaderboard.every((e) => e.user.pseudo !== 'CarolGains')).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Coffres à l'effort (minutes de séance cumulées)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Pipeline minutes → CHEST_KEY (finalizeWorkout)', () => {

    async function finalizeWorkoutOf(user, durationSeconds) {
      const draft = await Workout.create({
        user: user.userId, name: 'Séance', status: 'in_progress', date: new Date(),
      });
      return request(app)
        .post(`/api/workouts/${draft._id}/finalize`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ durationSeconds });
    }

    it('✅ Franchir un palier de 300 min au niveau 11+ attribue une CHEST_KEY', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { level: 11, xp: 2000, totalWorkoutMinutes: 290 },
      );

      const res = await finalizeWorkoutOf(alice, 1200); // +20 min → 310 total
      expect(res.statusCode).toBe(200);
      expect(res.body.stats.chestsAwarded).toBe(1);

      const user = await User.findById(alice.userId);
      expect(user.totalWorkoutMinutes).toBe(310);
      const key = user.inventory.find((i) => i.itemType === 'CHEST_KEY');
      expect(key).toBeDefined();
      expect(key.quantity).toBe(1);
    });

    it('🔒 Sous le niveau 11 : les minutes s\'accumulent mais AUCUN coffre ne drop', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { level: 5, xp: 500, totalWorkoutMinutes: 290 },
      );

      const res = await finalizeWorkoutOf(alice, 1200);
      expect(res.statusCode).toBe(200);
      expect(res.body.stats.chestsAwarded).toBe(0);

      const user = await User.findById(alice.userId);
      expect(user.totalWorkoutMinutes).toBe(310);
      expect(user.inventory.find((i) => i.itemType === 'CHEST_KEY')).toBeUndefined();
    });

    it('✅ Aucun palier franchi → aucun coffre', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { level: 11, xp: 2000, totalWorkoutMinutes: 10 },
      );

      const res = await finalizeWorkoutOf(alice, 1200);
      expect(res.body.stats.chestsAwarded).toBe(0);
    });

    it('🔒 Une séance courte (< 300 s) n\'alimente pas le compteur (anti-cheat)', async () => {
      await User.updateOne(
        { _id: alice.userId },
        { level: 11, xp: 2000, totalWorkoutMinutes: 299 },
      );

      const res = await finalizeWorkoutOf(alice, 120);
      expect(res.statusCode).toBe(200);
      expect(res.body.stats.chestsAwarded).toBe(0);

      const user = await User.findById(alice.userId);
      expect(user.totalWorkoutMinutes).toBe(299);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Streak de groupe : bonus XP multiplié par la taille
  // ───────────────────────────────────────────────────────────────────────────
  describe('Streak de groupe — bonus XP et niveau d\'amitié', () => {

    async function createValidatedGroup(members) {
      const group = await StreakGroup.create({
        name:    'Team Test',
        members: members.map((m) => m.userId),
        pendingInvites: [],
      });
      await Promise.all(members.map((m) => finishedWorkoutToday(m.userId)));
      return group;
    }

    it('✅ Validation 100% : streak +1, bonus XP multiplié par la taille du groupe', async () => {
      await makeFriends(alice.userId, bob.userId);
      const group = await createValidatedGroup([alice, bob]);

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.allValidated).toBe(true);
      expect(res.body.currentStreak).toBe(1);
      // 2 membres → multiplicateur x1.35 → 50 * 1.35 = 68 XP
      expect(res.body.groupBonus.multiplier).toBeCloseTo(1.35);
      expect(res.body.groupBonus.bonusXp).toBe(68);

      const aliceDb = await User.findById(alice.userId);
      const bobDb   = await User.findById(bob.userId);
      expect(aliceDb.xp).toBe(68);
      expect(bobDb.xp).toBe(68);
    });

    it('✅ Un membre manquant → pas de streak, pas de bonus', async () => {
      await makeFriends(alice.userId, bob.userId);
      const group = await StreakGroup.create({
        name: 'Team Test',
        members: [alice.userId, bob.userId], pendingInvites: [],
      });
      await finishedWorkoutToday(alice.userId); // bob n'a rien fait

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.body.allValidated).toBe(false);
      expect(res.body.pendingMembers).toContain(bob.userId);

      const aliceDb = await User.findById(alice.userId);
      expect(aliceDb.xp).toBe(0);
    });

    it('🏆 Passage au niveau d\'amitié 5 : cadre Unique injecté chez les DEUX amis + trophée', async () => {
      // Amitié à 1499 XP (juste sous le seuil de 1500 du niveau 5)
      await Friendship.create({
        requester: alice.userId, recipient: bob.userId,
        status: 'accepted', friendshipXp: 1499, friendshipLevel: 4,
      });
      const group = await createValidatedGroup([alice, bob]);

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.allValidated).toBe(true);

      const friendship = await Friendship.findOne({ requester: alice.userId });
      expect(friendship.friendshipLevel).toBe(5);

      for (const u of [alice, bob]) {
        const doc = await User.findById(u.userId);
        const frame = doc.inventory.find((i) => i.itemType === 'PROFILE_FRAME_BLOOD_BOND');
        expect(frame).toBeDefined();
        expect(frame.rarity).toBe('unique');
        expect(frame.quantity).toBe(1);

        const trophy = doc.achievements.find((a) => a.achievementId === 'FRIENDSHIP_LEVEL_5');
        expect(trophy).toBeDefined();
      }
    });

    it('🔒 Le cadre Unique n\'est jamais dupliqué (idempotence)', async () => {
      await Friendship.create({
        requester: alice.userId, recipient: bob.userId,
        status: 'accepted', friendshipXp: 2000, friendshipLevel: 5,
      });
      await User.updateOne(
        { _id: alice.userId },
        { inventory: [{ itemType: 'PROFILE_FRAME_BLOOD_BOND', rarity: 'unique', quantity: 1 }] },
      );
      const group = await createValidatedGroup([alice, bob]);

      await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      const doc = await User.findById(alice.userId);
      const frames = doc.inventory.filter((i) => i.itemType === 'PROFILE_FRAME_BLOOD_BOND');
      expect(frames).toHaveLength(1);
      expect(frames[0].quantity).toBe(1);
    });

    it("✅ getMyGroup expose les invitations reçues (pendingInvites) à l'invité", async () => {
      await StreakGroup.create({
        name: 'Team Recrutement',
        members: [bob.userId],
        pendingInvites: [alice.userId],
      });

      const res = await request(app)
        .get('/api/groups/my-group')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.group).toBeNull();
      expect(res.body.invites).toHaveLength(1);
      expect(res.body.invites[0].name).toBe('Team Recrutement');
    });

    it('🎯 getMyGroup expose le multiplicateur courant (taille + régularité)', async () => {
      const group = await createValidatedGroup([alice, bob]);
      await StreakGroup.updateOne({ _id: group._id }, { currentStreak: 14 }); // 2 semaines pile

      const res = await request(app)
        .get('/api/groups/my-group')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      // 2 membres → x1.35 taille ; 14j = 2 semaines → +16% régularité → x1.16
      expect(res.body.group.xpBonus.sizeMultiplier).toBeCloseTo(1.35);
      expect(res.body.group.xpBonus.regularityMultiplier).toBeCloseTo(1.16);
      expect(res.body.group.xpBonus.multiplier).toBeCloseTo(1.57);
    });

    it('🎯 Le bonus de régularité est plafonné à +60% même après 70+ jours', async () => {
      await makeFriends(alice.userId, bob.userId);
      const group = await createValidatedGroup([alice, bob]);
      await StreakGroup.updateOne({ _id: group._id }, { currentStreak: 200 });

      const res = await request(app)
        .post(`/api/groups/${group._id}/check-streak`)
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      // currentStreak devient 201 → floor(201/7)=28 semaines, plafonné à +60%
      expect(res.body.groupBonus.regularityMultiplier).toBeCloseTo(1.6);
      expect(res.body.groupBonus.multiplier).toBeCloseTo(1.35 * 1.6);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. leaveGroup — quitter le groupe de streak
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/groups/leave — leaveGroup', () => {

    it('✅ Un membre quitte : le groupe persiste pour les autres', async () => {
      const group = await StreakGroup.create({
        name: 'Team Test',
        members: [alice.userId, bob.userId, carol.userId],
        pendingInvites: [],
      });

      const res = await request(app)
        .post('/api/groups/leave')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.groupDeleted).toBe(false);

      const updated = await StreakGroup.findById(group._id);
      expect(updated.members.map(String)).not.toContain(alice.userId);
      expect(updated.members).toHaveLength(2);
    });

    it('✅ Le dernier membre quitte : le groupe est dissous', async () => {
      const group = await StreakGroup.create({
        name: 'Solo', members: [alice.userId], pendingInvites: [],
      });

      const res = await request(app)
        .post('/api/groups/leave')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.groupDeleted).toBe(true);

      const deleted = await StreakGroup.findById(group._id);
      expect(deleted).toBeNull();
    });

    it('✅ Après avoir quitté, l\'utilisateur peut rejoindre/créer un nouveau groupe', async () => {
      await StreakGroup.create({
        name: 'Ancien groupe', members: [alice.userId, bob.userId], pendingInvites: [],
      });
      await request(app)
        .post('/api/groups/leave')
        .set('Authorization', `Bearer ${alice.token}`);

      await makeFriends(alice.userId, carol.userId);
      const res = await request(app)
        .post('/api/groups/invite')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ friendIds: [carol.userId], name: 'Nouveau groupe' });

      expect(res.statusCode).toBe(201);
    });

    it('❌ 404 si l\'utilisateur ne fait partie d\'aucun groupe', async () => {
      const res = await request(app)
        .post('/api/groups/leave')
        .set('Authorization', `Bearer ${alice.token}`);
      expect(res.statusCode).toBe(404);
    });

    it('❌ 401 sans token', async () => {
      const res = await request(app).post('/api/groups/leave');
      expect(res.statusCode).toBe(401);
    });
  });
});
