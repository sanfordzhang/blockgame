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

const Providers = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      <GlobalState>
        <ModalProvider>
          <WebSocketProvider>
            <GameState>
              <TronProvider>
                <Normalize />
                <GlobalStyles />
                {children}
              </TronProvider>
            </GameState>
          </WebSocketProvider>
        </ModalProvider>
      </GlobalState>
    </ThemeProvider>
  </BrowserRouter>
)

export default Providers
