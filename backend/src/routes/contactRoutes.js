const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const {
  createContactMessage,
  getAllContactMessages,
  updateContactMessageStatus
} = require('../controllers/contactController');

router.post('/', auth, createContactMessage);
router.get('/admin/messages', adminAuth, getAllContactMessages);
router.patch('/admin/messages/:id', adminAuth, updateContactMessageStatus);

module.exports = router;
