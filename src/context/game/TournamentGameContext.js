import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import socket from '../../socket';
import globalContext from '../global/globalContext';

export const TournamentGameContext = createContext();

/**
 * Convert tournament game state to table format compatible with Play.js components
 */
const convertToTableFormat = (state, tournamentId, playerAddress) => {
  if (!state) return null;

  const seats = {};
  let button = 0;
  let smallBlind = 0;
  let bigBlind = 1;
  let callAmount = 0;
  let minBet = state.currentBlinds?.small || state.bigBlind || 500000;
  let minRaise = minBet * 2;

  // Convert seats array to object format
  if (state.seats) {
    Object.entries(state.seats).forEach(([id, seat]) => {
      if (seat && seat.player) {
        const seatNum = parseInt(id);
        seats[seatNum] = {
          player: {
            id: seat.player.id,
            name: seat.player.name || seat.player.id?.substring(0, 8) + '...',
          },
          stack: seat.stack || 0,
          bet: seat.bet || 0,
          hand: seat.hand || [],
          folded: seat.folded || false,
          turn: state.turn === seatNum,
          lastAction: seat.lastAction || null,
          sittingOut: seat.sittingOut || false,
        };

        // Track call amount
        if (seat.bet > callAmount) {
          callAmount = seat.bet;
        }
      }
    });
  }

  // Determine button/blind positions from state
  if (state.button !== undefined) button = state.button;
  if (state.smallBlind !== undefined) smallBlind = state.smallBlind;
  if (state.bigBlind !== undefined) bigBlind = state.bigBlind;

  return {
    id: `tournament-${tournamentId}`,
    seats,
    board: state.board || [],
    pot: state.pot || 0,
    mainPot: state.pot || 0,
    sidePots: state.sidePots || [],
    button,
    smallBlind,
    bigBlind,
    callAmount,
    minBet,
    minRaise,
    limit: state.initialChips || 10000000,
    players: Object.values(seats).filter(s => s && s.player).length,
    handOver: state.handOver || false,
    wentToShowdown: state.wentToShowdown || false,
    winMessages: state.winMessages || [],
    // Tournament specific fields
    blindLevel: state.blindLevel || 1,
    handsPlayed: state.handsPlayed || 0,
    currentBlinds: state.currentBlinds || { small: minBet, big: minBet * 2 },
    remainingTime: state.remainingTime || null,
    isTournamentActive: state.isTournamentActive !== false,
    remainingPlayers: state.remainingPlayers || [],
    eliminatedPlayers: state.eliminatedPlayers || [],
  };
};

/**
 * TournamentGameContext - 锦标赛游戏状态管理
 * 提供与 gameContext 相同的接口，复用 Play.js 的 UI 组件
 */
export const TournamentGameProvider = ({ children, tournamentId }) => {
  const { walletAddress: contextWalletAddress } = useContext(globalContext);
  
  // Get wallet address from context or URL params
  const walletAddress = contextWalletAddress || 
    new URLSearchParams(window.location.search).get('address') || 
    localStorage.getItem('testWalletAddress');

  // Game state - same interface as gameContext
  const [messages, setMessages] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [seatId, setSeatId] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [tournamentEnded, setTournamentEnded] = useState(false);
  const [finalRankings, setFinalRankings] = useState([]);

  const currentTableRef = useRef(currentTable);
  const seatIdRef = useRef(seatId);

  // Keep refs in sync
  useEffect(() => {
    currentTableRef.current = currentTable;
  }, [currentTable]);

  useEffect(() => {
    seatIdRef.current = seatId;
  }, [seatId]);

  // Socket event handlers
  useEffect(() => {
    // 确保连接建立后再发送事件
    const joinRoom = async () => {
      console.log('[TournamentGameContext] Joining tournament room:', tournamentId, 'wallet:', walletAddress?.substring(0, 10));
      
      // First, join the tournament via API (this adds player to the tournament)
      try {
        const response = await fetch(`http://127.0.0.1:7778/api/tournament/${tournamentId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress
          },
          body: JSON.stringify({ walletAddress })
        });
        const data = await response.json();
        console.log('[TournamentGameContext] Join API response:', data);
      } catch (err) {
        console.error('[TournamentGameContext] Join API error:', err);
      }
      
      // Then join the socket room
      socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      // 等待连接建立
      socket.once('connect', joinRoom);
      socket.connect();
    }

    // Room joined
    socket.on('SC_TOURNAMENT_ROOM_JOINED', (data) => {
      console.log('[TournamentGameContext] Room joined:', data);
      setTournament(data.tournament);
    });

    // Room error
    socket.on('SC_TOURNAMENT_ROOM_ERROR', (data) => {
      console.error('[TournamentGameContext] Room error:', data);
      addMessage(`Error: ${data.error || 'Failed to join tournament'}`);
    });

    // Game state update - convert tournament state to table format
    socket.on('tournament_game_state', (state) => {
      console.log('[TournamentGameContext] Game state received:', {
        tournamentId: state.tournamentId,
        turn: state.turn,
        pot: state.pot,
        boardLength: state.board?.length,
        seatsCount: state.seats ? Object.keys(state.seats).length : 0,
        seatsTurnInfo: state.seats ? Object.entries(state.seats).map(([id, s]) => ({ seatId: id, turn: s.turn, player: s.player?.id?.substring(0, 10) })) : []
      });
      
      // Convert tournament state to table format compatible with Play.js components
      const table = convertToTableFormat(state, tournamentId, walletAddress);
      
      // Debug: log the converted table
      console.log('[TournamentGameContext] Converted table:', {
        turn: table?.turn,
        mySeatId: Object.entries(table?.seats || {}).find(([id, s]) => s?.player?.id === walletAddress)?.[0],
        mySeatTurn: Object.entries(table?.seats || {}).find(([id, s]) => s?.player?.id === walletAddress)?.[1]?.turn
      });
      
      setCurrentTable(table);
      
      // Find my seat
      let foundSeatId = null;
      if (state.seats) {
        for (const [id, seat] of Object.entries(state.seats)) {
          if (seat?.player?.id === walletAddress) {
            foundSeatId = parseInt(id);
            setSeatId(foundSeatId);
            console.log('[TournamentGameContext] Found my seat:', foundSeatId, 'myTurn:', seat.turn, 'globalTurn:', state.turn);
            break;
          }
        }
      }
      
      if (!foundSeatId) {
        console.log('[TournamentGameContext] WARNING: Could not find seat for wallet:', walletAddress);
      }
    });

    // Tournament started
    socket.on('SC_TOURNAMENT_STARTED', (data) => {
      console.log('[TournamentGameContext] Tournament started:', data);
      setTournament(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : { status: 'IN_PROGRESS' });
      addMessage('Tournament started!');
    });

    // Blind level increased
    socket.on('tournament_blind_update', (data) => {
      console.log('[TournamentGameContext] Blind update:', data);
      addMessage(`Blinds increased to ${data.smallBlind / 1000000}M / ${data.bigBlind / 1000000}M (Level ${data.blindLevel})`);
    });

    // Tournament ended
    socket.on('SC_TOURNAMENT_ENDED', (data) => {
      console.log('[TournamentGameContext] ========== SC_TOURNAMENT_ENDED received ==========');
      console.log('[TournamentGameContext] Tournament ended:', data);
      console.log('[TournamentGameContext] Rankings:', data.rankings);
      console.log('[TournamentGameContext] Setting tournamentEnded to true');

      setTournamentEnded(true);
      setFinalRankings(data.rankings || []);
      const reason = data.reason === 'time_limit' ? 'Time limit reached!' : 'Tournament finished!';
      addMessage(reason);

      // Show winner
      if (data.rankings && data.rankings.length > 0) {
        const winner = data.rankings[0];
        addMessage(`Winner: ${winner.substring(0, 8)}...${winner.substring(winner.length - 4)}`);
      }

      console.log('[TournamentGameContext] Tournament end handling complete');
    });

    // Cleanup
    return () => {
      socket.off('connect', joinRoom);
      socket.off('SC_TOURNAMENT_ROOM_JOINED');
      socket.off('SC_TOURNAMENT_ROOM_ERROR');
      socket.off('tournament_game_state');
      socket.off('SC_TOURNAMENT_STARTED');
      socket.off('tournament_blind_update');
      socket.off('SC_TOURNAMENT_ENDED');
      socket.emit('CS_TOURNAMENT_ROOM_LEAVE', { tournamentId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, walletAddress]);



  // Game actions - emit tournament events
  const fold = useCallback(() => {
    socket.emit('CS_TOURNAMENT_FOLD', { tournamentId });
  }, [tournamentId]);

  const check = useCallback(() => {
    socket.emit('CS_TOURNAMENT_CHECK', { tournamentId });
  }, [tournamentId]);

  const call = useCallback(() => {
    socket.emit('CS_TOURNAMENT_CALL', { tournamentId });
  }, [tournamentId]);

  const raise = useCallback((amount) => {
    socket.emit('CS_TOURNAMENT_RAISE', { tournamentId, amount });
  }, [tournamentId]);

  // Helper functions
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const leaveTable = useCallback(() => {
    setIsLeaving(true);
    socket.emit('CS_TOURNAMENT_ROOM_LEAVE', { tournamentId });
    // Navigate will be handled by parent component
  }, [tournamentId]);

  // Stub functions (not needed for tournament but required for Seat component)
  const sitDown = useCallback(() => {
    console.log('[TournamentGameContext] sitDown not applicable for tournament');
  }, []);

  const standUp = useCallback(() => {
    console.log('[TournamentGameContext] standUp not applicable for tournament');
  }, []);

  const rebuy = useCallback(() => {
    console.log('[TournamentGameContext] rebuy not applicable for tournament');
  }, []);

  const joinTable = useCallback(() => {
    console.log('[TournamentGameContext] joinTable handled by room join');
  }, []);

  return (
    <TournamentGameContext.Provider
      value={{
        // Same interface as gameContext
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
        // Additional tournament-specific state
        tournament,
        walletAddress,
        tournamentEnded,
        finalRankings,
      }}
    >
      {children}
    </TournamentGameContext.Provider>
  );
};

export default TournamentGameContext;
