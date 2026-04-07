import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './TravelHistory.css';

// Travel Diary / History Page with full CRUD features

const TravelHistory = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    timePeriod: 'all',
    destination: 'all'
  });

  // Summary stats
  const [stats, setStats] = useState({
    totalTrips: 0,
    destinationsVisited: 0,
    daysTraveled: 0,
    totalSpent: 0
  });

  // Edit modal state
  const [fetchError, setFetchError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    status: '',
    startDate: '',
    endDate: '',
    accommodation: '',
    rating: '',
    notes: ''
  });

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, trips]);

  const fetchTrips = async () => {
    setFetchError(null);
    try {
      setLoading(true);
      const response = await api.get('/travel-fund');
      const allTrips = response.data || [];
      const actualTrips = allTrips.filter(trip => !trip.isBucketList);
      setTrips(actualTrips);
      calculateStats(actualTrips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      setFetchError(error.response?.data?.message || 'Could not load travel history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tripsData) => {
    const totalTrips = tripsData.length;
    const uniqueDestinations = new Set(tripsData.map(t => t.destination)).size;
    const daysTraveled = tripsData.reduce((sum, t) => sum + (t.days || 0), 0);
    const totalSpent = tripsData.reduce((sum, t) => sum + (t.total || 0), 0);

    setStats({
      totalTrips,
      destinationsVisited: uniqueDestinations,
      daysTraveled,
      totalSpent
    });
  };

  const applyFilters = () => {
    let filtered = [...trips];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(trip => trip.status === filters.status);
    }

    // Time period filter
    if (filters.timePeriod !== 'all') {
      const now = new Date();
      filtered = filtered.filter(trip => {
        if (!trip.startDate) return false;
        const startDate = new Date(trip.startDate);
        const diffTime = now - startDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        switch (filters.timePeriod) {
          case 'last-month':
            return diffDays <= 30;
          case 'last-3-months':
            return diffDays <= 90;
          case 'last-year':
            return diffDays <= 365;
          default:
            return true;
        }
      });
    }

    // Destination filter
    if (filters.destination !== 'all') {
      filtered = filtered.filter(trip => trip.destination === filters.destination);
    }

    setFilteredTrips(filtered);
  };

  const handleViewDetails = (trip) => {
    navigate(`/app/money-map?trip=${trip._id}`);
  };

  const handlePlanAgain = (trip) => {
    navigate(`/app/money-map?destination=${encodeURIComponent(trip.destination)}&members=${trip.numberOfMembers}&days=${trip.days}`);
  };

  const handleModify = (trip) => {
    setSelectedTrip(trip);
    
    // Calculate end date if start date and days are available but end date is not
    let endDate = trip.endDate;
    if (!endDate && trip.startDate && trip.days) {
      const start = new Date(trip.startDate);
      start.setDate(start.getDate() + trip.days);
      endDate = start.toISOString().split('T')[0];
    }
    
    setEditForm({
      status: trip.status || 'planned',
      startDate: trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : '',
      endDate: endDate || '',
      accommodation: trip.accommodation || '',
      rating: trip.rating || '',
      notes: trip.notes || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTrip) return;
    
    // Validate required fields
    if (!editForm.startDate || !editForm.endDate) {
      alert('Please set both start and end dates to save the trip.');
      return;
    }
    
    // Validate end date is after start date
    if (new Date(editForm.endDate) < new Date(editForm.startDate)) {
      alert('End date must be after start date.');
      return;
    }
    
    try {
      await api.put(`/travel-fund/${selectedTrip._id}`, editForm);
      setShowEditModal(false);
      setSelectedTrip(null);
      fetchTrips();
      // Use a better notification method instead of alert
      const notification = document.createElement('div');
      notification.textContent = '✅ Trip updated successfully!';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #27ae60; color: white; padding: 15px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    } catch (error) {
      console.error('Error updating trip:', error);
      alert('Failed to update trip. Please try again.');
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      try {
        await api.delete(`/travel-fund/${tripId}`);
        fetchTrips();
        alert('Trip deleted successfully!');
      } catch (error) {
        console.error('Error deleting trip:', error);
        alert('Failed to delete trip. Please try again.');
      }
    }
  };

  const handleShare = async (trip) => {
    const shareText = `Check out my trip to ${trip.destination}! ${trip.days} days, ${trip.numberOfMembers} people, Total: PKR ${trip.total?.toLocaleString() || 0}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trip to ${trip.destination}`,
          text: shareText
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Trip details copied to clipboard!');
    }
  };

  const handleAddToCalendar = (trip) => {
    // If dates are set, use them
    if (trip.startDate && trip.endDate) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      
      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Trip to ${trip.destination}&dates=${start.toISOString().replace(/[-:]/g, '').split('.')[0]}/${end.toISOString().replace(/[-:]/g, '').split('.')[0]}&details=${encodeURIComponent(`Trip to ${trip.destination} for ${trip.days} days with ${trip.numberOfMembers} people. Budget: PKR ${trip.total?.toLocaleString() || 0}`)}`;
      
      window.open(calendarUrl, '_blank');
    } else if (trip.days) {
      // If no dates but days are set, calculate approximate dates (starting from today)
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + (trip.days || 1));
      
      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Trip to ${trip.destination}&dates=${start.toISOString().replace(/[-:]/g, '').split('.')[0]}/${end.toISOString().replace(/[-:]/g, '').split('.')[0]}&details=${encodeURIComponent(`Trip to ${trip.destination} for ${trip.days} days with ${trip.numberOfMembers} people. Budget: PKR ${trip.total?.toLocaleString() || 0}\n\nNote: Dates are estimated. Please update in the calendar.`)}`;
      
      window.open(calendarUrl, '_blank');
    } else {
      // If no dates or days, open edit modal to set dates
      handleModify(trip);
    }
  };

  const handleExportHistory = () => {
    const csvContent = [
      ['Destination', 'Start Date', 'End Date', 'Days', 'Members', 'Total Cost', 'Status'],
      ...filteredTrips.map(trip => [
        trip.destination,
        trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'N/A',
        trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'N/A',
        trip.days || 0,
        trip.numberOfMembers || 0,
        trip.total || 0,
        trip.status || 'planned'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', color: '#b45309', bg: '#fef3c7' },
      completed: { label: 'Completed', color: '#27ae60', bg: '#d4edda' },
      confirmed: { label: 'Confirmed', color: '#3498db', bg: '#d1ecf1' },
      planned: { label: 'Planned', color: '#95a5a6', bg: '#e2e3e5' },
      upcoming: { label: 'Upcoming', color: '#f39c12', bg: '#fff3cd' },
      cancelled: { label: 'Cancelled', color: '#e74c3c', bg: '#f8d7da' }
    };

    const config = statusConfig[status] || statusConfig.planned;
    return (
      <span className="status-badge" style={{ background: config.bg, color: config.color }}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateRange = (startDate, endDate, days) => {
    if (startDate && endDate) {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      return `${start} - ${end} • ${days} ${days === 1 ? 'day' : 'days'}`;
    } else if (days) {
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return 'Dates not set';
  };

  const uniqueDestinations = [...new Set(trips.map(t => t.destination))];

  return (
    <div className="travel-history-page">
      <div className="history-header">
        <div className="header-left">
          <h1>Trip History</h1>
        </div>
        <div className="header-right">
          <button onClick={handleExportHistory} className="export-btn">
            <span>📥</span> Export History
          </button>
        </div>
      </div>
      {fetchError && (
        <div className="page-error-banner">
          <span>{fetchError}</span>
          <button type="button" onClick={() => fetchTrips()}>Retry</button>
        </div>
      )}

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">🧳</div>
          <div className="card-content">
            <div className="card-value">{stats.totalTrips}</div>
            <div className="card-label">Total Trips</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">🏛️</div>
          <div className="card-content">
            <div className="card-value">{stats.destinationsVisited}</div>
            <div className="card-label">Destinations Visited</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">⛰️</div>
          <div className="card-content">
            <div className="card-value">{stats.daysTraveled}</div>
            <div className="card-label">Days Traveled</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <div className="card-value">PKR {Math.round(stats.totalSpent / 1000)}K</div>
            <div className="card-label">Total Spent</div>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Trip Status</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="planned">Planned</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Time Period</label>
          <select 
            value={filters.timePeriod}
            onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}
          >
            <option value="all">All Time</option>
            <option value="last-month">Last Month</option>
            <option value="last-3-months">Last 3 Months</option>
            <option value="last-year">Last Year</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Destination</label>
          <select 
            value={filters.destination}
            onChange={(e) => setFilters({...filters, destination: e.target.value})}
          >
            <option value="all">All Destinations</option>
            {uniqueDestinations.map(dest => (
              <option key={dest} value={dest}>{dest}</option>
            ))}
          </select>
        </div>
        <button onClick={applyFilters} className="apply-filters-btn">
          <span>🔽</span> Apply Filters
        </button>
      </div>

      <div className="trips-list">
        {loading ? (
          <div className="loading">Loading your trip history...</div>
        ) : filteredTrips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✈️</div>
            <h2>No Trips Found</h2>
            <p>Start planning your trips using Money Map!</p>
            <button onClick={() => navigate('/app/money-map')} className="explore-btn">
              💰 Plan Your First Trip
            </button>
          </div>
        ) : (
          filteredTrips.map(trip => (
            <div key={trip._id} className="trip-card">
              <div className="trip-icon">🟢</div>
              <div className="trip-content">
                <div className="trip-header">
                  <h3>{trip.destination}</h3>
                  {getStatusBadge(trip.status || 'planned')}
                </div>
                <div className="trip-details">
                  <div className="trip-date">
                    {formatDateRange(trip.startDate, trip.endDate, trip.days)}
                  </div>
                  <div className="trip-location">
                    📍 {trip.destination}
                  </div>
                  <div className="trip-info">
                    <span>👥 {trip.numberOfMembers} {trip.numberOfMembers === 1 ? 'Adult' : 'Adults'}</span>
                    {trip.accommodation && <span>🏨 {trip.accommodation}</span>}
                  </div>
                  <div className="trip-cost">
                    {trip.status === 'completed' ? 'Total Cost' : 'Estimated Cost'}: <strong>PKR {trip.total?.toLocaleString() || '0'}</strong>
                  </div>
                  {trip.rating && (
                    <div className="trip-rating">
                      Rating: {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < Math.floor(trip.rating) ? 'star filled' : 'star'}>★</span>
                      ))} {trip.rating}/5.0
                    </div>
                  )}
                </div>
                <div className="trip-actions">
                  <button onClick={() => handleViewDetails(trip)} className="action-btn view">
                    View Details
                  </button>
                  {trip.status === 'completed' ? (
                    <>
                      <button onClick={() => handlePlanAgain(trip)} className="action-btn plan">
                        Plan Again
                      </button>
                      <button onClick={() => handleShare(trip)} className="action-btn share">
                        Share
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleModify(trip)} className="action-btn modify">
                        Modify
                      </button>
                      <button onClick={() => handleAddToCalendar(trip)} className="action-btn calendar">
                        Add to Calendar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Trip Modal */}
      {showEditModal && selectedTrip && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Trip: {selectedTrip.destination}</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Status</label>
                <select 
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                >
                  <option value="planned">Planned</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="form-group">
                <label>Start Date *</label>
                <input 
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value;
                    // Auto-calculate end date if days are available
                    if (newStartDate && selectedTrip?.days) {
                      const start = new Date(newStartDate);
                      const end = new Date(start);
                      end.setDate(start.getDate() + selectedTrip.days);
                      setEditForm({
                        ...editForm, 
                        startDate: newStartDate,
                        endDate: end.toISOString().split('T')[0]
                      });
                    } else {
                      setEditForm({...editForm, startDate: newStartDate});
                    }
                  }}
                  required
                />
                <small style={{color: '#666', fontSize: '12px'}}>Required for calendar integration</small>
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input 
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({...editForm, endDate: e.target.value})}
                  min={editForm.startDate}
                  required
                />
                <small style={{color: '#666', fontSize: '12px'}}>Required for calendar integration</small>
              </div>
              <div className="form-group">
                <label>Accommodation</label>
                <input 
                  type="text"
                  value={editForm.accommodation}
                  onChange={(e) => setEditForm({...editForm, accommodation: e.target.value})}
                  placeholder="Hotel name or accommodation type"
                />
              </div>
              <div className="form-group">
                <label>Rating (1-5)</label>
                <input 
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={editForm.rating}
                  onChange={(e) => setEditForm({...editForm, rating: e.target.value})}
                  placeholder="Rate your trip"
                />
              </div>
              <div className="form-group">
                <label>Notes / Memories</label>
                <textarea 
                  value={editForm.notes}
                  onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                  placeholder="Add your trip memories, notes, or experiences..."
                  rows="4"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEditModal(false)} className="btn-cancel">Cancel</button>
              <button 
                onClick={handleSaveEdit} 
                className="btn-save"
                disabled={!editForm.startDate || !editForm.endDate}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelHistory;
