import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TravelHub from './pages/TravelHub';
import PlacesToStay from './pages/PlacesToStay';
import MoneyMap from './pages/MoneyMap';
import TravelFund from './pages/TravelFund';
import TravelMap from './pages/TravelMap';
import BuddyBot from './pages/BuddyBot';
import Weather from './pages/Weather';
import AdminPanel from './pages/AdminPanel';
import BucketList from './pages/BucketList';
import TravelHistory from './pages/TravelHistory';
import CommunityBlog from './pages/CommunityBlog';
import Profile from './pages/Profile';
import ContactUs from './pages/ContactUs';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/app"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="travel-hub" element={<TravelHub />} />
            <Route path="places-to-stay" element={<PlacesToStay />} />
            <Route path="money-map" element={<MoneyMap />} />
            <Route path="travel-fund" element={<TravelFund />} />
            <Route path="bucket-list" element={<BucketList />} />
            <Route path="travel-history" element={<TravelHistory />} />
            <Route path="community-blog" element={<CommunityBlog />} />
            <Route path="travel-map" element={<TravelMap />} />
            <Route path="buddy-bot" element={<BuddyBot />} />
            <Route path="weather" element={<Weather />} />
            <Route path="profile" element={<Profile />} />
            <Route path="contact-us" element={<ContactUs />} />
            <Route
              path="admin"
              element={
                <PrivateRoute adminOnly>
                  <AdminPanel />
                </PrivateRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
