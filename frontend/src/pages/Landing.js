import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PrimaryButton from '../components/PrimaryButton';
import './Landing.css';

const navLinks = [
  { label: 'Destinations', route: '/app/travel-hub', color: 'destinations' },
  { label: 'Travel Hub', route: '/app/travel-hub', color: 'travel-hub' },
  { label: 'Places to Stay', route: '/app/places-to-stay', color: 'places' },
  { label: 'Money Map', route: '/app/money-map', color: 'money' },
  { label: 'Buddy Bot', route: '/app/buddy-bot', color: 'buddy' },
];

const stats = [
  { value: '10k+', label: 'Travelers' },
  { value: '500+', label: 'Destinations' },
  { value: '50+', label: 'Countries' },
  { value: '24/7', label: 'Support' },
];

const Landing = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState({ destination: '', date: '', guests: '' });
  const [trendingCards, setTrendingCards] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate('/login', { state: { redirect: '/app/travel-hub', search: search.destination ? { destination: search.destination, date: search.date, guests: search.guests } : null } });
  };

  const handleNavModuleClick = (route) => {
    navigate('/login', { state: { redirect: route } });
  };

  useEffect(() => {
    let isMounted = true;
    const loadTrending = async () => {
      try {
        setTrendingLoading(true);
        const response = await api.get('/travel-hub');
        const data = Array.isArray(response.data) ? response.data : [];

        const popular = data.filter((d) => d.isPopular);
        const source = popular.length ? popular : data;

        const cards = source.slice(0, 4).map((dest, idx) => ({
          id: dest._id || idx + 1,
          title: dest.name,
          location: `${dest.city}, ${dest.country}`,
          rating: dest.isPopular ? 4.9 : 4.7,
          image: dest.images?.[0] || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80',
        }));

        if (isMounted) setTrendingCards(cards);
      } catch (e) {
        console.error('Failed to load trending destinations:', e);
        if (isMounted) setTrendingCards([]);
      } finally {
        if (isMounted) setTrendingLoading(false);
      }
    };

    loadTrending();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="landing-page">
      {/* Sticky Navbar */}
      <nav className="landing-nav">
        <div className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="nav-logo-icon">✈</span>
          <span>Smart Travel</span>
        </div>
        <ul className="nav-links">
          {navLinks.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={`nav-link nav-link--${item.color} nav-link-btn`}
                onClick={() => handleNavModuleClick(item.route)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="nav-actions">
          <Link to="/login">
            <PrimaryButton type="button">Sign In</PrimaryButton>
          </Link>
        </div>
      </nav>

      {/* Large Hero Section */}
      <section className="landing-hero-wrapper">
        <div className="hero-bg" aria-hidden="true" />
        <div className="landing-hero">
          <div className="hero-content">
            <span className="hero-badge">Your journey starts here</span>
            <h1 className="hero-headline">Explore the Unexplored</h1>
            <p className="hero-subline">
              Plan trips, track budgets, and discover destinations with your smart travel companion.
            </p>
            <form className="hero-search-card glass-card" onSubmit={handleSearchSubmit}>
              <div className="search-fields-row">
                <div className="search-field">
                  <label><span className="field-icon">📍</span>Destination</label>
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={search.destination}
                    onChange={(e) => setSearch({ ...search, destination: e.target.value })}
                  />
                </div>
                <div className="search-field">
                  <label><span className="field-icon">📅</span>Date</label>
                  <input
                    type="text"
                    placeholder="When?"
                    value={search.date}
                    onChange={(e) => setSearch({ ...search, date: e.target.value })}
                  />
                </div>
                <div className="search-field">
                  <label><span className="field-icon">👥</span>Passengers</label>
                  <input
                    type="text"
                    placeholder="How many?"
                    value={search.guests}
                    onChange={(e) => setSearch({ ...search, guests: e.target.value })}
                  />
                </div>
              </div>
              <PrimaryButton type="submit" fullWidth className="hero-search-btn">
                Search
              </PrimaryButton>
            </form>
          </div>
          <div className="hero-visual">
            <div className="hero-collage">
              <div className="collage-img collage-img--1" />
              <div className="collage-img collage-img--2" />
              <div className="collage-img collage-img--3" />
            </div>
          </div>
        </div>
      </section>

      {/* Destination image grid */}
      <section className="landing-trending" id="trending">
        <h2 className="section-title">Trending Destinations</h2>
        <p className="section-subtitle">Handpicked places for your next adventure</p>
        <div className="trending-grid destination-grid">
          {trendingLoading ? (
            <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontWeight: 600 }}>
              Loading...
            </div>
          ) : (
            trendingCards.map((card) => (
            <article key={card.id} className="trending-card glass-card card-hover">
              <div className="trending-card-image">
                <img src={card.image} alt={card.title} />
                <span className="trending-rating">★ {card.rating}</span>
                <div className="trending-card-overlay" />
              </div>
              <div className="trending-card-info">
                <h3>{card.title}</h3>
                <p>{card.location}</p>
              </div>
            </article>
            ))
          )}
        </div>
        <div className="trending-cta">
          <Link to="/register">
            <PrimaryButton variant="cta">Get Started</PrimaryButton>
          </Link>
        </div>
      </section>

      {/* Stats Trust Bar - Glassmorphism */}
      <section className="landing-stats">
        <div className="stats-inner">
          {stats.map((item) => (
            <div key={item.label} className="stat-item glass-stat">
              <span className="stat-value">{item.value}</span>
              <span className="stat-label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="landing-footer">
        <p>Ready to plan your trip?</p>
        <div className="footer-links">
          <Link to="/login">Sign In</Link>
          <Link to="/register">Register</Link>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
