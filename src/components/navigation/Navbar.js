import React, { useContext } from 'react';
import LogoWithText from '../logo/LogoWithText';
import Logo from '../logo/LogoIcon';
import Container from '../layout/Container';
import styled from 'styled-components';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Hider from '../layout/Hider';
import Button from '../buttons/Button';
import HamburgerButton from '../buttons/HamburgerButton';
import Spacer from '../layout/Spacer';
import LangSwitcher from './LangSwitcher';
import locaContext from '../../context/localization/locaContext';
import { useZeroG } from '../../context/zero-g/ZeroGContext';

const StyledNav = styled.nav`
  padding: 0.75rem 0;
  position: fixed;
  z-index: 99;
  width: 100%;
  top: 0;
  left: 0;
  background-color: ${(props) => props.theme.colors.lightestBg};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const NavLinksRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex: 1;
  margin: 0 1rem;
`;

const StyledNavLink = styled(NavLink)`
  padding: 0.4rem 0.65rem;
  color: ${(p) => p.theme.colors.textPrimary};
  text-decoration: none;
  font-size: 0.88rem;
  border-radius: 0.4rem;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: ${(p) => p.theme.colors.border || 'rgba(0,0,0,0.06)'};
    color: ${(p) => p.theme.colors.primaryCta};
    text-decoration: none;
  }

  &.active {
    color: ${(p) => p.theme.colors.primaryCta};
    font-weight: 700;
    background: ${(p) => p.theme.colors.border || 'rgba(0,0,0,0.06)'};
  }
`;

// Task 9.6: Chain Indicator Badge
const ChainBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 1rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  ${props => props.chain === 'tron' ? `
    background: rgba(255, 0, 0, 0.12);
    color: #FF0000;
    border: 1px solid rgba(255, 0, 0, 0.3);
  ` : props.chain === 'zerog' ? `
    background: rgba(98, 126, 234, 0.12);
    color: #627eea;
    border: 1px solid rgba(98, 126, 234, 0.3);
  ` : `
    background: rgba(158, 158, 158, 0.12);
    color: #9e9e9e;
    border: 1px solid rgba(158, 158, 158, 0.3);
  `}
`;

const NAV_LINKS = [
  { to: '/',          labelKey: 'navPlay' },       // Play → go to Landing page first
  { to: '/tournament', labelKey: 'navTournament' },
  { to: '/nft',        labelKey: 'navNFT' },
  { to: '/wallet',     labelKey: 'navWallet' },
  { to: '/dao',        labelKey: 'navDAO' },
  { to: '/dex',        labelKey: 'navDEX' },
];

const Navbar = ({
  loggedIn,
  location,
  openModal,
  openNavMenu,
  className,
}) => {
  const { t } = useContext(locaContext);
  const { address: zeroGAddress, isConnected: zeroGConnected } = useZeroG() || {};
  const navigate = useNavigate();

  // Go to home page Deposit section
  const goToDeposit = () => navigate('/');

  if (!loggedIn)
    return (
      <StyledNav className={className}>
        <Container contentCenteredMobile>
          <Link to="/">
            <LogoWithText />
          </Link>

          <LangSwitcher />
          <HamburgerButton clickHandler={openNavMenu} />
        </Container>
      </StyledNav>
    );
  else
    return (
      <StyledNav className={className}>
        <Container fluid style={{ maxWidth: '100%', padding: '0 1.5rem' }}>
          {/* Logo */}
          <Link to="/" style={{ flexShrink: 0, textDecoration: 'none' }}>
            <Hider hideOnMobile>
              <LogoWithText />
            </Hider>
            <Hider hideOnDesktop>
              <Logo />
            </Hider>
          </Link>

          {/* 桌面端横向导航链接 */}
          <Hider hideOnMobile>
            <NavLinksRow>
              {NAV_LINKS.map(({ to, labelKey }) => (
                <StyledNavLink key={to} to={to}>
                  {t(labelKey)}
                </StyledNavLink>
              ))}
            </NavLinksRow>
          </Hider>

          {/* 右侧工具区 */}
          <Spacer>
            {/* Task 9.6: Chain Indicator Badge */}
            <ChainBadge chain={zeroGConnected ? 'zerog' : 'tron'}>
              {zeroGConnected ? '0G' : 'TRON'}
            </ChainBadge>
            <LangSwitcher />
            <HamburgerButton clickHandler={openNavMenu} />
          </Spacer>
        </Container>
      </StyledNav>
    );
};

export default Navbar;
