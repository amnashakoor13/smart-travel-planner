import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import './PlacesToStay.css';

const PlacesToStay = () => {
  const [searchParams] = useSearchParams();
  const destinationId = searchParams.get('destination');
  const hotelIdParam = searchParams.get('hotel');
  const [activeTab, setActiveTab] = useState('hotels');
  const [hotels, setHotels] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [sortBy, setSortBy] = useState('rating');

  const fetchData = async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const [hotelsRes, restaurantsRes, destRes] = await Promise.all([
        api.get('/places-to-stay/hotels', { params: { destination: destinationId || undefined, sortBy } }),
        api.get('/places-to-stay/restaurants', { params: { destination: destinationId || undefined, sortBy } }),
        api.get('/travel-hub')
      ]);
      setHotels(hotelsRes.data || []);
      setRestaurants(restaurantsRes.data || []);
      setDestinations(destRes.data || []);
    } catch (err) {
      console.error(err);
      setFetchError(err.response?.data?.message || 'Could not load places. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [destinationId, sortBy]);

  useEffect(() => {
    if (hotelIdParam && hotels.length > 0) {
      const found = hotels.find((h) => h._id === hotelIdParam);
      if (found) setSelectedHotel(found);
    }
  }, [hotelIdParam, hotels]);

  const handleHotelClick = (hotel) => {
    setSelectedHotel(hotel);
    setSelectedRestaurant(null);
  };

  const handleRestaurantClick = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectedHotel(null);
  };

  const currentDestination = destinationId && destinations.length ? destinations.find((d) => d._id === destinationId) : null;

  if (selectedHotel) {
    const h = selectedHotel;
    return (
      <div className="places-to-stay">
        <div className="content">
          <div className="header">
            <button type="button" className="back-btn" onClick={() => setSelectedHotel(null)}>
              Back to Hotels
            </button>
            <h1>Places to Stay</h1>
          </div>
          <div className="section detail-view">
            <h2>{h.name}</h2>
            {h.destination?.name && <p className="description">📍 {h.destination.name}</p>}
            {h.rating != null && <p>⭐ Rating: {h.rating}</p>}
            {h.description && <p className="description">{h.description}</p>}
            {h.address && <p>Address: {h.address}</p>}
            {h.contactNumber && <p>Contact: {h.contactNumber}</p>}
            {h.email && <p>Email: {h.email}</p>}
            {h.bookingLink && (
              <a href={h.bookingLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Book Now
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedRestaurant) {
    const r = selectedRestaurant;
    return (
      <div className="places-to-stay">
        <div className="content">
          <div className="header">
            <button type="button" className="back-btn" onClick={() => setSelectedRestaurant(null)}>
              Back to Restaurants
            </button>
            <h1>Places to Stay</h1>
          </div>
          <div className="section detail-view">
            <h2>{r.name}</h2>
            {r.destination?.name && <p className="description">📍 {r.destination.name}</p>}
            {r.rating != null && <p>⭐ Rating: {r.rating}</p>}
            {r.description && <p className="description">{r.description}</p>}
            {r.address && <p>Address: {r.address}</p>}
            {r.cuisine && <p>Cuisine: {Array.isArray(r.cuisine) ? r.cuisine.join(', ') : r.cuisine}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="places-to-stay">
      <div className="content">
        <div className="header">
          <h1>Places to Stay</h1>
        </div>
        {fetchError && (
          <div className="page-error-banner">
            <span>{fetchError}</span>
            <button type="button" onClick={() => fetchData()}>Retry</button>
          </div>
        )}

        <div className="section">
          <div className="section-header-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'hotels' ? 'active' : ''}`}
              onClick={() => setActiveTab('hotels')}
            >
              🏨 Hotels
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'restaurants' ? 'active' : ''}`}
              onClick={() => setActiveTab('restaurants')}
            >
              🍽️ Restaurants
            </button>
          </div>
          <div className="section-toolbar">
            <label>
              Sort:{' '}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                <option value="rating">Rating</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p className="loading-msg">Loading...</p>
          ) : activeTab === 'hotels' ? (
            <>
              {currentDestination && <p className="filter-note">Showing hotels for {currentDestination.name}</p>}
              {hotels.length === 0 ? (
                <p className="empty-msg">No hotels found. Try another destination or add content in Admin.</p>
              ) : (
                <div className="items-grid">
                  {hotels.map((hotel) => (
                    <div
                      key={hotel._id}
                      className="item-card"
                      onClick={() => handleHotelClick(hotel)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHotelClick(hotel)}
                      role="button"
                      tabIndex={0}
                    >
                      <h3>{hotel.name}</h3>
                      {hotel.destination?.name && <p>📍 {hotel.destination.name}</p>}
                      {hotel.rating != null && <p>⭐ {hotel.rating}</p>}
                      {hotel.description && <p className="description">{hotel.description.slice(0, 80)}...</p>}
                      <span className="view-details">View details</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {currentDestination && <p className="filter-note">Showing restaurants for {currentDestination.name}</p>}
              {restaurants.length === 0 ? (
                <p className="empty-msg">No restaurants found. Try another destination or add content in Admin.</p>
              ) : (
                <div className="items-grid">
                  {restaurants.map((restaurant) => (
                    <div
                      key={restaurant._id}
                      className="item-card"
                      onClick={() => handleRestaurantClick(restaurant)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRestaurantClick(restaurant)}
                      role="button"
                      tabIndex={0}
                    >
                      <h3>{restaurant.name}</h3>
                      {restaurant.destination?.name && <p>📍 {restaurant.destination.name}</p>}
                      {restaurant.rating != null && <p>⭐ {restaurant.rating}</p>}
                      {restaurant.cuisine && (
                        <div className="cuisine-preview">
                          {(Array.isArray(restaurant.cuisine) ? restaurant.cuisine : [restaurant.cuisine]).slice(0, 3).map((c) => (
                            <span key={c} className="cuisine-tag-small">{c}</span>
                          ))}
                        </div>
                      )}
                      <span className="view-details">View details</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlacesToStay;
