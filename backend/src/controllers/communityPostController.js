const CommunityPost = require('../models/CommunityPost');

exports.getCommunityPosts = async (req, res) => {
  try {
    const query = req.user?.role === 'admin' ? {} : { status: 'approved' };
    const posts = await CommunityPost.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMyCommunityPosts = async (req, res) => {
  try {
    const posts = await CommunityPost.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createCommunityPost = async (req, res) => {
  try {
    const { placeName, category, rating, review } = req.body;
    if (!placeName || !review || !rating) {
      return res.status(400).json({ message: 'Place, rating and review are required.' });
    }

    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    const images = (req.files || []).map((f) => `/uploads/places/${f.filename}`);

    const post = await CommunityPost.create({
      user: req.user._id,
      authorName: req.user.name || 'Traveler',
      placeName,
      category: category === 'hotel' ? 'hotel' : 'place',
      rating: numericRating,
      review,
      images,
      status: req.user.role === 'admin' ? 'approved' : 'pending',
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.approveCommunityPost = async (req, res) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.rejectCommunityPost = async (req, res) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteCommunityPost = async (req, res) => {
  try {
    const post = await CommunityPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
