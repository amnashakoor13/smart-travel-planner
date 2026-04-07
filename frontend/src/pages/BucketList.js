import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './BucketList.css';

const BucketList = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('destinations');
  const [destinations, setDestinations] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [tripPlans, setTripPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch bucket list destinations
      const bucketResponse = await api.get('/travel-fund/bucket-list');
      const bucketItems = bucketResponse.data || [];
      
      // Fetch destination details for bucket list items
      const destinationsWithDetails = await Promise.all(
        bucketItems.map(async (item) => {
          try {
            const destResponse = await api.get(`/travel-hub?search=${encodeURIComponent(item.destination)}`);
            if (destResponse.data && destResponse.data.length > 0) {
              const destDetails = Array.isArray(destResponse.data) ? destResponse.data[0] : destResponse.data;
              return {
                ...item,
                description: destDetails.description,
                location: `${destDetails.city || ''}, ${destDetails.country || 'Pakistan'}`.trim(),
                tags: destDetails.famousFor || (destDetails.category ? [destDetails.category] : ['Mountains', 'Lakes', 'Cultural']),
                rating: destDetails.rating || 4.5,
                isPopular: destDetails.isPopular || false
              };
            }
          } catch (err) {
            console.log(`Could not fetch details for ${item.destination}`);
          }
          return {
            ...item,
            description: 'Beautiful destination waiting to be explored.',
            location: `${item.destination}, Pakistan`,
            tags: ['Mountains', 'Lakes', 'Cultural'],
            rating: 4.5,
            isPopular: false
          };
        })
      );
      
      setDestinations(destinationsWithDetails);
      
      // Fetch saved accommodations (hotels) - for now use all hotels, can add saved feature later
      try {
        const hotelsResponse = await api.get('/places-to-stay/hotels');
        setAccommodations((hotelsResponse.data || []).slice(0, 10)); // Limit to 10 for now
      } catch (err) {
        console.log('No accommodations available');
        setAccommodations([]);
      }
      
      // Fetch trip plans (budgets that are not bucket list)
      try {
        const budgetsResponse = await api.get('/travel-fund');
        const plans = (budgetsResponse.data || []).filter(b => !b.isBucketList);
        setTripPlans(plans);
      } catch (err) {
        console.log('No trip plans');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setFetchError(error.response?.data?.message || 'Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (window.confirm(`Remove this ${type === 'destination' ? 'destination' : type === 'accommodation' ? 'accommodation' : 'trip plan'} from your saved items?`)) {
      try {
        if (type === 'destination') {
          await api.delete(`/travel-fund/${id}`);
        } else if (type === 'accommodation') {
          setAccommodations(prev => prev.filter(a => a._id !== id));
          return;
        } else {
          await api.delete(`/travel-fund/${id}`);
        }
        fetchData();
      } catch (error) {
        console.error('Error deleting:', error);
        setFetchError(error.response?.data?.message || 'Failed to remove. Please try again.');
      }
    }
  };

  const handleExplore = (destinationName) => {
    navigate(`/app/travel-hub?search=${encodeURIComponent(destinationName)}`);
  };

  const handlePlanTrip = (destination) => {
    navigate(`/app/money-map?destination=${encodeURIComponent(destination)}`);
  };

  const handleViewDetails = (item, type) => {
    if (type === 'destination') {
      navigate(`/app/travel-hub?search=${encodeURIComponent(item.destination)}`);
    } else if (type === 'accommodation') {
      navigate(`/app/places-to-stay?hotel=${item._id}`);
    } else {
      navigate(`/app/money-map?trip=${item._id}`);
    }
  };

  const renderDestinationCard = (item) => {
    // Try to get destination details
    const destinationName = item.destination;
    const price = item.total ? `From PKR ${item.total.toLocaleString()}` : 'Price on request';
    const rating = item.rating || 4.5;
    const tags = item.tags || ['Mountains', 'Lakes', 'Cultural'];
    const description = item.description || 'Beautiful destination waiting to be explored.';
    const location = item.location || `${destinationName}, Pakistan`;
    const isPopular = item.isPopular || false;

    return (
      <div key={item._id} className="saved-item-card">
        <button 
          onClick={() => handleDelete(item._id, 'destination')} 
          className="remove-btn"
          title="Remove from saved items"
        >
          ✕
        </button>
        {isPopular && <span className="item-badge popular">Popular</span>}
        <h3 className="item-title">{destinationName}</h3>
        <div className="item-location">
          <span className="location-icon">📍</span>
          {location}
        </div>
        <p className="item-description">{description}</p>
        <div className="item-tags">
          {tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="tag">{tag}</span>
          ))}
        </div>
        <div className="item-footer">
          <div className="item-price">{price}</div>
          <div className="item-rating">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={i < Math.floor(rating) ? 'star filled' : 'star'}>★</span>
            ))}
            <span className="rating-value">{rating}</span>
          </div>
        </div>
        <button 
          onClick={() => handlePlanTrip(destinationName)}
          className="plan-trip-btn"
        >
          Plan Trip
        </button>
      </div>
    );
  };

  const renderAccommodationCard = (item) => {
    return (
      <div key={item._id} className="saved-item-card">
        <button 
          onClick={() => handleDelete(item._id, 'accommodation')} 
          className="remove-btn"
          title="Remove from saved items"
        >
          ✕
        </button>
        <h3 className="item-title">{item.name}</h3>
        <div className="item-location">
          <span className="location-icon">📍</span>
          {item.address || item.destination || 'Location not specified'}
        </div>
        <p className="item-description">{item.description || 'Comfortable accommodation for your stay.'}</p>
        <div className="item-footer">
          <div className="item-price">
            {item.priceRange ? `PKR ${item.priceRange.min || 0} - ${item.priceRange.max || 0}` : 'Price on request'}
          </div>
          <div className="item-rating">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={i < Math.floor(item.rating || 4) ? 'star filled' : 'star'}>★</span>
            ))}
            <span className="rating-value">{item.rating || 4.0}</span>
          </div>
        </div>
        <button 
          onClick={() => handleViewDetails(item, 'accommodation')}
          className="plan-trip-btn"
        >
          View Details
        </button>
      </div>
    );
  };

  const renderTripPlanCard = (item) => {
    return (
      <div key={item._id} className="saved-item-card">
        <button 
          onClick={() => handleDelete(item._id, 'trip')} 
          className="remove-btn"
          title="Remove trip plan"
        >
          ✕
        </button>
        <h3 className="item-title">{item.destination}</h3>
        <div className="item-location">
          <span className="location-icon">👥</span>
          {item.numberOfMembers} {item.numberOfMembers === 1 ? 'Person' : 'People'} • {item.days} {item.days === 1 ? 'Day' : 'Days'}
        </div>
        <p className="item-description">Season: {item.season || 'All seasons'}</p>
        <div className="item-footer">
          <div className="item-price">PKR {item.total?.toLocaleString() || '0'}</div>
        </div>
        <button 
          onClick={() => handleViewDetails(item, 'trip')}
          className="plan-trip-btn"
        >
          View Details
        </button>
      </div>
    );
  };

  return (
    <div className="saved-items-page">
      <div className="saved-items-header">
        <h1>Saved Items</h1>
        <p className="subtitle">Your favorite destinations, accommodations, and travel plans</p>
      </div>
      {fetchError && (
        <div className="error-banner">
          <span>{fetchError}</span>
          <button type="button" onClick={() => { setFetchError(null); fetchData(); }}>Retry</button>
        </div>
      )}

      <div className="saved-items-tabs">
        <button 
          className={`tab ${activeTab === 'destinations' ? 'active' : ''}`}
          onClick={() => setActiveTab('destinations')}
        >
          Destinations
        </button>
        <button 
          className={`tab ${activeTab === 'accommodations' ? 'active' : ''}`}
          onClick={() => setActiveTab('accommodations')}
        >
          Accommodations
        </button>
        <button 
          className={`tab ${activeTab === 'trip-plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('trip-plans')}
        >
          Trip Plans
        </button>
      </div>

      <div className="saved-items-content">
        {loading ? (
          <div className="loading">Loading your saved items...</div>
        ) : (
          <>
            {activeTab === 'destinations' && (
              destinations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h2>No Saved Destinations</h2>
                  <p>Start exploring destinations and add them to your bucket list!</p>
                  <button onClick={() => navigate('/app/travel-hub')} className="explore-btn">
                    🌍 Explore Destinations
                  </button>
                </div>
              ) : (
                <div className="saved-items-grid">
                  {destinations.map(item => renderDestinationCard(item))}
                </div>
              )
            )}

            {activeTab === 'accommodations' && (
              accommodations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏨</div>
                  <h2>No Saved Accommodations</h2>
                  <p>Browse accommodations and save your favorites!</p>
                  <button onClick={() => navigate('/app/places-to-stay')} className="explore-btn">
                    🏨 Browse Accommodations
                  </button>
                </div>
              ) : (
                <div className="saved-items-grid">
                  {accommodations.map(item => renderAccommodationCard(item))}
                </div>
              )
            )}

            {activeTab === 'trip-plans' && (
              tripPlans.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✈️</div>
                  <h2>No Trip Plans</h2>
                  <p>Create your first trip plan using Money Map!</p>
                  <button onClick={() => navigate('/app/money-map')} className="explore-btn">
                    💰 Plan Your Trip
                  </button>
                </div>
              ) : (
                <div className="saved-items-grid">
                  {tripPlans.map(item => renderTripPlanCard(item))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BucketList;
