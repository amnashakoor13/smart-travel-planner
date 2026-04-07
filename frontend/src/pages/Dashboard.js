import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [bucketList, setBucketList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setFetchError(null);
    try {
      const [destinationsRes, budgetsRes, bucketRes] = await Promise.all([
        api.get('/dashboard/popular-destinations').catch((e) => { throw e; }),
        api.get('/travel-fund').catch((e) => { throw e; }),
        api.get('/travel-fund/bucket-list').catch((e) => { throw e; })
      ]);
      setPopularDestinations(destinationsRes.data || []);
      setBudgets(budgetsRes.data || []);
      setBucketList(bucketRes.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setFetchError(error.response?.data?.message || 'Could not load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalBudget = budgets.reduce((sum, b) => sum + (b.total || 0), 0);
  const tripPackages = popularDestinations.slice(0, 6);
  const plannedTrips = [...bucketList, ...budgets.filter(b => !b.isBucketList)].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  const getDatesWithPlans = () => {
    const dates = new Set();
    plannedTrips.forEach(trip => {
      const start = trip.startDate ? new Date(trip.startDate) : (trip.createdAt ? new Date(trip.createdAt) : null);
      const end = trip.endDate ? new Date(trip.endDate) : start;
      if (start) {
        for (let d = new Date(start); d <= (end || start); d.setDate(d.getDate() + 1)) {
          dates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      } else if (trip.createdAt) {
        const created = new Date(trip.createdAt);
        dates.add(`${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`);
      }
    });
    return dates;
  };

  const datesWithPlans = getDatesWithPlans();

  const getTripsForDate = (year, month, day) => {
    const key = `${year}-${month}-${day}`;
    return plannedTrips.filter(trip => {
      const start = trip.startDate ? new Date(trip.startDate) : (trip.createdAt ? new Date(trip.createdAt) : null);
      const end = trip.endDate ? new Date(trip.endDate) : start;
      if (!start) return false;
      const startKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const endKey = end ? `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}` : startKey;
      const d = new Date(year, month, day);
      const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return dKey >= startKey && dKey <= endKey;
    });
  };

  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const totalTrips = plannedTrips.length;
  const doneCount = budgets.filter(b => b.status === 'completed').length;
  const bookedCount = Math.max(0, plannedTrips.length - doneCount);
  const donePercent = totalTrips > 0 ? Math.round((doneCount / totalTrips) * 100) : 0;
  const bookedPercent = totalTrips > 0 ? Math.round((bookedCount / totalTrips) * 100) : 0;
  const cancelledPercent = Math.max(0, 100 - donePercent - bookedPercent);

  const formatDateRange = (start, end, createdAt) => {
    if (start && end) {
      return `${new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (createdAt) {
      const d = new Date(createdAt);
      return `Planned • ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return 'Planned';
  };

  return (
    <div className="goland-dashboard dashboard-with-bg">
      {fetchError && (
        <div className="dashboard-error-banner">
          <span>{fetchError}</span>
          <button type="button" onClick={() => fetchDashboardData()}>Retry</button>
        </div>
      )}
      <section className="goland-module travel-packages-module">
        <div className="module-header">
          <h2>Featured Destinations</h2>
          <span className="view-all" onClick={() => navigate('/app/travel-hub')}>View All</span>
        </div>
        <div className="packages-grid">
          {loading ? (
            <p className="loading-msg">Loading...</p>
          ) : tripPackages.length === 0 ? (
            <p className="empty-msg">No destinations yet. Start exploring Travel Hub.</p>
          ) : (
            tripPackages.slice(0, 3).map((dest) => (
              <div key={dest._id} className="package-card" onClick={() => navigate(`/app/travel-hub?id=${dest._id}`)}>
                <div className="package-image">
                  {dest.images && dest.images[0] ? (
                    <img src={dest.images[0]} alt={dest.name} />
                  ) : (
                    <div className="package-placeholder">🗻</div>
                  )}
                  <span className="package-rating">{dest.rating || 4.3} ⭐</span>
                </div>
                <div className="package-info">
                  <h3>{dest.name}</h3>
                  <p>{dest.city}, {dest.country || 'Pakistan'}</p>
                  <p className="package-price">Ready to explore</p>
                  <button className="view-btn btn-primary" onClick={(e) => { e.stopPropagation(); navigate(`/app/travel-hub?id=${dest._id}`); }}>View Details</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="goland-module calendar-module">
          <div className="module-header">
            <h3>Trip Planner Calendar</h3>
            <span className="view-all" onClick={() => navigate('/app/bucket-list')}>Bucket List</span>
          </div>
          <div className="calendar-header">
            <button type="button" className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>Prev</button>
            <h4>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h4>
            <button type="button" className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>Next</button>
          </div>
          <div className="calendar-days">
            {dayNames.map(d => <span key={d} className="day-name">{d}</span>)}
            {getCalendarDays().map((d, i) => {
              if (!d) return <span key={`e-${i}`} className="calendar-day empty" />;
              const hasPlan = datesWithPlans.has(`${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${d}`);
              const tripsOnDate = getTripsForDate(currentMonth.getFullYear(), currentMonth.getMonth(), d);
              const isSelected = selectedDate && selectedDate.day === d && selectedDate.month === currentMonth.getMonth();
              return (
                <span
                  key={d}
                  className={`calendar-day ${hasPlan ? 'has-plan' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedDate(hasPlan ? { day: d, month: currentMonth.getMonth(), year: currentMonth.getFullYear(), trips: tripsOnDate } : null);
                  }}
                  title={tripsOnDate.length ? tripsOnDate.map(t => t.destination).join(', ') : ''}
                >
                  {d}
                </span>
              );
            })}
          </div>
          {selectedDate && selectedDate.trips && selectedDate.trips.length > 0 && (
            <div className="calendar-plan-detail">
              <h4>Plans for {selectedDate.day} {monthNames[selectedDate.month]}</h4>
              {selectedDate.trips.map((t, i) => (
                <div key={t._id || i} className="plan-detail-item" onClick={() => navigate('/app/bucket-list')}>
                  <strong>📍 {t.destination}</strong>
                  <span>{formatDateRange(t.startDate, t.endDate, t.createdAt)} • {t.numberOfMembers || 1} people</span>
                </div>
              ))}
              <button type="button" className="view-btn btn-primary" onClick={() => navigate('/app/bucket-list')}>Open Bucket List</button>
            </div>
          )}
          {!loading && plannedTrips.length > 0 && (
            <div className="my-planned-destinations">
              <h4>Your Planned Destinations</h4>
              {plannedTrips.slice(0, 4).map((t, i) => (
                <div key={t._id || i} className="planned-dest-item" onClick={() => navigate('/app/bucket-list')}>
                  <span className="dest-name">📍 {t.destination}</span>
                  <span className="dest-meta">{t.isBucketList ? 'Bucket List' : 'Trip Plan'} • PKR {(t.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="goland-module trip-overview-module">
          <h3>Trip Progress</h3>
          <div className="donut-chart">
            <div className="donut-ring" style={{ '--done': donePercent, '--booked': bookedPercent, '--cancelled': cancelledPercent }}>
              <div className="donut-center">
                <span className="donut-total">{totalTrips}</span>
                <span>Total Trips</span>
              </div>
            </div>
          </div>
          <div className="trip-stats">
            <span>{cancelledPercent}% Cancelled</span>
            <span>{bookedPercent}% Planned</span>
            <span>{donePercent}% Completed</span>
          </div>
        </section>

        <section className="goland-module upcoming-trips-module">
          <div className="module-header">
            <h3>Upcoming Plans</h3>
            <span className="view-all" onClick={() => navigate('/app/bucket-list')}>View All</span>
          </div>
          <div className="upcoming-list">
            {plannedTrips.slice(0, 4).map((b, idx) => (
              <div key={b._id || idx} className="upcoming-item" onClick={() => navigate('/app/bucket-list')}>
                <div className="upcoming-thumb">🗺️</div>
                <div className="upcoming-info">
                  <strong>📍 {b.destination || 'Trip'}</strong>
                  <span>{formatDateRange(b.startDate, b.endDate, b.createdAt)} • {b.numberOfMembers || 1} people • Rs {(b.total || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {!loading && plannedTrips.length === 0 && <p className="empty-msg">No plans yet. Add one from Travel Hub or Money Map.</p>}
          </div>
        </section>

        <section className="goland-module revenue-module">
          <div className="module-header">
            <h3>Budget Snapshot</h3>
            <span className="view-all" onClick={() => navigate('/app/travel-fund')}>Travel Fund</span>
          </div>
          <div className="revenue-metrics">
            <div className="metric-card">
              <span>PKR {totalBudget.toLocaleString()}</span>
              <span>Total Budget</span>
            </div>
            <div className="metric-card">
              <span>{budgets.length}</span>
              <span>Saved Plans</span>
            </div>
            <div className="metric-card">
              <span>{bucketList.length}</span>
              <span>Bucket List</span>
            </div>
          </div>
        </section>

        <section className="goland-module recent-activity-module">
          <h3>Recent Activity Feed</h3>
          <div className="activity-list">
            {plannedTrips.slice(0, 3).map((b, idx) => (
              <div key={b._id || idx} className="activity-item">
                <div className="activity-icon">✓</div>
                <div>
                  <strong>{b.destination} {b.isBucketList ? 'added to Bucket List' : 'saved'}</strong>
                  <span>{b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              </div>
            ))}
            {!loading && plannedTrips.length === 0 && <p className="empty-msg">No recent activity</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
