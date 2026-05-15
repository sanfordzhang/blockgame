import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CS_CALL,
  CS_CHECK,
  CS_FOLD,
  CS_JOIN_TABLE_BLOCKCHAIN,
  CS_LEAVE_TABLE_BLOCKCHAIN,
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
  CS_CONTRACT_LEAVE_SUCCESS,
  CS_CONTRACT_LEAVE_FAILED,
  SC_DELEGATE_SET,
  SC_DELEGATE_ERROR,
  SC_DELEGATE_STATUS,
  CS_AI_ENABLE,
  CS_AI_DISABLE,
  CS_AI_STATS,
  CS_GET_SUGGESTION,
  SC_AI_ENABLED,
  SC_AI_DISABLED,
  SC_AI_ACTION,
  SC_AI_STATS,
  SC_SUGGESTION,
} from '../../pokergame/actions'
import socketContext from '../websocket/socketContext'
import GameContext from './gameContext'
import globalContext from '../global/globalContext'
import { leaveTableSession as contractLeaveTableSession } from '../../utils/tronInteract'
import { leaveTableSession as zeroGLeaveTableSession, normalizeBalance } from '../../utils/zeroGInteract'

// i18n: detect language at module load time
const _lang = (typeof navigator !== 'undefined' && /^zh/.test(navigator.language)) ? 'zh' : 'en';

const GameState = ({ children }) => {
  const { socket } = useContext(socketContext)
  const { setChipsAmount, walletAddress } = useContext(globalContext)
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [currentTable, setCurrentTable] = useState(null)
  const [seatId, setSeatId] = useState(null)
  const [turn, setTurn] = useState(false)
  const [turnTimeOutHandle, setHandle] = useState(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const isLeavingRef = React.useRef(false)
  const leaveTimeoutRef = React.useRef(null)

  // AI state
  const [aiState, setAIState] = useState({ enabled: false, difficulty: 'medium', handsPlayed: 0, maxHands: 100 })
  const [suggestion, setSuggestion] = useState(null)
  const [lastAIAction, setLastAIAction] = useState(null)
  const aiStateRef = React.useRef(aiState)

  const currentTableRef = React.useRef(currentTable)
  const seatIdRef = React.useRef(seatId)
  const walletAddressRef = React.useRef(walletAddress)

  useEffect(() => {
    walletAddressRef.current = walletAddress
  }, [walletAddress])

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
    aiStateRef.current = aiState
  }, [aiState])

  useEffect(() => {
    if (turn && !turnTimeOutHandle) {
      // Skip auto-fold when AI autopilot is handling the turn
      if (aiStateRef.current.enabled) return
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
      const handleUnload = () => {
        try {
          if (socket && socket.connected) {
            if (currentTableRef.current) leaveTable()
          }
        } catch (e) {
          console.error('[GameState] Error in unload handler:', e)
        }
      }
      
      window.addEventListener('unload', handleUnload)
      window.addEventListener('close', handleUnload)

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
        isLeavingRef.current = false
        setIsLeaving(false)
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current)
          leaveTimeoutRef.current = null
        }
        setCurrentTable(null)
        currentTableRef.current = null
        setSeatId(null)
        seatIdRef.current = null
        setMessages([])
      })

      // Blockchain event listeners
      socket.on(SC_BALANCE_SYNCED, (data) => {
        console.log(SC_BALANCE_SYNCED, data)
        // Guard: only update if this message belongs to current wallet
        // (prevents cross-player balance bleed when switching accounts)
        if (data.walletAddress && walletAddressRef.current &&
            data.walletAddress.toLowerCase() !== walletAddressRef.current.toLowerCase()) {
          console.warn('[GameState] SC_BALANCE_SYNCED ignored: wallet mismatch',
            data.walletAddress, '!=', walletAddressRef.current)
          return
        }
        // Update local chips amount when balance is synced
        // Normalize: if value looks like raw wei (>1e12), convert to decimal
        if (data.available !== undefined) {
          setChipsAmount(normalizeBalance(data.available))
        } else if (data.balance !== undefined) {
          setChipsAmount(normalizeBalance(data.balance))
        }
      })

      socket.on(SC_BLOCKCHAIN_ERROR, (data) => {
        console.error(SC_BLOCKCHAIN_ERROR, data)

        const rawMessage = data?.message || (_lang === 'zh' ? '未知区块链错误' : 'Unknown blockchain error')
        const isJoinOrBalanceIssue =
          data?.operation === 'joinTable' ||
          /buy-?in|insufficient|insufficient funds|余额不足|required/i.test(rawMessage)

        if (isJoinOrBalanceIssue) {
          addMessage(_lang === 'zh' ? `余额不足，无法开始牌局：${rawMessage}` : `Insufficient balance to start hand: ${rawMessage}`)
          navigate('/')
          return
        }

        addMessage(_lang === 'zh' ? `区块链错误：${rawMessage}` : `Blockchain error: ${rawMessage}`)
      })

      socket.on(SC_BLOCKCHAIN_TX_STATUS, (data) => {
        console.log(SC_BLOCKCHAIN_TX_STATUS, data)
      })

      // Delegate event listeners
      socket.on(SC_DELEGATE_SET, (data) => {
        console.log(SC_DELEGATE_SET, data)
        if (data.success) {
          addMessage(_lang === 'zh'
            ? '✅ 服务器授权成功！之后进入/退出游戏无需签名。'
            : '✅ Server authorized! No signature needed for entering/leaving games.')
        }
      })

      socket.on(SC_DELEGATE_ERROR, (data) => {
        console.error(SC_DELEGATE_ERROR, data)
        if (data.needAuthorization) {
          addMessage(_lang === 'zh' ? `⚠️ 请先授权服务器：${data.serverAddress}` : `⚠️ Please authorize server first: ${data.serverAddress}`)
        } else {
          addMessage(_lang === 'zh' ? `授权错误：${data.message}` : `Authorization error: ${data.message}`)
        }
      })

      socket.on(SC_DELEGATE_STATUS, (data) => {
        console.log(SC_DELEGATE_STATUS, data)
        if (data.isAuthorized) {
          addMessage(_lang === 'zh' ? '✅ 已授权服务器代理操作' : '✅ Server authorized - no signature needed')
        } else if (data.serverAddress) {
          addMessage(_lang === 'zh' ? `⚠️ 需要授权服务器: ${data.serverAddress}` : `⚠️ Server authorization needed: ${data.serverAddress}`)
        }
      })

      // Delegate not authorized - player must sign leaveTableSession directly
      socket.on('SC_REQUEST_PLAYER_LEAVE', async ({ tableId, stack }) => {
        console.log('[GameState] SC_REQUEST_PLAYER_LEAVE:', { tableId, stack })
        try {
          // Detect chain type from wallet address
          const isZeroGPlayer = walletAddressRef.current?.startsWith('0x');
          let result;
          if (isZeroGPlayer) {
            // 0G path: call PokerGame0G.leaveTableSession
            console.log('[GameState] Using 0G leaveTableSession');
            result = await zeroGLeaveTableSession(stack);
          } else {
            // TRON path: call TRON contract leaveTableSession
            console.log('[GameState] Using TRON leaveTableSession');
            result = await contractLeaveTableSession(tableId, stack)
          }
          console.log('[GameState] Player-signed leaveTableSession success:', result)
          socket.emit(CS_CONTRACT_LEAVE_SUCCESS, { tableId, stack, txId: result.tx })
        } catch (error) {
          console.error('[GameState] Player-signed leaveTableSession failed:', error)
          socket.emit(CS_CONTRACT_LEAVE_FAILED, { tableId, stack, error: error.message })
        }
      })

      return () => {
        window.removeEventListener('unload', handleUnload)
        window.removeEventListener('close', handleUnload)
        socket.off('SC_REQUEST_PLAYER_LEAVE')
        try {
          if (socket && socket.connected) {
            // Disable AI autopilot when leaving game context to prevent ghost actions
            if (socket.connected) {
              socket.emit(CS_AI_DISABLE)
            }
            if (currentTableRef.current) leaveTable()
          }
        } catch (e) {
          console.error('[GameState] Error in cleanup:', e)
        }
      }
    }
    // eslint-disable-next-line
  }, [socket])

  const joinTable = async (tableId, buyInAmount) => {
    // Default buyIn should be at least 20 big blinds (minBet * 2 * 20)
    // If no buyIn specified, use a reasonable default
    const finalBuyIn = buyInAmount || 100000000; // Default 100,000,000 SUN = 100 TRX (20 big blinds)
    console.log('[GameState] joinTable:', { tableId, buyInAmount: finalBuyIn })
    
    // Use server proxy mode - server will call joinTableFor on behalf of player
    // Player must have authorized the server as delegate first
    socket.emit(CS_JOIN_TABLE_BLOCKCHAIN, { 
      tableId, 
      buyInAmount: finalBuyIn 
    })
  }

  const leaveTable = async () => {
    if (isLeavingRef.current) {
      console.log('[GameState] leaveTable ignored: already leaving')
      return
    }

    const tableId = currentTableRef?.current?.id
    const currentSeatId = seatIdRef.current
    const stack = currentTableRef?.current?.seats?.[currentSeatId]?.stack || 0

    console.log('[GameState] leaveTable:', { tableId, stack, seatId: currentSeatId })

    if (!tableId) {
      console.log('[GameState] No table to leave')
      navigate('/')
      return
    }

    if (socket && socket.connected) {
      isLeavingRef.current = true
      setIsLeaving(true)
      // Disable AI autopilot when leaving table
      try { socket.emit(CS_AI_DISABLE) } catch(e) {}
      // Wait for SC_TABLE_LEFT before navigating so socket stays alive during blockchain leave
      socket.once(SC_TABLE_LEFT, () => {
        console.log('[GameState] SC_TABLE_LEFT received, navigating home')
        isLeavingRef.current = false
        setIsLeaving(false)
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current)
          leaveTimeoutRef.current = null
        }
        navigate('/')
      })
      // Timeout fallback in case server never responds
      leaveTimeoutRef.current = setTimeout(() => {
        isLeavingRef.current = false
        setIsLeaving(false)
        leaveTimeoutRef.current = null
        navigate('/')
      }, 10000)
      try {
        socket.emit(CS_LEAVE_TABLE_BLOCKCHAIN, { tableId })
      } catch (error) {
        console.error('[GameState] leaveTable error:', error)
        isLeavingRef.current = false
        setIsLeaving(false)
        navigate('/')
      }
    } else {
      navigate('/')
    }
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

  // AI actions
  const enableAI = (difficulty = 'medium', maxHands = 100) => {
    if (!socket || !currentTableRef.current) return
    socket.emit(CS_AI_ENABLE, { tableId: currentTableRef.current.id, difficulty, maxHands })
  }

  const disableAI = () => {
    if (!socket) return
    socket.emit(CS_AI_DISABLE)
    setAIState(prev => ({ ...prev, enabled: false }))
  }

  const getSuggestion = () => {
    if (!socket || !currentTableRef.current || !seatIdRef.current) return
    const seat = currentTableRef.current.seats[seatIdRef.current]
    if (!seat) return
    socket.emit(CS_GET_SUGGESTION, {
      hand: seat.hand,
      board: currentTableRef.current.board,
      pot: currentTableRef.current.pot,
      callAmount: currentTableRef.current.callAmount || 0,
      minRaise: currentTableRef.current.minRaise || 0,
      stack: seat.stack,
      numPlayers: Object.values(currentTableRef.current.seats).filter(s => s && s.player && !s.folded).length
    })
  }

  // AI socket listeners
  useEffect(() => {
    if (!socket) return

    socket.on(SC_AI_ENABLED, (data) => {
      setAIState({ enabled: true, difficulty: data.difficulty, handsPlayed: 0, maxHands: data.maxHands || 100 })
    })

    socket.on(SC_AI_DISABLED, (data) => {
      setAIState(prev => ({ ...prev, enabled: false }))
    })

    socket.on(SC_AI_ACTION, (data) => {
      console.log('[AI] Action:', data.action, data.amount)
      setLastAIAction(data)
      // Auto-clear after 4 seconds
      setTimeout(() => setLastAIAction(null), 4000)
    })

    socket.on(SC_AI_STATS, (data) => {
      setAIState(prev => ({ ...prev, ...data }))
    })

    socket.on(SC_SUGGESTION, (data) => {
      setSuggestion(data)
    })

    return () => {
      socket.off(SC_AI_ENABLED)
      socket.off(SC_AI_DISABLED)
      socket.off(SC_AI_ACTION)
      socket.off(SC_AI_STATS)
      socket.off(SC_SUGGESTION)
    }
  }, [socket])

  // Clear suggestion when turn changes
  useEffect(() => {
    setSuggestion(null)
  }, [turn])

  return (
    <GameContext.Provider
      value={{
        messages,
        currentTable,
        seatId,
        isLeaving,
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
        turn,
        aiState,
        suggestion,
        lastAIAction,
        enableAI,
        disableAI,
        getSuggestion,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export default GameState
