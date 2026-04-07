const express = require('express');
const router = express.Router();
const { calculateBudget, saveBudget } = require('../controllers/moneyMapController');
const { auth } = require('../middleware/auth');

router.post('/calculate', auth, calculateBudget);
router.post('/save', auth, saveBudget);

module.exports = router;
