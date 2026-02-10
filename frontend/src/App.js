import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import OTPVerification from './OTPVerification';
import ForgotPassword from './ForgotPassword';

// Import only dashboard components
import Admin from './Dashboard/Admin';
import FemaleAdmin from './Dashboard/FemaleAdmin';
import MaleAdmin from './Dashboard/MaleAdmin';
import Staff from './Dashboard/Staff';
import FemaleStaff from './Dashboard/FemaleStaff';
import MaleStaff from './Dashboard/MaleStaff';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    return <Navigate to="/" />;
  }
  
  const userRole = user.role ? user.role.toLowerCase() : '';
  
  if (allowedRoles.length > 0) {
    const allowedRolesLower = allowedRoles.map(role => role.toLowerCase());
    return allowedRolesLower.includes(userRole) 
      ? children 
      : <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/verify-otp" element={<OTPVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Admin Dashboard - Full Access */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['FullAdmin']}>
              <Admin />
            </ProtectedRoute>
          }
        />

        {/* Female Admin Dashboard - Female Inmates & Their Visitors Only */}
        <Route
          path="/femaleadmin/*"
          element={
            <ProtectedRoute allowedRoles={['FemaleAdmin']}>
              <FemaleAdmin />
            </ProtectedRoute>
          }
        />

        {/* Male Admin Dashboard - Male Inmates & Their Visitors Only */}
        <Route
          path="/maleadmin/*"
          element={
            <ProtectedRoute allowedRoles={['MaleAdmin']}>
              <MaleAdmin />
            </ProtectedRoute>
          }
        />

        {/* Staff Dashboard - Full View Access */}
        <Route
          path="/staff/*"
          element={
            <ProtectedRoute allowedRoles={['FullStaff']}>
              <Staff />
            </ProtectedRoute>
          }
        />

        {/* Female Staff Dashboard - Female Inmates & Their Visitors Only */}
        <Route
          path="/femalestaff/*"
          element={
            <ProtectedRoute allowedRoles={['FemaleStaff']}>
              <FemaleStaff />
            </ProtectedRoute>
          }
        />

        {/* Male Staff Dashboard - Male Inmates & Their Visitors Only */}
        <Route
          path="/malestaff/*"
          element={
            <ProtectedRoute allowedRoles={['MaleStaff']}>
              <MaleStaff />
            </ProtectedRoute>
          }
        />

        {/* Redirect any unknown routes to login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;