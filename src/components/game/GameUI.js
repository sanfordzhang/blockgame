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
      <Row style={{ width: '100%', margin: 0 }}>
        {/* Action buttons row - always full width on small screens */}
        <Col xs={12} style={{ padding: '0.25rem' }}>
          <Row style={{ margin: 0 }}>
            <Col xs={4} style={{ padding: '0.25rem' }}>
              <Button
                small
                secondary
                onClick={fold}
                style={{ minHeight: '100%', width: '100%' }}
              >
                Fold
              </Button>
            </Col>
            <Col xs={4} style={{ padding: '0.25rem' }}>
              <Button
                small
                secondary
                disabled={
                  currentTable.callAmount !== currentTable.seats[seatId].bet &&
                  currentTable.callAmount > 0
                }
                onClick={check}
                style={{ minHeight: '100%', width: '100%' }}
              >
                Check
              </Button>
            </Col>
            <Col xs={4} style={{ padding: '0.25rem' }}>
              <Button
                small
                disabled={
                  currentTable.callAmount === 0 ||
                  currentTable.seats[seatId].bet >= currentTable.callAmount
                }
                onClick={call}
                style={{ width: '100%' }}
              >
                Call
              </Button>
            </Col>
          </Row>
        </Col>
        {/* Raise row - separate row to avoid overlap */}
        <Col xs={12} style={{ padding: '0.25rem' }}>
          <Row style={{ margin: 0, alignItems: 'stretch' }}>
            <Col xs={12} sm={4} md={3} style={{ padding: '0.25rem', display: 'flex' }}>
              <Button
                small
                onClick={() => raise(bet + currentTable.seats[seatId].bet)}
                style={{ minHeight: '100%', width: '100%', flex: 1 }}
              >
                Raise
              </Button>
            </Col>
            <Col xs={12} sm={8} md={9} style={{ padding: '0.25rem', display: 'flex' }}>
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
                  flex: 1,
                  minHeight: '2.5rem',
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
