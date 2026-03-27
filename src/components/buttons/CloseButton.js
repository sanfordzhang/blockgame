import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import CloseIcon from '../icons/CloseIcon';

const StyledCloseIcon = styled.div`
  display: inline-block;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  outline: none;
  border: 2px solid rgba(0, 0, 0, 0);
  opacity: ${props => props.disabled ? 0.5 : 1};

  &:focus {
    outline: none;
    border: 2px solid ${(props) => props.theme.colors.primaryCtaDarker};
    border-radius: 50%;
  }
`;

const CloseButton = ({ clickHandler, disabled }) => {
  return (
    <StyledCloseIcon
      onClick={disabled ? undefined : clickHandler}
      onKeyDown={(e) => {
        if (e.keyCode === 13 && !disabled) clickHandler();
      }}
      tabIndex={disabled ? -1 : 0}
      disabled={disabled}
    >
      <CloseIcon />
    </StyledCloseIcon>
  );
};

CloseButton.propTypes = {
  clickHandler: PropTypes.func,
  disabled: PropTypes.bool,
};

CloseButton.defaultProps = {
  disabled: false,
};

export default CloseButton;
