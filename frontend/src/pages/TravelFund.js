import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './TravelFund.css';

const TravelFund = () => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    setFetchError(null);
    try {
      const response = await api.get('/travel-fund');
      const data = response.data || [];
      const nonBucketListBudgets = data.filter(budget => !budget.isBucketList);
      setBudgets(nonBucketListBudgets);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      setFetchError(error.response?.data?.message || 'Could not load budgets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this budget?')) {
      try {
        await api.delete(`/travel-fund/${id}`);
        fetchBudgets();
      } catch (error) {
        setFetchError(error.response?.data?.message || 'Failed to delete.');
      }
    }
  };

  return (
    <div className="travel-fund">
      <div className="header">
        <h1>Travel Fund</h1>
      </div>
      {fetchError && (
        <div className="page-error-banner">
          <span>{fetchError}</span>
          <button type="button" onClick={() => fetchBudgets()}>Retry</button>
        </div>
      )}
      <div className="content">
        {loading ? (
          <div className="loading">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="empty">
            <p>No saved budgets yet.</p>
            <button className="btn-primary" onClick={() => navigate('/app/money-map')}>Create Budget in Money Map</button>
          </div>
        ) : (
          <div className="budgets-list">
            {budgets.map((budget) => (
              <div key={budget._id} className="budget-card">
                <h3>{budget.destination}</h3>
                <p>{budget.numberOfMembers} members • {budget.days} days • {budget.season}</p>
                <p className="total">Total: Rs {budget.total?.toLocaleString() || 0}</p>
                <button onClick={() => handleDelete(budget._id)} className="delete-btn btn-danger">
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TravelFund;
