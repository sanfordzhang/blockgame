import React, { useContext } from 'react'
 
import Button from '../buttons/Button'
import { BetSlider } from './Betslider/BetSlider'
import { UIWrapper } from './UIWrapper'
import { Row, Col } from 'react-bootstrap'

export const GameUI = ({
  currentTable,
  seatId,
  bet,
  setBet,
  raise,
  standUp,
  fold,
  check,
  call,
}) => {


  return (
    <UIWrapper>
      <Row style={{ width: '100%', margin: 0, justifyContent: 'center' }}>
        {/* All action buttons in one row */}
        <Col xs={12} style={{ padding: '0.25rem' }}>
          <Row style={{ margin: 0, justifyContent: 'center' }}>
            <Col xs="auto" style={{ padding: '0.25rem', flex: '0 0 auto' }}>
              <Button
                small
                secondary
                onClick={fold}
                style={{ minHeight: '2.5rem', minWidth: '70px', padding: '0.5rem 0.75rem' }}
              >
                Fold
              </Button>
            </Col>
            <Col xs="auto" style={{ padding: '0.25rem', flex: '0 0 auto' }}>
              <Button
                small
                secondary
                disabled={
                  currentTable.callAmount !== currentTable.seats[seatId].bet &&
                  currentTable.callAmount > 0
                }
                onClick={check}
                style={{ minHeight: '2.5rem', minWidth: '70px', padding: '0.5rem 0.75rem' }}
              >
                Check
              </Button>
            </Col>
            <Col xs="auto" style={{ padding: '0.25rem', flex: '0 0 auto' }}>
              <Button
                small
                disabled={
                  currentTable.callAmount === 0 ||
                  currentTable.seats[seatId].bet >= currentTable.callAmount
                }
                onClick={call}
                style={{ minHeight: '2.5rem', minWidth: '70px', padding: '0.5rem 0.75rem' }}
              >
                Call
              </Button>
            </Col>
            <Col xs="auto" style={{ padding: '0.25rem', flex: '0 0 auto' }}>
              <Button
                small
                onClick={() => raise(bet + currentTable.seats[seatId].bet)}
                style={{ minHeight: '2.5rem', minWidth: '70px', padding: '0.5rem 0.75rem' }}
              >
                Raise
              </Button>
            </Col>
            <Col xs="auto" style={{ padding: '0.25rem', flex: '0 1 auto', minWidth: '120px', maxWidth: '220px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid',
                  borderImage: 'linear-gradient(to bottom, #21a68e, #0d3733) 2',
                  backgroundImage: 'linear-gradient(to bottom, #187969, #081c1c)',
                  backgroundOrigin: 'border-box',
                  padding: '0.25rem 0.5rem',
                  clipPath: `polygon(
    0 5px,
    5px 0,
    calc(100% - 5px) 0,
    100% 5px,
    100% calc(100% - 5px),
    calc(100% - 5px) 100%,
    5px 100%,
    0% calc(100% - 5px),
    0% 5px
  )`,
                  minHeight: '2.5rem',
                  width: '100%',
                }}
              >
                <BetSlider
                  currentTable={currentTable}
                  seatId={seatId}
                  bet={bet}
                  setBet={setBet}
                />
              </div>
            </Col>
          </Row>
        </Col>
      </Row>
    </UIWrapper>
  )
}
