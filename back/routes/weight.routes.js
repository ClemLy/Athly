'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const weight   = require('../controllers/weight.controller');
const { logWeight } = require('../validators/weight.validator');

router.use(auth);

router.get('/history', weight.getWeightHistory);
router.post('/',       validate(logWeight), weight.logWeight);

module.exports = router;
