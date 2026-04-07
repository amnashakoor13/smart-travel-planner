const express = require('express');
const { auth } = require('../middleware/auth');
const { getNotifications, markNotificationsRead } = require('../controllers/notificationController');

const router = express.Router();

router.get('/', auth, getNotifications);
router.patch('/read', auth, markNotificationsRead);

module.exports = router;

