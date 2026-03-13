import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Play from '../../pages/Play';
import NotFoundPage from '../../pages/NotFoundPage';
import Landing from '../../pages/Landing';

// Admin Components
import {
  AdminLayout,
  AdminLogin,
  AdminDashboard,
  RakeManagement,
  RakeWithdraw,
  EmergencyControls,
  TransactionHistory,
  AuditLog
} from '../admin';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play" element={<Play />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="rake" element={<RakeManagement />} />
        <Route path="withdraw" element={<RakeWithdraw />} />
        <Route path="emergency" element={<EmergencyControls />} />
        <Route path="transactions" element={<TransactionHistory />} />
        <Route path="audit" element={<AuditLog />} />
      </Route>
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
