'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth.middleware');
const devOnly = require('../middleware/devOnly.middleware');
const debug   = require('../controllers/debug.controller');

// devOnly AVANT auth : en production, la route 404 sans même vérifier le token.
router.use(devOnly);
router.use(auth);

router.post('/sync-level',            debug.syncLevel);

// ── God Mode : sandbox de test (voir controllers/debug.controller.js) ────────
router.post('/godmode/give-chests',             debug.giveChests);
router.post('/godmode/give-all-items',          debug.giveAllItems);
router.post('/godmode/simulate-chests-opened',  debug.simulateChestsOpened);
router.post('/godmode/simulate-referral',       debug.simulateReferral);
router.post('/godmode/simulate-birthday',       debug.simulateBirthday);
router.post('/godmode/mock-social',             debug.mockSocial);

// ── God Mode : Vague 1 (groupe, météo, activité, Hall of Shame, secouer) ────
router.post('/godmode/simulate-group',          debug.simulateGroup);
router.post('/godmode/simulate-activity-event', debug.simulateActivityEvent);
router.post('/godmode/simulate-streak-break',   debug.simulateStreakBreak);
router.post('/godmode/simulate-shake-self',     debug.simulateShakeSelf);

// ── God Mode : Vague 2 (tag Discord, ajout d'ami) ────────────────────────────
router.post('/godmode/simulate-searchable-friend', debug.simulateSearchableFriend);

// ── God Mode : Vague 3 (Lobby Multi) ─────────────────────────────────────────
router.post('/godmode/simulate-lobby-invite',   debug.simulateLobbyInvite);

// ── God Mode : Titres (Section X) ────────────────────────────────────────────
router.post('/godmode/give-all-titles',         debug.giveAllTitles);

module.exports = router;
