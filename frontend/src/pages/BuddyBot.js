import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './BuddyBot.css';

const BuddyBot = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [responseLanguage, setResponseLanguage] = useState('easy_english');
  const messagesEndRef = useRef(null);

  const predefinedQuestions = [
    { text: 'Best time to visit Hunza?', icon: '📅' },
    { text: 'Hotels in Swat Valley?', icon: '🏨' },
    { text: 'Budget for Skardu trip?', icon: '💰' },
    { text: 'Weather in Fairy Meadows?', icon: '🌤️' },
    { text: 'Travel requirements?', icon: '📄' },
    { text: 'Local food recommendations?', icon: '🍽️' }
  ];

  useEffect(() => {
    fetchConversation();
    // Add welcome message if no messages
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hello! I'm your TravelBuddy AI assistant. I can help you with:

• Destination recommendations
• Accommodation options
• Budget planning
• Weather information
• Travel tips and advice

How can I help you plan your trip today?`
      }]);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format message content with styling
  const formatMessage = (content) => {
    if (!content) return { __html: content || '' };
    
    let formatted = content;
    
    // Split by double newlines first to preserve paragraphs
    const paragraphs = formatted.split(/\n\n+/);
    
    formatted = paragraphs.map(para => {
      if (!para.trim()) return '';
      
      let p = para.trim();
      
      // Format Day headings (Day 1:, Day 2:, etc.)
      p = p.replace(/Day\s+(\d+):\s*([^\n]+)/gi, '<div class="day-heading">Day $1: $2</div>');
      
      // Format section headings (Morning:, Afternoon:, Evening:, etc.)
      p = p.replace(/(Morning|Afternoon|Evening|Late Morning|Late Afternoon|Night):/gi, '<div class="time-heading">$1:</div>');
      
      // Format tips section
      p = p.replace(/(Quick Tips|Tips|Tip|Important|Note):/gi, '<div class="tips-heading">$1:</div>');
      
      // Format list items (lines starting with •, -, or numbers)
      p = p.replace(/^[\s]*[•\-\*]\s+(.+)$/gm, '<div class="list-item">$1</div>');
      p = p.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<div class="list-item-numbered">$2</div>');
      
      // Format bold text patterns
      p = p.replace(/\*\*([^*]+)\*\*/g, '<strong class="highlight-bold">$1</strong>');
      
      // Format activities (lines with **Activity:** pattern)
      p = p.replace(/\*\*([^:]+):\*\*/g, '<span class="activity-label">$1:</span>');
      
      // Format locations (text in parentheses or brackets)
      p = p.replace(/\(([^)]+)\)/g, '<span class="location-text">($1)</span>');
      
      // Format single newlines within paragraph
      p = p.replace(/\n/g, '<br/>');
      
      // Wrap in paragraph div if not already a heading/list
      if (!p.includes('day-heading') && !p.includes('time-heading') && !p.includes('tips-heading') && !p.includes('list-item')) {
        p = `<div class="message-paragraph">${p}</div>`;
      }
      
      return p;
    }).filter(p => p).join('');
    
    return { __html: formatted };
  };

  const fetchConversation = async () => {
    try {
      const response = await api.get('/buddy-bot/conversation');
      if (response.data.messages && response.data.messages.length > 0) {
        setMessages(response.data.messages);
      }
      const savedLanguage = response.data?.preferences?.language;
      if (typeof savedLanguage === 'string' && savedLanguage.trim()) {
        setResponseLanguage(savedLanguage.toLowerCase());
      }
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      setLoadError(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load conversation. Please try again.'
      );
    }
  };

  const handlePredefinedQuestion = (question) => {
    setInput(question);
    handleSendMessage(question);
  };

  const handleSendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = messageText;
    setInput('');
    setLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await api.post('/buddy-bot/message', {
        message: userMessage,
        language: responseLanguage
      });
      if (response.data && response.data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Handle authentication errors
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || 'Your session has expired.';
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `${errorMessage} Please log out and log in again to continue.` 
        }]);
        // Optionally redirect to login after a delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
        return;
      }
      
      // Handle other errors
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Sorry, I encountered an error. Please try again.';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I'm having trouble connecting right now. ${errorMessage} Please check your connection and try again.` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="buddy-bot">
      <div className="header">
        <div className="header-content">
          <h1>TravelBuddy AI Assistant</h1>
          <p className="subtitle">Get instant answers to your travel questions and personalized recommendations</p>
        </div>
      </div>

      <div className="chat-layout">
        {/* Left Sidebar */}
        <div className="sidebar">
          <div className="assistant-info">
            <div className="assistant-icon">🤖</div>
            <div className="assistant-name">Travel Assistant</div>
            <div className="assistant-tag">AI-Powered Help</div>
          </div>
          <div className="predefined-questions">
            {predefinedQuestions.map((question, index) => (
              <button
                key={index}
                className="question-btn"
                onClick={() => handlePredefinedQuestion(question.text)}
                disabled={loading}
              >
                <span className="question-icon">{question.icon}</span>
                <span className="question-text">{question.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-icon">🤖</div>
              <div>
                <div className="chat-title">TravelBuddy AI</div>
                <div className="chat-status">Online - Ready to help</div>
              </div>
            </div>
            <div className="chat-language-selector">
              <label htmlFor="buddy-language-select">Language</label>
              <select
                id="buddy-language-select"
                value={responseLanguage}
                onChange={(e) => setResponseLanguage(e.target.value)}
                disabled={loading}
              >
                <option value="easy_english">Easy English</option>
                <option value="roman_english">Roman English</option>
                <option value="urdu">Urdu</option>
              </select>
            </div>
          </div>
          {loadError && (
            <div className="page-error-banner" style={{ margin: '8px 16px' }}>
              <span>{loadError}</span>
              <button type="button" onClick={() => fetchConversation()}>Retry</button>
            </div>
          )}

          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div 
                  className="message-content"
                  dangerouslySetInnerHTML={msg.role === 'assistant' ? formatMessage(msg.content) : { __html: msg.content }}
                />
                {index === messages.length - 1 && msg.role === 'assistant' && (
                  <div className="message-time">Just now</div>
                )}
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="message-content">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question here...."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} className="send-btn">
              {loading ? '⏳' : '📤'} Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BuddyBot;
