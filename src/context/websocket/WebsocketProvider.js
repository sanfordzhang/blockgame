import React, { useState, useEffect, useContext } from 'react'
import SocketContext from './socketContext'
import io from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import {
  CS_DISCONNECT,
  CS_FETCH_LOBBY_INFO,
  SC_PLAYERS_UPDATED,
  SC_RECEIVE_LOBBY_INFO,
  SC_TABLES_UPDATED,
} from '../../pokergame/actions'
import globalContext from '../global/globalContext'
import config from '../../clientConfig'

const WebSocketProvider = ({ children }) => {
  const { setTables, setPlayers, setChipsAmount } = useContext(globalContext)
  const navigate = useNavigate()

  const [socket, setSocket] = useState(null)
  const [socketId, setSocketId] = useState(null)

  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        cleanUp()
      } catch (e) {
        console.error('[WebSocket] Error in beforeunload:', e)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('beforeclose', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('beforeclose', handleBeforeUnload)
      cleanUp()
    }
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
      console.log('socket context')
      const webSocket = socket || connect()

      return () => cleanUp()
    // eslint-disable-next-line
  }, [])

  function cleanUp() {
    try {
      if (window.socket) {
        if (window.socket.connected) {
          window.socket.emit(CS_DISCONNECT)
        }
        window.socket.removeAllListeners()
        window.socket.close()
      }
    } catch (e) {
      console.error('[WebSocket] Error during cleanup:', e)
    }
    setSocket(null)
    setSocketId(null)
    setPlayers(null)
    setTables(null)
  }

  function connect() {
    const socket = io(config.socketURI, {
      transports: ['polling', 'websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    registerCallbacks(socket)
    window.socket = socket
    return socket
  }

  function registerCallbacks(socket) {
    socket.on('connect', () => {
      console.log('Socket connected successfully')
      setSocket(socket)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      setSocket(socket)
    })

    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error.message)
    })

    socket.on(SC_RECEIVE_LOBBY_INFO, ({ tables, players, socketId, amount }) => {
      console.log(SC_RECEIVE_LOBBY_INFO, tables, players, socketId)
      setSocketId(socketId)
      setChipsAmount(amount)
      setTables(tables)
      setPlayers(players)
    })
    
    socket.on(SC_PLAYERS_UPDATED, (players) => {
      console.log(SC_PLAYERS_UPDATED, players)
      setPlayers(players)
    })

    socket.on(SC_TABLES_UPDATED, (tables) => {
      console.log(SC_TABLES_UPDATED, tables)
      setTables(tables)
    })

  }

  return (
    <SocketContext.Provider value={{ socket, socketId, cleanUp }}>
      {children}
    </SocketContext.Provider>
  )
}

export default WebSocketProvider
