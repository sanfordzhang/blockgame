import React from 'react'
import { BetSliderInput } from './BetSliderInput'
import { BetSliderWrapper } from './BetSliderWrapper'
import './BetSlider.scss'

// Format number with thousand separators
const formatNumber = (num) => {
  return num?.toLocaleString('en-US') ?? '0';
};

export const BetSlider = ({ currentTable, seatId, bet, setBet }) => {
  // Calculate min value for raise (not call amount, but minRaise)
  // minRaise is the minimum total bet for a raise action
  const minValue = currentTable.minRaise || currentTable.callAmount || currentTable.minBet;
  
  // Calculate max value: player's stack (what they can still bet)
  // Note: stack is the remaining chips they have
  const maxValue = currentTable?.seats?.[seatId]?.stack ?? 0;
  
  // Ensure min <= max for valid slider range
  const min = Math.min(minValue, maxValue);
  const max = maxValue;
  
  return (
    <BetSliderWrapper>
      <BetSliderInput
        type="range"
        step="10"
        min={min}
        max={max}
        value={bet}
        onChange={(e) => setBet(+e.target.value)}
        disabled={max <= min}
      />
      <span className="bet-slider-value">$ {formatNumber(bet)}</span>
    </BetSliderWrapper>
  );
}
