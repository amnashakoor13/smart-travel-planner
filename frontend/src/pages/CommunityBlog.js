import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './CommunityBlog.css';

const CommunityBlog = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    placeName: '',
    category: 'place',
    rating: 5,
    review: '',
  });
  const [images, setImages] = useState([]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/community-posts');
      setPosts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load community posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.placeName.trim() || !form.review.trim()) {
      setError('Place/hotel name and review are required.');
      return;
    }
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('placeName', form.placeName.trim());
      fd.append('category', form.category);
      fd.append('rating', String(form.rating));
      fd.append('review', form.review.trim());
      images.forEach((file) => fd.append('images', file));

      await api.post('/community-posts', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setForm({ placeName: '', category: 'place', rating: 5, review: '' });
      setImages([]);
      if (!isAdmin) {
        setError('Post submitted. It will be visible after admin approval.');
      }
      await loadPosts();
    } catch (e2) {
      setError(e2.response?.data?.message || 'Failed to publish post.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/community-posts/${id}/approve`);
      await loadPosts();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to approve post.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/community-posts/${id}`);
      await loadPosts();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete post.');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.patch(`/community-posts/${id}/reject`);
      await loadPosts();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to reject post.');
    }
  };

  return (
    <div className="community-blog-page">
      <section className="blog-create-card">
        <h1>Community Blog & Reviews</h1>
        <p>Share your place and hotel experiences with ratings and photos.</p>
        {error && <div className="page-error-banner"><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="blog-form">
          <input
            type="text"
            placeholder="Place or hotel name"
            value={form.placeName}
            onChange={(e) => setForm((f) => ({ ...f, placeName: e.target.value }))}
          />
          <div className="blog-form-row">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="place">Place</option>
              <option value="hotel">Hotel</option>
            </select>
            <select
              value={form.rating}
              onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}
            >
              <option value={5}>5 - Excellent</option>
              <option value={4}>4 - Good</option>
              <option value={3}>3 - Average</option>
              <option value={2}>2 - Poor</option>
              <option value={1}>1 - Bad</option>
            </select>
          </div>
          <textarea
            rows={4}
            placeholder="Write your review..."
            value={form.review}
            onChange={(e) => setForm((f) => ({ ...f, review: e.target.value }))}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(Array.from(e.target.files || []).slice(0, 6))}
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Publishing...' : 'Publish Review'}
          </button>
        </form>
      </section>

      <section className="blog-feed">
        <h2>All Travelers Reviews</h2>
        {loading ? (
          <div className="blog-loading">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="blog-loading">No posts yet. Be the first to share.</div>
        ) : (
          <div className="blog-grid">
            {posts.map((post) => (
              <article key={post._id} className="blog-post-card">
                <div className="blog-post-top">
                  <h3>{post.placeName}</h3>
                  <span className="blog-rating">⭐ {post.rating}/5</span>
                </div>
                <div className="blog-meta">
                  <span>{post.authorName}</span>
                  <span>{post.category === 'hotel' ? 'Hotel' : 'Place'}</span>
                  <span className={`post-status post-status--${post.status || 'pending'}`}>
                    {post.status || 'pending'}
                  </span>
                </div>
                <p>{post.review}</p>
                {Array.isArray(post.images) && post.images.length > 0 && (
                  <div className="blog-images">
                    {post.images.map((img, idx) => (
                      <img key={`${post._id}-${idx}`} src={`${api.defaults.baseURL.replace('/api', '')}${img}`} alt="review" />
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <div className="blog-admin-actions">
                    {post.status !== 'approved' && (
                      <button type="button" className="btn-primary" onClick={() => handleApprove(post._id)}>
                        Approve
                      </button>
                    )}
                    {post.status !== 'rejected' && (
                      <button type="button" className="btn-danger" onClick={() => handleReject(post._id)}>
                        Reject
                      </button>
                    )}
                    <button type="button" className="btn-danger" onClick={() => handleDelete(post._id)}>
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CommunityBlog;
