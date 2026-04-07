import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './AppLayout.css';

const navItems = [
  { path: '/app/dashboard', label: 'Dashboard', icon: '📊', module: 'dashboard' },
  { path: '/app/travel-hub', label: 'Travel Hub', icon: '🗺️', module: 'travel-hub' },
  { path: '/app/travel-map', label: 'Travel Map', icon: '📍', module: 'travel-map' },
  { path: '/app/money-map', label: 'Money Map', icon: '💰', module: 'money-map' },
  { path: '/app/travel-fund', label: 'Travel Fund', icon: '💵', module: 'travel-fund' },
  { path: '/app/bucket-list', label: 'Bucket List', icon: '📋', module: 'bucket-list' },
  { path: '/app/places-to-stay', label: 'Places to Stay', icon: '🏨', module: 'places-to-stay' },
  { path: '/app/buddy-bot', label: 'Buddy Bot', icon: '🤖', module: 'buddy-bot' },
  { path: '/app/weather', label: 'Weather', icon: '🌤️', module: 'weather' },
  { path: '/app/travel-history', label: 'Travel History', icon: '📜', module: 'travel-history' },
  { path: '/app/community-blog', label: 'Community Blog', icon: '📝', module: 'community-blog' },
  { path: '/app/profile', label: 'Profile', icon: '👤', module: 'profile' },
];

const pageTitles = {
  '/app/dashboard': 'Dashboard',
  '/app/travel-hub': 'Travel Hub',
  '/app/money-map': 'Money Map',
  '/app/travel-fund': 'Travel Fund',
  '/app/bucket-list': 'Bucket List',
  '/app/places-to-stay': 'Places to Stay',
  '/app/travel-map': 'Travel Map',
  '/app/buddy-bot': 'Buddy Bot',
  '/app/weather': 'Weather',
  '/app/travel-history': 'Travel History',
  '/app/community-blog': 'Community Blog',
  '/app/profile': 'Profile',
  '/app/admin': 'Admin',
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [tripNotifications, setTripNotifications] = useState([]);
  const [appNotifications, setAppNotifications] = useState([]);
  const popupSeenKey = user?._id ? `notif_popup_seen_${user._id}` : 'notif_popup_seen_guest';

  const currentPath = location.pathname;
  const pageTitle = pageTitles[currentPath] || 'Smart Travel';
  const isAdminRoute = currentPath === '/app/admin';
  const isTravelHistoryRoute = currentPath === '/app/travel-history';
  const isContactRoute = currentPath === '/app/contact-us';
  const isProfileRoute = currentPath === '/app/profile';
  const isCommunityBlogRoute = currentPath === '/app/community-blog';
  const isWeatherRoute = currentPath === '/app/weather';

  const notificationCount = useMemo(
    () => [...tripNotifications, ...appNotifications].filter((n) => !n.read).length,
    [tripNotifications, appNotifications]
  );

  useEffect(() => {
    setShowNotifications(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    const formatDate = (d) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const daysBetween = (from, to) => {
      const ms = to.getTime() - from.getTime();
      return Math.ceil(ms / (1000 * 60 * 60 * 24));
    };

    const buildNotifications = (trips) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return trips
        .map((trip, idx) => {
          const baseDate = trip.startDate || trip.createdAt;
          if (!baseDate) return null;

          const start = new Date(baseDate);
          if (Number.isNaN(start.getTime())) return null;

          const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const diff = daysBetween(today, startDay);
          const destination = trip.destination || 'Upcoming trip';

          if (diff < 0 || diff > 5) return null;

          let message = '';
          if (diff === 0) message = `${destination} starts today (${formatDate(start)}).`;
          else if (diff === 1) message = `${destination} starts tomorrow (${formatDate(start)}).`;
          else message = `${destination} starts in ${diff} days (${formatDate(start)}).`;

          return {
            id: trip._id || `${destination}-${idx}`,
            destination,
            startDate: start,
            message,
            read: false,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.startDate - b.startDate);
    };

    const fetchTripNotifications = async () => {
      try {
        const [fundRes, bucketRes] = await Promise.all([
          api.get('/travel-fund').catch(() => ({ data: [] })),
          api.get('/travel-fund/bucket-list').catch(() => ({ data: [] })),
        ]);

        const allTrips = [...(fundRes.data || []), ...(bucketRes.data || [])];
        const dedupMap = new Map();
        allTrips.forEach((trip) => {
          const key = trip._id || `${trip.destination}-${trip.startDate || trip.createdAt}`;
          if (!dedupMap.has(key)) dedupMap.set(key, trip);
        });

        const notifications = buildNotifications([...dedupMap.values()]);
        if (mounted) setTripNotifications(notifications);
      } catch (err) {
        console.error('Failed to load trip notifications:', err);
        if (mounted) setTripNotifications([]);
      }
    };

    const fetchAppNotifications = async () => {
      try {
        const res = await api.get('/notifications').catch(() => ({ data: { items: [] } }));
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const mapped = items.map((item) => ({
          id: item.id,
          message: item.text,
          read: Boolean(item.read),
          link: item.link || null
        }));
        if (mounted) {
          setAppNotifications(mapped);
          const hasUnread = mapped.some((x) => !x.read);
          const alreadySeen = sessionStorage.getItem(popupSeenKey) === '1';
          if (hasUnread && !alreadySeen) {
            setShowNotifications(true);
            sessionStorage.setItem(popupSeenKey, '1');
          }
        }
      } catch (err) {
        if (mounted) setAppNotifications([]);
      }
    };

    fetchTripNotifications();
    fetchAppNotifications();
    const timer = setInterval(fetchTripNotifications, 60000);
    const appTimer = setInterval(fetchAppNotifications, 45000);

    return () => {
      mounted = false;
      clearInterval(timer);
      clearInterval(appTimer);
    };
  }, [popupSeenKey]);

  const handleNotificationToggle = () => {
    setShowNotifications((prev) => !prev);
    setTripNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setAppNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.patch('/notifications/read').catch(() => {});
  };

  return (
    <div
      className={[
        'goland-layout',
        isAdminRoute ? 'admin-route-layout' : '',
        isTravelHistoryRoute ? 'goland-layout--vintage-map' : '',
        isContactRoute ? 'goland-layout--contact-sky' : '',
        isProfileRoute ? 'goland-layout--profile-blue' : '',
        isCommunityBlogRoute ? 'goland-layout--community-warm' : '',
        isWeatherRoute ? 'goland-layout--weather-green' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* TOP HEADER - hidden on admin route */}
      {!isAdminRoute && (
      <header className="goland-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate('/app/dashboard')}>
            <span className="logo-icon" aria-hidden="true">🚌</span>
            <span>Smart Travel</span>
          </div>
          <h1 className="page-title">{pageTitle}</h1>
        </div>
        <div className="header-spacer" />
        <div className="header-right">
          <div className="notifications-wrap">
            <button
              className="icon-btn notification-btn"
              onClick={handleNotificationToggle}
              title="Notifications"
            >
              🔔
              {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
            </button>
            {showNotifications && (
              <div className="notifications-panel">
                <div className="notifications-title">Notifications</div>
                {[...appNotifications, ...tripNotifications].length === 0 ? (
                  <div className="notification-empty">No new notifications.</div>
                ) : (
                  [...appNotifications, ...tripNotifications].map((n) => (
                    <div key={n.id} className="notification-item">
                      <span className="notification-dot" />
                      <span>{n.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="user-profile">
            <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
            <div className="user-info">
              <span className="user-name">{user?.name || 'User'}</span>
              <span className="user-role">{user?.role === 'admin' ? 'Admin' : 'Traveler'}</span>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* SIDEBAR - hidden on admin route */}
      {!isAdminRoute && (
      <aside className="goland-sidebar">
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item nav-item--${item.module} ${currentPath === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon ? <span className="nav-icon">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
          {user?.role === 'admin' && (
            <button
              className={`nav-item nav-item--admin ${currentPath === '/app/admin' ? 'active' : ''}`}
              onClick={() => navigate('/app/admin')}
            >
              <span className="nav-icon">⚙️</span>
              <span>Admin</span>
            </button>
          )}
        </nav>

        <button className="contact-btn" onClick={() => navigate('/app/contact-us')}>
          <span className="nav-icon">📧</span>
          <span>Contact Us</span>
        </button>

        <button className="logout-btn" onClick={logout}>
          <span>Logout</span>
        </button>
      </aside>
      )}

      {/* MAIN CONTENT */}
      <main className="goland-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;

