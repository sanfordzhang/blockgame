import React from 'react';
import globalContext from './context/global/globalContext';
import AppRoutes from './components/routing/Routes';
import { useAccessLog } from './hooks/useAccessLog';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.scss';

const App = () => {
  // Inject access log collection — monitors route changes & wallet state
  useAccessLog();

  return (
    <>
      <AppRoutes />
    </>
  );
};

export default App;
