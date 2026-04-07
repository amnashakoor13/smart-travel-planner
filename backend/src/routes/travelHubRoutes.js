const express = require('express');
const router = express.Router();
const { 
  getAllDestinations, 
  getDestinationById, 
  createDestination, 
  getWeather, 
  getPlacesToVisit, 
  getDestinationsByCategory 
} = require('../controllers/travelHubController');
const { auth } = require('../middleware/auth');

// Public GET routes (no auth required) so Travel Hub can load destinations for all users
router.get('/', getAllDestinations);
router.get('/category/:category', getDestinationsByCategory);
router.get('/weather', getWeather);
router.get('/places-to-visit', getPlacesToVisit);
router.get('/:id', getDestinationById);

// Keep create protected (only authenticated users / admin can add destinations)
router.post('/', auth, createDestination);

module.exports = router;
