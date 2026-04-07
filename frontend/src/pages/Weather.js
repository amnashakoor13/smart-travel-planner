import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Weather.css';

const Weather = () => {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDestinations, setFilteredDestinations] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const response = await api.get('/travel-hub');
      console.log('Destinations API Response:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        setDestinations(response.data);
        setFilteredDestinations(response.data);
        if (response.data.length > 0) {
          setSelectedDestination(response.data[0].name);
          fetchWeather(response.data[0].name);
        } else {
          console.log('No destinations found in database');
          alert('No destinations found. Please add destinations to the database first.');
        }
      } else {
        console.error('Invalid response format:', response.data);
        alert('Invalid response from server. Please check backend logs.');
      }
    } catch (error) {
      console.error('Error fetching destinations:', error);
      console.error('Error details:', error.response?.data || error.message);
      alert(`Failed to load destinations: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredDestinations(destinations);
    } else {
      const filtered = destinations.filter(dest =>
        dest.name.toLowerCase().includes(query.toLowerCase()) ||
        dest.city.toLowerCase().includes(query.toLowerCase()) ||
        dest.country.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredDestinations(filtered);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Try to find exact match first
      const exactMatch = destinations.find(
        dest => dest.name.toLowerCase() === searchQuery.toLowerCase() ||
                dest.city.toLowerCase() === searchQuery.toLowerCase()
      );
      
      if (exactMatch) {
        setSelectedDestination(exactMatch.name);
        fetchWeather(exactMatch.name);
      } else if (filteredDestinations.length > 0) {
        // Use first filtered result
        setSelectedDestination(filteredDestinations[0].name);
        fetchWeather(filteredDestinations[0].name);
      } else {
        // Try to fetch weather directly with search query
        fetchWeather(searchQuery);
      }
    }
  };

  const fetchWeather = async (destination) => {
    if (!destination) {
      setWeatherData(null);
      setForecast([]);
      return;
    }
    
    setLoading(true);
    setWeatherData(null); // Clear previous data
    setForecast([]);
    setError(null); // Clear previous errors
    
    try {
      // Try to get weather from backend
      const response = await api.get(`/travel-hub/weather?destination=${encodeURIComponent(destination)}`);
      if (response.data && response.data.current) {
        setWeatherData(response.data.current);
        setForecast(response.data.forecast || []);
        setError(null);
        setLoading(false);
        return;
      }
    } catch (apiError) {
      console.error('Backend weather API error:', apiError.response?.data || apiError.message);
      
      // Set error message for UI display
      if (apiError.response?.data?.message) {
        setError(apiError.response.data.message);
      } else {
        setError('Failed to fetch weather data. Please try again.');
      }
      
      setWeatherData(null);
      setForecast([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDestinationChange = (e) => {
    const dest = e.target.value;
    setSelectedDestination(dest);
    setSearchQuery(''); // Clear search when selecting from dropdown
    if (dest) {
      fetchWeather(dest);
    } else {
      // Clear weather data if no destination selected
      setWeatherData(null);
      setForecast([]);
    }
  };

  const getTravelTips = () => {
    if (!weatherData) return null;

    const temp = weatherData.temperature;
    const condition = weatherData.condition?.toLowerCase() || '';

    const tips = {
      clothing: '',
      activities: '',
      travel: ''
    };

    if (temp < 10) {
      tips.clothing = 'Wear warm layered clothing with a heavy jacket. Don\'t forget gloves, hat, and scarf.';
      tips.activities = 'Perfect for indoor activities and cozy experiences. Outdoor activities may be limited.';
      tips.travel = 'Roads may be icy. Drive carefully and check for road closures.';
    } else if (temp < 20) {
      tips.clothing = 'Wear layered clothing with a warm jacket. Don\'t forget gloves and a hat.';
      tips.activities = 'Perfect weather for hiking and outdoor photography. Trails should be clear.';
      tips.travel = 'Roads are clear but drive carefully in mountainous areas. Check for any road closures.';
    } else {
      tips.clothing = 'Light clothing is recommended. Bring a light jacket for evenings.';
      tips.activities = 'Great weather for all outdoor activities. Perfect for sightseeing and adventures.';
      tips.travel = 'Excellent conditions for travel. All routes should be accessible.';
    }

    if (condition.includes('rain')) {
      tips.clothing = 'Bring waterproof clothing and an umbrella.';
      tips.activities = 'Indoor activities recommended. Outdoor activities may be limited.';
      tips.travel = 'Wet roads - drive with extra caution.';
    }

    return tips;
  };

  const tips = getTravelTips();

  return (
    <div className="weather-page">
      <div className="header">
        <div className="header-content">
          <h1>Weather Information</h1>
          <p className="subtitle">Check real-time weather conditions for your travel destinations</p>
        </div>
      </div>

      <div className="content">
        <div className="destination-selector">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                handleSearchSubmit(e);
              } else if (selectedDestination) {
                fetchWeather(selectedDestination);
              }
            }}
            className="weather-search-form"
          >
            <input
              type="text"
              placeholder="Search destination or city name..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            <select
              value={selectedDestination}
              onChange={handleDestinationChange}
              className="destination-select"
              disabled={loading || filteredDestinations.length === 0}
              title="Or pick from list"
            >
              <option value="">
                {filteredDestinations.length === 0 ? 'No destinations available' : 'Select destination'}
              </option>
              {filteredDestinations.map((dest) => (
                <option key={dest._id || dest.name} value={dest.name}>
                  {dest.name} {dest.city ? `(${dest.city})` : ''} {dest.country ? `- ${dest.country}` : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || (!searchQuery.trim() && !selectedDestination)}
              className="get-weather-btn"
            >
              {loading ? '⏳ Loading...' : '🌤️ Get Weather'}
            </button>
          </form>
        </div>

        {weatherData && (
          <>
            <div className="current-weather">
              <div className="weather-main">
                <div className="weather-icon">{weatherData.icon || '⛅'}</div>
                <div className="weather-temp">{weatherData.temperature}°C</div>
                <div className="weather-condition">{weatherData.condition}</div>
              </div>
              <div className="weather-details">
                <div className="detail-item">
                  <span className="detail-label">Feels Like</span>
                  <span className="detail-value">{weatherData.feelsLike}°C</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Humidity</span>
                  <span className="detail-value">{weatherData.humidity}%</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Wind Speed</span>
                  <span className="detail-value">{weatherData.windSpeed} km/h</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Visibility</span>
                  <span className="detail-value">{weatherData.visibility} km</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Pressure</span>
                  <span className="detail-value">{weatherData.pressure} hPa</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">UV Index</span>
                  <span className="detail-value">{weatherData.uvIndex}</span>
                </div>
              </div>
            </div>

            <div className="forecast-section">
              <h2>5-Day Forecast</h2>
              <div className="forecast-grid">
                {forecast.map((day, index) => (
                  <div key={index} className="forecast-card">
                    <div className="forecast-day">{day.day}</div>
                    <div className="forecast-icon">{day.icon}</div>
                    <div className="forecast-temp">{day.temp}°C</div>
                    <div className="forecast-condition">{day.condition}</div>
                  </div>
                ))}
              </div>
            </div>

            {tips && (
              <div className="travel-tips">
                <h2>Travel Tips for Current Weather</h2>
                <div className="tips-grid">
                  <div className="tip-card">
                    <div className="tip-icon">👕</div>
                    <h3>Clothing Recommendation</h3>
                    <p>{tips.clothing}</p>
                  </div>
                  <div className="tip-card">
                    <div className="tip-icon">🥾</div>
                    <h3>Activity Suggestions</h3>
                    <p>{tips.activities}</p>
                  </div>
                  <div className="tip-card">
                    <div className="tip-icon">🚗</div>
                    <h3>Travel Advice</h3>
                    <p>{tips.travel}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="weather-error">
            <div className="error-icon">⚠️</div>
            <div className="error-message">{error}</div>
            <div className="error-hint">Try searching for a different city name or select from the dropdown.</div>
          </div>
        )}

        {!weatherData && !loading && !error && (
          <div className="no-weather">
            <p>Search or select a destination and click &quot;Get Weather&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Weather;
