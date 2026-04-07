const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getCommunityPosts,
  getMyCommunityPosts,
  createCommunityPost,
  approveCommunityPost,
  rejectCommunityPost,
  deleteCommunityPost,
} = require('../controllers/communityPostController');

router.get('/', auth, getCommunityPosts);
router.get('/mine', auth, getMyCommunityPosts);
router.post('/', auth, upload.array('images', 6), createCommunityPost);
router.patch('/:id/approve', adminAuth, approveCommunityPost);
router.patch('/:id/reject', adminAuth, rejectCommunityPost);
router.delete('/:id', adminAuth, deleteCommunityPost);

module.exports = router;
