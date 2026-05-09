import React from 'react'
import GlobalState from './global/GlobalState'
import { ThemeProvider } from 'styled-components'
import ModalProvider from './modal/ModalProvider'
import theme from '../styles/theme'
import Normalize from '../styles/Normalize'
import GlobalStyles from '../styles/Global'
import { BrowserRouter } from 'react-router-dom'
import WebSocketProvider from './websocket/WebsocketProvider'
import GameState from './game/GameState'
import { TronProvider } from './tron/TronContext'
import { AMMProvider } from './amm/AMMContext'
import LocaProvider from './localization/LocaProvider'
import { ZeroGProvider } from './zero-g/ZeroGContext'

const Providers = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      <LocaProvider>
        <GlobalState>
          <ModalProvider>
            <WebSocketProvider>
              <GameState>
                <TronProvider>
                  <ZeroGProvider>
                    <AMMProvider>
                      <Normalize />
                      <GlobalStyles />
                      {children}
                    </AMMProvider>
                  </ZeroGProvider>
                </TronProvider>
              </GameState>
            </WebSocketProvider>
          </ModalProvider>
        </GlobalState>
      </LocaProvider>
    </ThemeProvider>
  </BrowserRouter>
)

export default Providers
