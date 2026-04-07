const express = require('express');
const router = express.Router();
const { getHotels, getRestaurants, getHotelById, getRestaurantById } = require('../controllers/placesToStayController');
const { auth } = require('../middleware/auth');

router.get('/hotels', auth, getHotels);
router.get('/restaurants', auth, getRestaurants);
router.get('/hotels/:id', auth, getHotelById);
router.get('/restaurants/:id', auth, getRestaurantById);

module.exports = router;
