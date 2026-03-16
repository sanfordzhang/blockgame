import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CS_CALL,
  CS_CHECK,
  CS_FOLD,
  CS_JOIN_TABLE,
  CS_JOIN_TABLE_BLOCKCHAIN,
  CS_LEAVE_TABLE,
  CS_RAISE,
  CS_REBUY,
  CS_SIT_DOWN,
  CS_STAND_UP,
  SC_TABLE_JOINED,
  SC_TABLE_LEFT,
  SC_TABLE_UPDATED,
  SC_BALANCE_SYNCED,
  SC_BLOCKCHAIN_ERROR,
  SC_BLOCKCHAIN_TX_STATUS,
  CS_CONTRACT_JOIN_SUCCESS,
  CS_CONTRACT_JOIN_FAILED,
  CS_CONTRACT_LEAVE_SUCCESS,
  CS_CONTRACT_LEAVE_FAILED,
} from '../../pokergame/actions'
import socketContext from '../websocket/socketContext'
import GameContext from './gameContext'
import globalContext from '../global/globalContext'
import { joinTable as contractJoinTable, leaveTableSession as contractLeaveTableSession } from '../../utils/tronInteract'

const GameState = ({ children }) => {
  const { socket } = useContext(socketContext)
  const { setChipsAmount } = useContext(globalContext)
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [currentTable, setCurrentTable] = useState(null)
  const [seatId, setSeatId] = useState(null)
  const [turn, setTurn] = useState(false)
  const [turnTimeOutHandle, setHandle] = useState(null)

  const currentTableRef = React.useRef(currentTable)
  const seatIdRef = React.useRef(seatId)

  useEffect(() => {
    currentTableRef.current = currentTable

    seatId &&
      currentTable &&
      currentTable.seats[seatId] &&
      turn !== currentTable.seats[seatId].turn &&
      setTurn(currentTable.seats[seatId].turn)
    // eslint-disable-next-line
  }, [currentTable])

  useEffect(() => {
    seatIdRef.current = seatId
  }, [seatId])

  useEffect(() => {
    if (turn && !turnTimeOutHandle) {
      const handle = setTimeout(fold, 15000)
      setHandle(handle)
    } else {
      turnTimeOutHandle && clearTimeout(turnTimeOutHandle)
      turnTimeOutHandle && setHandle(null)
    }
    // eslint-disable-next-line
  }, [turn])

  useEffect(() => {
    if (socket) {
      window.addEventListener('unload', leaveTable)
      window.addEventListener('close', leaveTable)

      socket.on(SC_TABLE_UPDATED, ({ table, message, from }) => {
        console.log(SC_TABLE_UPDATED, { table, message, from })
        setCurrentTable(table)
        message && addMessage(message)
      })

      socket.on(SC_TABLE_JOINED, ({ tables, tableId }) => {
        console.log(SC_TABLE_JOINED, { tables, tableId })
        if (tables[0].currentNumberPlayers > 0)
          setSeatId(tables[0].currentNumberPlayers)
      })

      socket.on(SC_TABLE_LEFT, ({ tables, tableId }) => {
        console.log(SC_TABLE_LEFT, { tables, tableId })
        setCurrentTable(null)
        setMessages([])
      })

      // Blockchain event listeners
      socket.on(SC_BALANCE_SYNCED, (data) => {
        console.log(SC_BALANCE_SYNCED, data)
        // Update local chips amount when balance is synced
        if (data.available !== undefined) {
          setChipsAmount(data.available)
        } else if (data.balance !== undefined) {
          setChipsAmount(data.balance)
        }
      })

      socket.on(SC_BLOCKCHAIN_ERROR, (data) => {
        console.error(SC_BLOCKCHAIN_ERROR, data)
        addMessage(`Blockchain error: ${data.message}`)
      })

      socket.on(SC_BLOCKCHAIN_TX_STATUS, (data) => {
        console.log(SC_BLOCKCHAIN_TX_STATUS, data)
      })
    }
    if(socket){
      return () => leaveTable()
    } 
    // eslint-disable-next-line
  }, [socket])

  const joinTable = async (tableId, buyInAmount) => {
    // Default buyIn should be at least 20 big blinds (minBet * 2 * 20)
    // If no buyIn specified, use a reasonable default
    const finalBuyIn = buyInAmount || 100000000; // Default 100,000,000 SUN = 100 TRX (20 big blinds)
    console.log('[GameState] joinTable:', { tableId, buyInAmount: finalBuyIn })
    
    try {
      // Step 1: Call contract directly (player signs transaction)
      console.log('[GameState] Calling contract joinTable...')
      const result = await contractJoinTable(tableId, finalBuyIn)
      console.log('[GameState] Contract joinTable success:', result)
      
      // Step 2: Notify server that contract call succeeded
      socket.emit(CS_CONTRACT_JOIN_SUCCESS, { 
        tableId, 
        buyInAmount: finalBuyIn,
        txId: result.tx
      })
      
    } catch (error) {
      console.error('[GameState] Contract joinTable failed:', error)
      
      // Notify server about the failure
      socket.emit(CS_CONTRACT_JOIN_FAILED, {
        tableId,
        buyInAmount: finalBuyIn,
        error: error.message
      })
      
      // Show error to user
      addMessage(`Failed to join table: ${error.message}`)
    }
  }

  const leaveTable = async () => {
    const tableId = currentTableRef?.current?.id
    const currentSeatId = seatIdRef.current
    const stack = currentTableRef?.current?.seats?.[currentSeatId]?.stack || 0
    
    console.log('[GameState] leaveTable:', { tableId, stack, seatId: currentSeatId })
    
    if (!tableId) {
      console.log('[GameState] No table to leave')
      navigate('/')
      return
    }
    
    // Stand up from table first (local)
    standUp()
    
    try {
      // Step 1: Call contract directly (player signs transaction)
      console.log('[GameState] Calling contract leaveTableSession...')
      const result = await contractLeaveTableSession(tableId, stack)
      console.log('[GameState] Contract leaveTableSession success:', result)
      
      // Step 2: Notify server that contract call succeeded
      socket.emit(CS_CONTRACT_LEAVE_SUCCESS, {
        tableId,
        stack,
        txId: result.tx
      })
      
    } catch (error) {
      console.error('[GameState] Contract leaveTableSession failed:', error)
      
      // Notify server about the failure (still leave locally)
      socket.emit(CS_CONTRACT_LEAVE_FAILED, {
        tableId,
        stack,
        error: error.message
      })
      
      // Show error to user but still navigate away
      addMessage(`Warning: Blockchain leave failed: ${error.message}`)
    }
    
    navigate('/')
  }

  const sitDown = (tableId, seatId, amount) => {
    socket.emit(CS_SIT_DOWN, { tableId, seatId, amount })
    console.log(CS_SIT_DOWN, { tableId, seatId, amount })
    setSeatId(seatId)
  }

  const rebuy = (tableId, seatId, amount) => {
    socket.emit(CS_REBUY, { tableId, seatId, amount })
    console.log(CS_REBUY, { tableId, seatId, amount })
  }

  const standUp = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CS_STAND_UP, currentTableRef.current.id)
    setSeatId(null)
  }

  const addMessage = (message) => {
    setMessages((prevMessages) => [...prevMessages, message])
    console.log(message)
  }

  const fold = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CS_FOLD, currentTableRef.current.id)
  }

  const check = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CS_CHECK, currentTableRef.current.id)
  }

  const call = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CS_CALL, currentTableRef.current.id)
  }

  const raise = (amount) => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CS_RAISE, { tableId: currentTableRef.current.id, amount })
  }

  return (
    <GameContext.Provider
      value={{
        messages,
        currentTable,
        seatId,
        joinTable,
        leaveTable,
        sitDown,
        standUp,
        addMessage,
        fold,
        check,
        call,
        raise,
        rebuy,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export default GameState
