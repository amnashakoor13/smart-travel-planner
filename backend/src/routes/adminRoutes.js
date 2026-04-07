const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getUsers,
  toggleUserStatus,
  getAllDestinations,
  getDestinationById,
  createDestination,
  updateDestination,
  deleteDestination,
  getAllHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getBudgetRules,
  createBudgetRule,
  updateBudgetRule,
  deleteBudgetRule,
  getAnalytics,
  fetchHotelsFromGoogle,
  autoFetchLocationsAndHotels,
  getApiKeys,
  getApiKeyById,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  uploadPlaceImages
} = require('../controllers/adminController');

router.post('/upload-images', adminAuth, (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Image upload failed.' });
    }
    next();
  });
}, uploadPlaceImages);
router.get('/users', adminAuth, getUsers);
router.patch('/users/:id/toggle', adminAuth, toggleUserStatus);
router.get('/destinations', adminAuth, getAllDestinations);
router.get('/destinations/:id', adminAuth, getDestinationById);
router.post('/destinations', adminAuth, createDestination);
router.put('/destinations/:id', adminAuth, updateDestination);
router.delete('/destinations/:id', adminAuth, deleteDestination);
router.get('/hotels', adminAuth, getAllHotels);
router.get('/hotels/:id', adminAuth, getHotelById);
router.post('/hotels', adminAuth, createHotel);
router.put('/hotels/:id', adminAuth, updateHotel);
router.delete('/hotels/:id', adminAuth, deleteHotel);
router.get('/restaurants', adminAuth, getAllRestaurants);
router.get('/restaurants/:id', adminAuth, getRestaurantById);
router.post('/restaurants', adminAuth, createRestaurant);
router.put('/restaurants/:id', adminAuth, updateRestaurant);
router.delete('/restaurants/:id', adminAuth, deleteRestaurant);
router.get('/budget-rules', adminAuth, getBudgetRules);
router.post('/budget-rules', adminAuth, createBudgetRule);
router.put('/budget-rules/:id', adminAuth, updateBudgetRule);
router.delete('/budget-rules/:id', adminAuth, deleteBudgetRule);
router.get('/analytics', adminAuth, getAnalytics);
router.post('/fetch-hotels-from-google', adminAuth, fetchHotelsFromGoogle);
router.post('/auto-fetch-locations-hotels', adminAuth, autoFetchLocationsAndHotels);
router.get('/api-keys', adminAuth, getApiKeys);
router.get('/api-keys/:id', adminAuth, getApiKeyById);
router.post('/api-keys', adminAuth, createApiKey);
router.put('/api-keys/:id', adminAuth, updateApiKey);
router.delete('/api-keys/:id', adminAuth, deleteApiKey);

module.exports = router;
