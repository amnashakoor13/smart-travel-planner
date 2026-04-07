import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import './MoneyMap.css';

const MoneyMap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [destinations, setDestinations] = useState([]);
  const [calculationMode, setCalculationMode] = useState('ai'); // 'ai', 'realtime', 'manual'
  const [formData, setFormData] = useState({
    destination: '',
    tripDuration: 5,
    numberOfTravelers: 2,
    travelSeason: 'peak'
  });
  const [manualBudget, setManualBudget] = useState({
    accommodation: '',
    transportation: '',
    food: '',
    activities: '',
    miscellaneous: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const [destinationsError, setDestinationsError] = useState(null);
  const [calcError, setCalcError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState('');
  const [aiInsights, setAiInsights] = useState('');
  const [tripStartDate, setTripStartDate] = useState('');

  useEffect(() => {
    fetchDestinations();
  }, []);

  useEffect(() => {
    const destination = searchParams.get('destination') || '';
    const days = Number(searchParams.get('days'));
    const members = Number(searchParams.get('members'));
    const season = searchParams.get('season') || '';

    if (!destination && !days && !members && !season) return;

    setFormData((prev) => ({
      ...prev,
      destination: destination || prev.destination,
      tripDuration: Number.isFinite(days) && days > 0 ? days : prev.tripDuration,
      numberOfTravelers: Number.isFinite(members) && members > 0 ? members : prev.numberOfTravelers,
      travelSeason: season || prev.travelSeason
    }));
  }, [searchParams]);

  const fetchDestinations = async () => {
    setDestinationsError(null);
    setDestinationsLoading(true);
    try {
      const response = await api.get('/travel-hub');
      setDestinations(response.data || []);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      setDestinationsError(error.response?.data?.message || 'Could not load destinations.');
    } finally {
      setDestinationsLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleManualChange = (e) => {
    const { name, value } = e.target;
    setManualBudget({ ...manualBudget, [name]: value });
    // Auto-calculate total when manual values change
    calculateManualTotal();
  };

  const calculateManualTotal = () => {
    const total = 
      (parseFloat(manualBudget.accommodation) || 0) +
      (parseFloat(manualBudget.transportation) || 0) +
      (parseFloat(manualBudget.food) || 0) +
      (parseFloat(manualBudget.activities) || 0) +
      (parseFloat(manualBudget.miscellaneous) || 0);
    return total;
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    
    // If manual mode, use manual values
    if (calculationMode === 'manual') {
      const total = calculateManualTotal();
      setResult({
        breakdown: {
          accommodation: parseFloat(manualBudget.accommodation) || 0,
          transportation: parseFloat(manualBudget.transportation) || 0,
          food: parseFloat(manualBudget.food) || 0,
          activities: parseFloat(manualBudget.activities) || 0,
          miscellaneous: parseFloat(manualBudget.miscellaneous) || 0,
          total: total
        },
        isManual: true
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/money-map/calculate', {
        destination: formData.destination,
        numberOfMembers: parseInt(formData.numberOfTravelers),
        days: parseInt(formData.tripDuration),
        season: formData.travelSeason,
        useRealTimePricing: calculationMode === 'realtime'
      });
      setResult(response.data);
      setCalcError(null);
      setAiRecommendations(response.data.recommendations || '');
      setAiInsights(response.data.insights || '');
      
      // Pre-fill manual inputs with calculated values
      if (response.data.breakdown) {
        setManualBudget({
          accommodation: response.data.breakdown.accommodation || '',
          transportation: response.data.breakdown.transportation || '',
          food: response.data.breakdown.food || '',
          activities: response.data.breakdown.activities || '',
          miscellaneous: response.data.breakdown.miscellaneous || ''
        });
      }
    } catch (error) {
      console.error('Error calculating budget:', error);
      setCalcError(error.response?.data?.message || 'Error calculating budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCalculated = () => {
    if (result && result.breakdown) {
      setManualBudget({
        accommodation: result.breakdown.accommodation || '',
        transportation: result.breakdown.transportation || '',
        food: result.breakdown.food || '',
        activities: result.breakdown.activities || '',
        miscellaneous: result.breakdown.miscellaneous || ''
      });
      setCalculationMode('manual');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    
    let breakdown;
    let total;
    
    if (calculationMode === 'manual') {
      total = calculateManualTotal();
      breakdown = {
        accommodation: parseFloat(manualBudget.accommodation) || 0,
        transportation: parseFloat(manualBudget.transportation) || 0,
        food: parseFloat(manualBudget.food) || 0,
        activities: parseFloat(manualBudget.activities) || 0,
        miscellaneous: parseFloat(manualBudget.miscellaneous) || 0,
        total: total
      };
    } else {
      breakdown = result.breakdown;
      total = result.breakdown.total;
    }

    try {
      await api.post('/money-map/save', {
        destination: formData.destination,
        numberOfMembers: parseInt(formData.numberOfTravelers),
        days: parseInt(formData.tripDuration),
        season: formData.travelSeason,
        breakdown: breakdown,
        total: total,
        isManual: calculationMode === 'manual',
        startDate: tripStartDate || undefined
      });
      setSaveMessage({ type: 'success', text: 'Budget saved to Travel Fund!' });
      setTimeout(() => navigate('/app/travel-fund'), 1500);
    } catch (error) {
      console.error('Error saving budget:', error);
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Error saving budget. Please try again.' });
    }
  };

  const calculateEstimatedCosts = () => {
    if (calculationMode === 'manual') {
      const total = calculateManualTotal();
      return {
        accommodation: parseFloat(manualBudget.accommodation) || 0,
        transportation: parseFloat(manualBudget.transportation) || 0,
        food: parseFloat(manualBudget.food) || 0,
        activities: parseFloat(manualBudget.activities) || 0,
        miscellaneous: parseFloat(manualBudget.miscellaneous) || 0,
        total: total
      };
    }
    
    if (!result) return null;
    return result.breakdown || {};
  };

  const estimatedCosts = calculateEstimatedCosts();

  return (
    <div className="money-map">
      <div className="header">
        <h1>Map Your Money with Our Calculator</h1>
        <p className="subtitle">
          Choose calculation method: AI Estimate, Real-time Google Pricing, or Manual Entry
        </p>
      </div>
      
      <div className="content">
        {destinationsError && (
          <div className="page-error-banner">
            <span>{destinationsError}</span>
            <button type="button" onClick={() => fetchDestinations()}>Retry</button>
          </div>
        )}
        {destinationsLoading && <p className="loading-inline">Loading destinations...</p>}
        {!destinationsLoading && destinations.length === 0 && !destinationsError && (
          <p className="empty-inline">No destinations available. Add destinations in Travel Hub or Admin.</p>
        )}
        {saveMessage && (
          <div className={saveMessage.type === 'success' ? 'success-message' : 'page-error-banner'}>
            {saveMessage.text}
          </div>
        )}
        <div className="budget-container">
          {/* Left Panel - Input Fields */}
          <div className="input-panel">
            {/* Calculation Mode Toggle */}
            <div className="calculation-mode-section">
              <h3>Calculation Method</h3>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-btn ${calculationMode === 'ai' ? 'active' : ''}`}
                  onClick={() => setCalculationMode('ai')}
                >
                  🤖 AI Estimate
                </button>
                <button
                  type="button"
                  className={`mode-btn ${calculationMode === 'realtime' ? 'active' : ''}`}
                  onClick={() => setCalculationMode('realtime')}
                >
                  📍 Real-time Google Pricing
                </button>
                <button
                  type="button"
                  className={`mode-btn ${calculationMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setCalculationMode('manual')}
                >
                  ✏️ Manual Entry
                </button>
              </div>
            </div>

            <form onSubmit={handleCalculate}>
              <div className="section">
                <h3>Trip Details</h3>
                <div className="form-group">
                  <label>Number of Trip Members</label>
                  <input
                    type="number"
                    name="numberOfTravelers"
                    value={formData.numberOfTravelers}
                    onChange={handleChange}
                    min="1"
                    required
                    placeholder="Enter number of travelers"
                  />
                </div>
                <div className="form-group">
                  <label>Number of Days</label>
                  <input
                    type="number"
                    name="tripDuration"
                    value={formData.tripDuration}
                    onChange={handleChange}
                    min="1"
                    required
                    placeholder="Enter trip duration"
                  />
                </div>
                <div className="form-group">
                  <label>Season</label>
                  <select
                    name="travelSeason"
                    value={formData.travelSeason}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Season</option>
                    <option value="peak">Peak Season</option>
                    <option value="off-peak">Off-Peak Season</option>
                    <option value="shoulder">Shoulder Season</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Destination</label>
                  <select
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Destination</option>
                    {destinations.map((dest) => (
                      <option key={dest._id} value={dest.name}>
                        {dest.name}, {dest.city}
                      </option>
                    ))}
                  </select>
                  {destinationsError && <p className="field-hint error">Load destinations failed. Click Retry above.</p>}
                </div>
                <div className="form-group">
                  <label>When (Trip Start Date)</label>
                  <input
                    type="date"
                    value={tripStartDate}
                    onChange={(e) => setTripStartDate(e.target.value)}
                  />
                </div>
              </div>

              {calcError && <div className="page-error-banner" style={{ marginTop: 8 }}><span>{calcError}</span></div>}

              {/* Manual Budget Inputs */}
              {calculationMode === 'manual' && (
                <div className="section manual-budget-section">
                  <h3>Enter Budget Manually (PKR)</h3>
                  <div className="form-group">
                    <label>Accommodation</label>
                    <input
                      type="number"
                      name="accommodation"
                      value={manualBudget.accommodation}
                      onChange={handleManualChange}
                      min="0"
                      placeholder="Enter accommodation cost"
                    />
                  </div>
                  <div className="form-group">
                    <label>Transportation</label>
                    <input
                      type="number"
                      name="transportation"
                      value={manualBudget.transportation}
                      onChange={handleManualChange}
                      min="0"
                      placeholder="Enter transportation cost"
                    />
                  </div>
                  <div className="form-group">
                    <label>Food & Dining</label>
                    <input
                      type="number"
                      name="food"
                      value={manualBudget.food}
                      onChange={handleManualChange}
                      min="0"
                      placeholder="Enter food cost"
                    />
                  </div>
                  <div className="form-group">
                    <label>Activities</label>
                    <input
                      type="number"
                      name="activities"
                      value={manualBudget.activities}
                      onChange={handleManualChange}
                      min="0"
                      placeholder="Enter activities cost"
                    />
                  </div>
                  <div className="form-group">
                    <label>Miscellaneous</label>
                    <input
                      type="number"
                      name="miscellaneous"
                      value={manualBudget.miscellaneous}
                      onChange={handleManualChange}
                      min="0"
                      placeholder="Enter miscellaneous cost"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="calculate-btn"
              >
                {loading 
                  ? (calculationMode === 'realtime' 
                      ? '⏳ Fetching Real-time Prices...' 
                      : '⏳ Calculating with AI...')
                  : calculationMode === 'manual'
                  ? '💰 Calculate Total'
                  : '💰 Calculate Budget'
                }
              </button>
            </form>
          </div>

          {/* Right Panel - Budget Summary */}
          <div className="summary-panel">
            <h2>Budget Summary</h2>
            <div className="summary-list">
              <div className="summary-item">
                <span>Accommodation</span>
                <span className="amount">PKR {estimatedCosts?.accommodation || 0}</span>
              </div>
              <div className="summary-item">
                <span>Transportation</span>
                <span className="amount">PKR {estimatedCosts?.transportation || 0}</span>
              </div>
              <div className="summary-item">
                <span>Food & Dining</span>
                <span className="amount">PKR {estimatedCosts?.food || 0}</span>
              </div>
              <div className="summary-item">
                <span>Activities</span>
                <span className="amount">PKR {estimatedCosts?.activities || 0}</span>
              </div>
              <div className="summary-item">
                <span>Miscellaneous</span>
                <span className="amount">PKR {estimatedCosts?.miscellaneous || 0}</span>
              </div>
            </div>
            <div className="total-section">
              <div className="total-label">Total Estimated Cost:</div>
              <div className="total-amount">PKR {estimatedCosts?.total || 0}</div>
            </div>

            {result && calculationMode !== 'manual' && (
              <div className="cost-breakdown">
                <h3>Cost Breakdown</h3>
                <div className="breakdown-item">
                  <span>Accommodation</span>
                  <span>PKR {estimatedCosts?.accommodation || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Transportation</span>
                  <span>PKR {estimatedCosts?.transportation || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Food & Dining</span>
                  <span>PKR {estimatedCosts?.food || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Activities</span>
                  <span>PKR {estimatedCosts?.activities || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Miscellaneous</span>
                  <span>PKR {estimatedCosts?.miscellaneous || 0}</span>
                </div>

                {/* Edit Button */}
                <button onClick={handleEditCalculated} className="edit-btn">
                  ✏️ Edit Values Manually
                </button>

                {/* AI Recommendations */}
                {result.aiPowered && (
                  <div className="ai-section">
                    {aiInsights && (
                      <div className="ai-insights">
                        <h4>🤖 AI Insights</h4>
                        <p>{aiInsights}</p>
                      </div>
                    )}
                    {aiRecommendations && (
                      <div className="ai-recommendations">
                        <h4>💡 Money-Saving Tips</h4>
                        <p>{aiRecommendations}</p>
                      </div>
                    )}
                    <div className="ai-badge">
                      ✨ Powered by AI
                    </div>
                  </div>
                )}

                {/* Real-time Pricing Badge */}
                {result.realTimePricing && (
                  <div className="realtime-badge">
                    📍 Real-time Google Pricing
                  </div>
                )}
              </div>
            )}

            {calculationMode === 'manual' && estimatedCosts && (
              <div className="cost-breakdown">
                <h3>Manual Budget Summary</h3>
                <div className="breakdown-item">
                  <span>Accommodation</span>
                  <span>PKR {estimatedCosts.accommodation || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Transportation</span>
                  <span>PKR {estimatedCosts.transportation || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Food & Dining</span>
                  <span>PKR {estimatedCosts.food || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Activities</span>
                  <span>PKR {estimatedCosts.activities || 0}</span>
                </div>
                <div className="breakdown-item">
                  <span>Miscellaneous</span>
                  <span>PKR {estimatedCosts.miscellaneous || 0}</span>
                </div>
              </div>
            )}

            {(result || calculationMode === 'manual') && (
              <button onClick={handleSave} className="save-btn">
                💾 Save to Travel Fund
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoneyMap;
