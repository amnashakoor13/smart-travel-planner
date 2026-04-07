const express = require('express');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const travelHubRoutes = require('./routes/travelHubRoutes');
const placesToStayRoutes = require('./routes/placesToStayRoutes');
const moneyMapRoutes = require('./routes/moneyMapRoutes');
const travelFundRoutes = require('./routes/travelFundRoutes');
const travelMapRoutes = require('./routes/travelMapRoutes');
const buddyBotRoutes = require('./routes/buddyBotRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');
const communityPostRoutes = require('./routes/communityPostRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve uploaded place images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/travel-hub', travelHubRoutes);
app.use('/api/places-to-stay', placesToStayRoutes);
app.use('/api/money-map', moneyMapRoutes);
app.use('/api/travel-fund', travelFundRoutes);
app.use('/api/travel-map', travelMapRoutes);
app.use('/api/buddy-bot', buddyBotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/community-posts', communityPostRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

module.exports = app;
