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

module.exports = router;
