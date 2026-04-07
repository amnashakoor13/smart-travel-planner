import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.redirect || '/app/dashboard';
  const searchState = location.state?.search;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!formData.password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/login', formData);
      login(response.data.user, response.data.token);
      const to = response.data.user.role === 'admin' ? '/app/admin' : from;
      const path = (to === '/app/travel-hub' && searchState?.destination)
        ? `${to}?search=${encodeURIComponent(searchState.destination)}`
        : to;
      navigate(path);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background"></div>
      <div className="login-content">
        <div className="login-left">
          <div className="login-form-container">
            <h1 className="login-title">Smart Travel Buddy</h1>
            <h2 className="login-subtitle">Login to Your Account</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
              </div>
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <div className="register-link">
                <p>
                  Don't have an account? <Link to="/register">Register here</Link>
                </p>
                <p style={{ marginTop: 12 }}>
                  <Link to="/" className="back-home-link">Back to Home</Link>
                </p>
              </div>
            </form>
          </div>
        </div>
        <div className="login-right">
          <div className="quote-container">
            <p className="quote-text">THE GOAL OF LIFE IS LIVING IN AGREEMENT WITH NATURE.</p>
            <div className="social-icons">
              <a
                href="https://wa.me/923177733243"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon social-icon--whatsapp"
                aria-label="WhatsApp"
              >
                <span>W</span>
              </a>
              <a
                href="mailto:smarttravelplaneer0120@gmail.com"
                className="social-icon social-icon--email"
                aria-label="Email"
              >
                <span>@</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
