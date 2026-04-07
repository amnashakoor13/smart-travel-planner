import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Profile.css';

const TRAVEL_STYLES = ['Adventure', 'Cultural', 'Relaxation', 'Luxury', 'Budget'];
const ACCOMMODATION_TYPES = ['Hotels', 'Guest Houses', 'Homestays', 'Camping', 'Resorts'];
const INTERESTS = ['Hiking', 'Photography', 'Local Cuisine', 'History', 'Wildlife', 'Shopping'];
const BUDGET_RANGES = ['Budget', 'Moderate', 'Luxury'];

const Profile = () => {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ destinationsVisited: 0, tripsPlanned: 0, photosUploaded: 0, reviewsWritten: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    contactNumber: '',
    bio: '',
    location: ''
  });
  const [prefs, setPrefs] = useState({
    travelStyle: '',
    accommodationType: '',
    interests: [],
    budgetRange: '',
    notificationEmail: true,
    notificationSMS: false,
    notificationPush: true,
    weeklyDigest: true
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setFetchError(null);
      try {
        const res = await api.get('/auth/profile');
        const u = res.data;
        setProfile(u);
        setForm({
          name: u.name || '',
          contactNumber: u.contactNumber || '',
          bio: u.bio || '',
          location: u.location || ''
        });
        const p = u.preferences && typeof u.preferences === 'object' ? u.preferences : {};
        setPrefs({
          travelStyle: p.travelStyle || '',
          accommodationType: p.accommodationType || '',
          interests: Array.isArray(p.interests) ? p.interests : (p.interests ? [p.interests] : []),
          budgetRange: p.budgetRange || '',
          notificationEmail: p.notificationEmail !== undefined ? Boolean(p.notificationEmail) : true,
          notificationSMS: p.notificationSMS !== undefined ? Boolean(p.notificationSMS) : false,
          notificationPush: p.notificationPush !== undefined ? Boolean(p.notificationPush) : true,
          weeklyDigest: p.weeklyDigest !== undefined ? Boolean(p.weeklyDigest) : true
        });
      } catch (err) {
        console.error(err);
        setFetchError(err.response?.data?.message || 'Could not load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    const fetchStats = async () => {
      try {
        const [budgetsRes, bucketRes, myPostsRes] = await Promise.all([
          api.get('/travel-fund').catch(() => ({ data: [] })),
          api.get('/travel-fund/bucket-list').catch(() => ({ data: [] })),
          api.get('/community-posts/mine').catch(() => ({ data: [] }))
        ]);
        const budgets = budgetsRes.data || [];
        const bucket = bucketRes.data || [];
        const myPosts = Array.isArray(myPostsRes.data) ? myPostsRes.data : [];
        const allTrips = [...budgets, ...bucket];
        const destinationsVisited = new Set(allTrips.map((t) => t.destination).filter(Boolean)).size;
        const photosUploaded = myPosts.reduce((sum, post) => sum + (Array.isArray(post.images) ? post.images.length : 0), 0);
        const reviewsWritten = myPosts.length;
        setStats({
          destinationsVisited,
          tripsPlanned: budgets.length + bucket.length,
          photosUploaded,
          reviewsWritten
        });
      } catch (_) {}
    };
    fetchProfile();
    fetchStats();
  }, []);

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.put('/auth/profile', form);
      setMessage('Personal information saved.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrefs = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.put('/auth/profile', {
        travelStyle: prefs.travelStyle,
        accommodationType: prefs.accommodationType,
        interests: prefs.interests,
        budgetRange: prefs.budgetRange,
        notificationEmail: prefs.notificationEmail,
        notificationSMS: prefs.notificationSMS,
        notificationPush: prefs.notificationPush,
        weeklyDigest: prefs.weeklyDigest
      });
      setMessage('Preferences updated.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (item) => {
    setPrefs((prev) => ({
      ...prev,
      interests: prev.interests.includes(item)
        ? prev.interests.filter((i) => i !== item)
        : [...prev.interests, item]
    }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage('Password updated successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Could not update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : new Date().getFullYear();

  if (loading && !profile) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {fetchError && (
        <div className="page-error-banner">
          <span>{fetchError}</span>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
      <div className="profile-banner">
        <div className="profile-avatar">{authUser?.name?.charAt(0) || profile?.name?.charAt(0) || 'U'}</div>
        <div className="profile-banner-info">
          <h1 className="profile-name">{(profile?.name || authUser?.name || '').toLowerCase()}</h1>
          <p className="profile-tagline">{profile?.bio || 'Adventure Seeker & Travel Enthusiast'}</p>
          <div className="profile-meta">
            <span>📍 {profile?.location || 'Pakistan'}</span>
            <span>📅 Member since {memberSince}</span>
          </div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <span className="stat-icon">🏛️</span>
          <span className="stat-value">{stats.destinationsVisited}</span>
          <span className="stat-label">Destinations Visited</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🗺️</span>
          <span className="stat-value">{stats.tripsPlanned}</span>
          <span className="stat-label">Trips Planned</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📷</span>
          <span className="stat-value">{stats.photosUploaded}</span>
          <span className="stat-label">Photos Uploaded</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⭐</span>
          <span className="stat-value">{stats.reviewsWritten}</span>
          <span className="stat-label">Reviews Written</span>
        </div>
      </div>

      {message && <div className="profile-message">{message}</div>}

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Personal Information</h2>
          <form onSubmit={handleSavePersonal}>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  value={(form.name || '').split(' ')[0] || ''}
                  onChange={(e) => {
                    const last = (form.name || '').split(' ').slice(1).join(' ');
                    setForm((f) => ({ ...f, name: (e.target.value + (last ? ' ' + last : '')).trim() }));
                  }}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  value={(form.name || '').split(' ').slice(1).join(' ') || ''}
                  onChange={(e) => {
                    const first = (form.name || '').split(' ')[0] || '';
                    setForm((f) => ({ ...f, name: (first + (e.target.value ? ' ' + e.target.value : '')).trim() }));
                  }}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={profile?.email || ''} readOnly disabled className="read-only" />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={form.contactNumber}
                  onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                  placeholder="+92 300 1234567"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Islamabad, Pakistan"
              />
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="I love exploring..."
                rows={4}
              />
            </div>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        <section className="profile-card">
          <h2>Travel Preferences</h2>
          <form onSubmit={handleUpdatePrefs}>
            <div className="pref-group">
              <label>Travel Style</label>
              <div className="pref-buttons">
                {TRAVEL_STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pref-btn ${prefs.travelStyle === s ? 'active' : ''}`}
                    onClick={() => setPrefs((p) => ({ ...p, travelStyle: s }))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="pref-group">
              <label>Accommodation Type</label>
              <div className="pref-buttons">
                {ACCOMMODATION_TYPES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`pref-btn ${prefs.accommodationType === a ? 'active' : ''}`}
                    onClick={() => setPrefs((p) => ({ ...p, accommodationType: a }))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="pref-group">
              <label>Interests</label>
              <div className="pref-buttons">
                {INTERESTS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    className={`pref-btn ${prefs.interests.includes(i) ? 'active' : ''}`}
                    onClick={() => toggleInterest(i)}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="pref-group">
              <label>Budget Range</label>
              <div className="pref-buttons">
                {BUDGET_RANGES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`pref-btn ${prefs.budgetRange === b ? 'active' : ''}`}
                    onClick={() => setPrefs((p) => ({ ...p, budgetRange: b }))}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="pref-group">
              <label>Notification Settings</label>
              <div className="notification-options">
                <label className="notif-option">
                  <input
                    type="checkbox"
                    checked={prefs.notificationEmail}
                    onChange={(e) => setPrefs((p) => ({ ...p, notificationEmail: e.target.checked }))}
                  />
                  <span>Email notifications</span>
                </label>
                <label className="notif-option">
                  <input
                    type="checkbox"
                    checked={prefs.notificationSMS}
                    onChange={(e) => setPrefs((p) => ({ ...p, notificationSMS: e.target.checked }))}
                  />
                  <span>SMS notifications</span>
                </label>
                <label className="notif-option">
                  <input
                    type="checkbox"
                    checked={prefs.notificationPush}
                    onChange={(e) => setPrefs((p) => ({ ...p, notificationPush: e.target.checked }))}
                  />
                  <span>Push notifications</span>
                </label>
                <label className="notif-option">
                  <input
                    type="checkbox"
                    checked={prefs.weeklyDigest}
                    onChange={(e) => setPrefs((p) => ({ ...p, weeklyDigest: e.target.checked }))}
                  />
                  <span>Weekly travel digest</span>
                </label>
              </div>
            </div>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Updating...' : 'Update Preferences'}
            </button>
          </form>
        </section>
      </div>

      <section className="profile-card account-management">
        <h2>Change password</h2>
        <p className="account-hint">Use your current password, then enter a new one.</p>
        {passwordError && <div className="profile-password-error">{passwordError}</div>}
        {passwordMessage && <div className="profile-password-success">{passwordMessage}</div>}
        <form onSubmit={handleChangePassword} className="password-change-form">
          <div className="form-group">
            <label htmlFor="profile-current-password">Current password</label>
            <input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
              }
              placeholder="Enter current password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-new-password">New password</label>
            <input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
              }
              placeholder="At least 6 characters"
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile-confirm-password">Confirm new password</label>
            <input
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
              placeholder="Repeat new password"
            />
          </div>
          <button type="submit" className="btn-save" disabled={passwordSaving}>
            {passwordSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <h2 className="account-danger-title">Account</h2>
        <div className="account-buttons">
          <button
            type="button"
            className="btn-account btn-danger"
            onClick={() =>
              window.confirm('Delete account? This cannot be undone.') &&
              setMessage('Account deletion must be done via support.')
            }
          >
            Delete Account
          </button>
        </div>
      </section>
    </div>
  );
};

export default Profile;
