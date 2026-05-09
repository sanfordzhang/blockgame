import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Landing is the only statically imported page — it must be available immediately
import Landing from '../../pages/Landing';
import NotFoundPage from '../../pages/NotFoundPage';
import AppLayout from '../layout/AppLayout';

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

// Lazy load ALL other pages so their heavy game-asset dependencies (cards.svg,
// background.png, dealer.png, player1~6.png, table.webp, etc.) are NOT included
// in the initial JS bundle. Each page loads only when its route is visited.
const Play = lazy(() => import('../../pages/Play'));
const Tournament = lazy(() => import('../../pages/Tournament'));
const TournamentWaitingRoom = lazy(() => import('../../pages/TournamentWaitingRoom'));
const TournamentTable = lazy(() => import('../../pages/TournamentTable'));
const NFTGallery = lazy(() => import('../../pages/NFTGallery'));
const CHIPWallet = lazy(() => import('../../pages/CHIPWallet'));
const DAO = lazy(() => import('../../pages/DAO'));
const DEX = lazy(() => import('../../pages/DEX'));
const FairnessVerify = lazy(() => import('../../pages/FairnessVerify'));

// Shared fallback for all lazy-loaded pages
const PageFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '60vh',
    fontSize: '1.1rem',
    color: '#666',
  }}>
    Loading...
  </div>
);

const AppRoutes = () => {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/play" element={<Play />} />
          <Route path="/tournament" element={<Tournament />} />
          <Route path="/tournament/:tournamentId" element={<TournamentTable />} />
          <Route path="/tournament/:tournamentId/waiting" element={<TournamentWaitingRoom />} />
          <Route path="/tournament/:tournamentId/play" element={<TournamentTable />} />
          <Route path="/nft" element={<NFTGallery />} />
          <Route path="/wallet" element={<CHIPWallet />} />
          <Route path="/dao" element={<DAO />} />
        <Route path="/dex" element={<DEX />} />
          <Route path="/fairness-verify" element={<FairnessVerify />} />

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
      </Suspense>
    </AppLayout>
  );
};

export default AppRoutes;
