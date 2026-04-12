import React from 'react';
import PokerChip from '../icons/PokerChip';
import { Input } from '../forms/Input';
import styled from 'styled-components';
import PropTypes from 'prop-types';

const Wrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;

  & ${Input} {
    cursor: pointer;
    text-align: right;
    padding: 0.5rem 0.75rem;
    border-radius: ${(props) => props.theme.other.stdBorderRadius};
    border: 1px solid ${(props) => props.theme.colors.primaryCta};
    min-width: 0;
    width: auto;
  }
`;

const IconWrapper = styled.label`
  cursor: pointer;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ChipsAmount = ({ chipsAmount, clickHandler }) => {
  const amount = chipsAmount == null ? 0 : chipsAmount;
  // chipsAmount is in SUN (1 TRX = 1,000,000 SUN), convert to TRX for display
  const trxAmount = amount / 1_000_000;
  const formatted = new Intl.NumberFormat(document.documentElement.lang, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(trxAmount);

  return (
    <Wrapper onClick={clickHandler}>
      <IconWrapper htmlFor="chipsAmount">
        <PokerChip />
      </IconWrapper>
      <Input
        disabled
        type="text"
        value={`${formatted} TRX`}
        name="chipsAmount"
      />
    </Wrapper>
  );
};

ChipsAmount.propTypes = {
  chipsAmount: PropTypes.number,
  clickHandler: PropTypes.func,
};

export default ChipsAmount;
