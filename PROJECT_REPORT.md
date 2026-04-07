lologin faild # Smart Travel Planner - Project Report

## Project Overview
Smart Travel Planner is a MERN-stack web application for travel planning, weather updates, trip history, profile management, contact support, and community reviews.

## Tech Stack
- Frontend: React, React Router, Axios, CSS
- Backend: Node.js, Express, MongoDB (Mongoose), JWT
- Integrations: OpenWeather, OpenTripMap, Google APIs, Gemini API
- Deployment Targets: Netlify (frontend), Render (backend)

## Completed Modules
- Authentication (Register/Login)
- Travel Map and recommendations
- Weather module
- Travel History module
- Profile module with in-page password change
- Contact Us module
- Community Blog
  - User posts (review, rating, images)
  - Admin moderation (approve/delete)

## UI/UX Improvements Implemented
- Glassmorphism/transparency styling across key modules
- Route-based sidebar theming per module background
- Improved typography and dark sidebar visibility
- Responsive design adjustments for mobile/laptop/desktop
- Login/Register visual redesign with travel background

## Backend Improvements
- `change-password` API added
- Register now defaults role to `user`
- Community post schema, controller, routes added
- Admin-only moderation endpoints integrated

## Important Configuration
- Backend local port: `5001` (`backend/.env`)
- Frontend API base URL default: `http://localhost:5001/api`
- MongoDB local URI currently: `mongodb://localhost:27017/smart-travel-planner`

## Port Crash Issue (Resolved)
### Problem
Backend was crashing with:
- `EADDRINUSE: address already in use :::5001`

### Root Cause
Multiple old Node/Nodemon processes were already using the same port.

### Permanent Run Command (Windows)
In `backend`, use:

```bash
npm run dev:fixed
```

This command:
1) Frees port `5001` if already occupied  
2) Starts nodemon cleanly

### Standard Commands
- Backend:
  - `cd backend`
  - `npm install`
  - `npm run dev:fixed`
- Frontend:
  - `cd frontend`
  - `npm install`
  - `npm start`

## Deployment Checklist
1) Push code to GitHub  
2) Deploy backend on Render (set env vars)  
3) Deploy frontend on Netlify  
4) Set:
- Netlify `REACT_APP_API_URL=https://<render-app>/api`
- Render `FRONTEND_URL=https://<netlify-app>`

## Current Status
- Local backend connects to MongoDB and runs on port `5001`
- Frontend build compiles successfully
- Project is ready for final deployment and supervisor sharing
