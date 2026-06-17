'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth.middleware');
const referral = require('../controllers/referral.controller');

router.use(auth);

router.post('/claim', referral.claimReferral);

module.exports = router;
