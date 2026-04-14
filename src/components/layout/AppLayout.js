import React, { useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../navigation/Navbar';
import NavMenu from '../navigation/NavMenu';
import globalContext from '../../context/global/globalContext';
import modalContext from '../../context/modal/modalContext';

// Pages where Navbar is hidden (full-screen game views)
const NAVBAR_HIDDEN_PATHS = ['/play'];
const NAVBAR_HIDDEN_PATTERNS = [/^\/tournament\/\d+\/play/];

const AppLayout = ({ children }) => {
  const { walletAddress, chipsAmount } = useContext(globalContext);
  const { openModal } = useContext(modalContext);
  const location = useLocation();
  const [showNavMenu, setShowNavMenu] = useState(false);

  const hideNavbar = NAVBAR_HIDDEN_PATHS.some((path) =>
    location.pathname.startsWith(path)
  ) || NAVBAR_HIDDEN_PATTERNS.some((pattern) =>
    pattern.test(location.pathname)
  );

  const loggedIn = !!walletAddress;

  return (
    <>
      {!hideNavbar && (
        <Navbar
          loggedIn={loggedIn}
          chipsAmount={chipsAmount}
          location={location}
          openModal={openModal}
          openNavMenu={() => setShowNavMenu(true)}
        />
      )}
      {showNavMenu && loggedIn && (
        <NavMenu
          onClose={() => setShowNavMenu(false)}
          logout={() => {}}
          userName={walletAddress ? walletAddress.substring(0, 8) + '...' : ''}
          chipsAmount={chipsAmount}
          openModal={openModal}
        />
      )}
      {children}
    </>
  );
};

export default AppLayout;
