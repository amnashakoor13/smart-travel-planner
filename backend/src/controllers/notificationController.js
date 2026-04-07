const User = require('../models/User');
const CommunityPost = require('../models/CommunityPost');
const ContactMessage = require('../models/ContactMessage');
const Destination = require('../models/Destination');
const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const toIso = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

exports.getNotifications = async (req, res) => {
  try {
    const items = [];
    const userRecord = await User.findById(req.user._id).select('preferences').lean();
    const lastSeenRaw = userRecord?.preferences?.notificationLastSeenAt;
    const lastSeenAt = lastSeenRaw ? new Date(lastSeenRaw) : null;

    const [recentDestinations, recentHotels, recentRestaurants] = await Promise.all([
      Destination.countDocuments({ createdAt: { $gte: hoursAgo(24) } }),
      Hotel.countDocuments({ createdAt: { $gte: hoursAgo(24) } }),
      Restaurant.countDocuments({ createdAt: { $gte: hoursAgo(24) } })
    ]);

    if (req.user.role === 'admin') {
      const [pendingReviews, approvedToday, rejectedToday, newUsers, newContactMessages] = await Promise.all([
        CommunityPost.countDocuments({ status: 'pending' }),
        CommunityPost.countDocuments({ status: 'approved', updatedAt: { $gte: hoursAgo(24) } }),
        CommunityPost.countDocuments({ status: 'rejected', updatedAt: { $gte: hoursAgo(24) } }),
        User.countDocuments({ createdAt: { $gte: hoursAgo(24) } }),
        ContactMessage.countDocuments({ status: 'new' })
      ]);

      if (pendingReviews > 0) {
        const latestPending = await CommunityPost.findOne({ status: 'pending' }).sort({ updatedAt: -1 }).select('updatedAt').lean();
        items.push({
          id: 'pending-reviews',
          type: 'warning',
          text: `${pendingReviews} review(s) pending for approval.`,
          link: '/app/community-blog',
          createdAt: toIso(latestPending?.updatedAt || new Date())
        });
      }
      if (newUsers > 0) {
        const latestUser = await User.findOne({ createdAt: { $gte: hoursAgo(24) } }).sort({ createdAt: -1 }).select('createdAt').lean();
        items.push({
          id: 'new-users',
          type: 'success',
          text: `${newUsers} new user(s) registered in last 24 hours.`,
          link: '/app/admin',
          createdAt: toIso(latestUser?.createdAt || new Date())
        });
      }
      if (newContactMessages > 0) {
        const latestContact = await ContactMessage.findOne({ status: 'new' }).sort({ createdAt: -1 }).select('createdAt').lean();
        items.push({
          id: 'new-contact',
          type: 'info',
          text: `${newContactMessages} new contact/email/WhatsApp message(s) received.`,
          link: '/app/admin',
          createdAt: toIso(latestContact?.createdAt || new Date())
        });
      }
      if (approvedToday > 0 || rejectedToday > 0) {
        const latestModerated = await CommunityPost.findOne({
          status: { $in: ['approved', 'rejected'] },
          updatedAt: { $gte: hoursAgo(24) }
        }).sort({ updatedAt: -1 }).select('updatedAt').lean();
        items.push({
          id: 'moderation-summary',
          type: 'info',
          text: `Today moderation: ${approvedToday} approved, ${rejectedToday} rejected reviews.`,
          link: '/app/community-blog',
          createdAt: toIso(latestModerated?.updatedAt || new Date())
        });
      }
    } else {
      const myReviewUpdates = await CommunityPost.find({
        user: req.user._id,
        status: { $in: ['approved', 'rejected'] }
      })
        .sort({ updatedAt: -1 })
        .limit(12)
        .select('placeName status updatedAt')
        .lean();

      myReviewUpdates.forEach((post) => {
        items.push({
          id: `review-${post._id}-${post.status}`,
          type: post.status === 'approved' ? 'success' : 'error',
          text:
            post.status === 'approved'
              ? `Your review for "${post.placeName}" was approved.`
              : `Your review for "${post.placeName}" was rejected.`,
          link: '/app/community-blog',
          createdAt: toIso(post.updatedAt)
        });
      });

      const resolvedMessages = await ContactMessage.countDocuments({
        userId: req.user._id,
        status: 'resolved',
        updatedAt: { $gte: daysAgo(30) }
      });

      if (resolvedMessages > 0) {
        const latestResolved = await ContactMessage.findOne({
          userId: req.user._id,
          status: 'resolved',
          updatedAt: { $gte: daysAgo(30) }
        }).sort({ updatedAt: -1 }).select('updatedAt').lean();
        items.push({
          id: `reply-${req.user._id}`,
          type: 'info',
          text: `${resolvedMessages} support reply/replies received on your messages.`,
          link: '/app/contact-us',
          createdAt: toIso(latestResolved?.updatedAt || new Date())
        });
      }

      if (myReviewUpdates.length === 0) {
        const reviewedToday = await CommunityPost.countDocuments({
          status: { $in: ['approved', 'rejected'] },
          updatedAt: { $gte: hoursAgo(24) }
        });
        if (reviewedToday > 0) {
          const latestAnyModerated = await CommunityPost.findOne({
            status: { $in: ['approved', 'rejected'] },
            updatedAt: { $gte: hoursAgo(24) }
          }).sort({ updatedAt: -1 }).select('updatedAt').lean();
          items.push({
            id: 'community-moderation',
            type: 'info',
            text: `${reviewedToday} community review(s) were moderated today.`,
            link: '/app/community-blog',
            createdAt: toIso(latestAnyModerated?.updatedAt || new Date())
          });
        }
      }
    }

    if (recentDestinations > 0) {
      const latestDestination = await Destination.findOne({ createdAt: { $gte: hoursAgo(24) } }).sort({ createdAt: -1 }).select('createdAt').lean();
      items.push({
        id: 'destinations',
        type: 'info',
        text: `${recentDestinations} new place(s) added recently.`,
        link: '/app/travel-hub',
        createdAt: toIso(latestDestination?.createdAt || new Date())
      });
    }
    if (recentHotels > 0) {
      const latestHotel = await Hotel.findOne({ createdAt: { $gte: hoursAgo(24) } }).sort({ createdAt: -1 }).select('createdAt').lean();
      items.push({
        id: 'hotels',
        type: 'info',
        text: `${recentHotels} new hotel(s) added recently.`,
        link: '/app/places-to-stay',
        createdAt: toIso(latestHotel?.createdAt || new Date())
      });
    }
    if (recentRestaurants > 0) {
      const latestRestaurant = await Restaurant.findOne({ createdAt: { $gte: hoursAgo(24) } }).sort({ createdAt: -1 }).select('createdAt').lean();
      items.push({
        id: 'restaurants',
        type: 'info',
        text: `${recentRestaurants} new restaurant(s) added recently.`,
        link: '/app/places-to-stay',
        createdAt: toIso(latestRestaurant?.createdAt || new Date())
      });
    }

    const finalItems = items
      .map((item) => {
        const createdAt = new Date(item.createdAt);
        const read = lastSeenAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.getTime() <= lastSeenAt.getTime()
          : false;
        return { ...item, read };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    res.json({
      unreadCount: finalItems.filter((x) => !x.read).length,
      items: finalItems
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.preferences.set('notificationLastSeenAt', new Date().toISOString());
    await user.save();
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

