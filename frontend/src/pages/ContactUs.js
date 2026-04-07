import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './ContactUs.css';

const ContactUs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    setSaving(true);
    try {
      await api.post('/contact', { subject, message, category });
      setStatus({ type: 'success', text: 'Your message has been sent to admin.' });
      setSubject('');
      setMessage('');
      setCategory('general');
    } catch (error) {
      const isNetworkError = !error.response;
      setStatus({
        type: 'error',
        text: isNetworkError
          ? 'Backend server is not running. Please start backend and try again.'
          : (error.response?.data?.message || 'Could not send message. Please try again.')
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="contact-us-page">
      <div className="contact-card">
        <div className="contact-header">
          <h1>Contact Us</h1>
          <p>Send your question or issue to admin.</p>
        </div>

        <div className="contact-user-info">
          <span>Name: {user?.name || 'User'}</span>
          <span>Email: {user?.email || 'N/A'}</span>
        </div>

        <div className="contact-links">
          <a
            href="https://wa.me/923177733243"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            WhatsApp: 03177733243
          </a>
          <a
            href="mailto:smarttravelplaneer0120@gmail.com"
            className="btn-secondary"
          >
            Email: smarttravelplaneer0120@gmail.com
          </a>
        </div>

        {status && <div className={`contact-status ${status.type}`}>{status.text}</div>}

        <form onSubmit={handleSubmit} className="contact-form">
          <label>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject"
            required
          />

          <label>Type</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="general">General</option>
            <option value="complaint">Complaint</option>
          </select>

          <label>Message</label>
          <textarea
            rows="6"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue..."
            required
          />

          <div className="contact-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Sending...' : 'Send to Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactUs;
