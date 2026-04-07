import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\s\-\+\(\)]{10,16}$/;
    if (!formData.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!formData.contactNumber.trim()) {
      setError('Please enter your contact number.');
      return;
    }
    if (!phoneRegex.test(formData.contactNumber.replace(/\s/g, ''))) {
      setError('Please enter a valid contact number (10–16 digits).');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      const response = await api.post('/auth/register', registerData);
      login(response.data.user, response.data.token);
      navigate(response.data.user.role === 'admin' ? '/app/admin' : '/app/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background" />
      <div className="login-content">
        <div className="login-left">
          <div className="login-form-container login-form-container--register">
            <h1 className="login-title">Smart Travel Buddy</h1>
            <h2 className="login-subtitle">Create Your Account</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="login-form auth-form-fields">
              <div className="form-group">
                <input
                  type="text"
                  name="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
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
                  type="tel"
                  name="contactNumber"
                  placeholder="Contact number"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password (min 6 characters)"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </button>
              <div className="register-link">
                <p>Already have an account? <Link to="/login">Login here</Link></p>
                <p style={{ marginTop: 12 }}>
                  <Link to="/" className="back-home-link">Back to Home</Link>
                </p>
              </div>
            </form>
          </div>
        </div>
        <div className="login-right">
          <div className="quote-container">
            <p className="quote-text">YOUR NEXT ADVENTURE STARTS WITH A SINGLE STEP.</p>
            <div className="social-icons">
              <a href="https://wa.me/923177733243" target="_blank" rel="noopener noreferrer" className="social-icon social-icon--whatsapp" aria-label="WhatsApp"><span>W</span></a>
              <a href="mailto:smarttravelplaneer0120@gmail.com" className="social-icon social-icon--email" aria-label="Email"><span>@</span></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
