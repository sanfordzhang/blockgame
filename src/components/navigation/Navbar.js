import React, { useContext } from 'react';
import LogoWithText from '../logo/LogoWithText';
import Logo from '../logo/LogoIcon';
import Container from '../layout/Container';
import styled from 'styled-components';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Hider from '../layout/Hider';
import Button from '../buttons/Button';
import ChipsAmount from '../user/ChipsAmount';
import HamburgerButton from '../buttons/HamburgerButton';
import Spacer from '../layout/Spacer';
import LangSwitcher from './LangSwitcher';
import locaContext from '../../context/localization/locaContext';

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

const NAV_LINKS = [
  { to: '/play',       labelKey: 'navPlay' },
  { to: '/tournament', labelKey: 'navTournament' },
  { to: '/nft',        labelKey: 'navNFT' },
  { to: '/wallet',     labelKey: 'navWallet' },
  { to: '/dao',        labelKey: 'navDAO' },
  { to: '/dex',        labelKey: 'navDEX' },
];

const Navbar = ({
  loggedIn,
  chipsAmount,
  location,
  openModal,
  openNavMenu,
  className,
}) => {
  const { t } = useContext(locaContext);
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
            <ChipsAmount
              chipsAmount={chipsAmount}
              clickHandler={goToDeposit}
            />
            <LangSwitcher />
            <HamburgerButton clickHandler={openNavMenu} />
          </Spacer>
        </Container>
      </StyledNav>
    );
};

export default Navbar;
