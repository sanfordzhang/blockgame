import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../../socket';
import globalContext from '../global/globalContext';
import { SC_NFT_ACHIEVEMENT_EARNED, SC_NFT_MINT_READY } from '../../pokergame/actions';
import { buildApiUrl } from '../../utils/serverConfig';

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
          turn: seat.turn || false,
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
export const TournamentGameProvider = ({ children, tournamentId, walletAddress: walletAddressProp }) => {
  const { walletAddress: contextWalletAddress } = useContext(globalContext);
  const navigate = useNavigate();
  
  // Tournament routes carry the active player in the URL. Prefer that over
  // stale global/local wallet state from a previously connected account.
  const walletAddress = walletAddressProp ||
    new URLSearchParams(window.location.search).get('address') ||
    contextWalletAddress ||
    localStorage.getItem('wallet_address') ||
    localStorage.getItem('testWalletAddress');

  // Game state - same interface as gameContext
  const [messages, setMessages] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [seatId, setSeatId] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [tournamentEnded, setTournamentEnded] = useState(false);
  const [finalRankings, setFinalRankings] = useState([]);
  const [nftAchievement, setNftAchievement] = useState(null);  // NFT成就数据
  const [chipRewards, setChipRewards] = useState([]);  // CHIP奖励数据
  const [rakeAmount, setRakeAmount] = useState(0);  // 抽成金额
  const [showNftModal, setShowNftModal] = useState(false);  // 是否显示NFT弹窗

  const currentTableRef = useRef(currentTable);
  const seatIdRef = useRef(seatId);
  const tournamentEndedRef = useRef(tournamentEnded);
  const isLeavingRef = useRef(false);
  const pollTimerRef = useRef(null);
  const gameStatePollTimerRef = useRef(null);
  const nftAchievementRef = useRef(null);
  const nftFlowHoldUntilRef = useRef(0);
  const leaveNavigateTimerRef = useRef(null);

  // Keep refs in sync
  useEffect(() => {
    currentTableRef.current = currentTable;
  }, [currentTable]);

  useEffect(() => {
    seatIdRef.current = seatId;
  }, [seatId]);

  useEffect(() => {
    tournamentEndedRef.current = tournamentEnded;
  }, [tournamentEnded]);

  useEffect(() => {
    isLeavingRef.current = isLeaving;
  }, [isLeaving]);

  useEffect(() => {
    nftAchievementRef.current = nftAchievement;
    if (nftAchievement) {
      nftFlowHoldUntilRef.current = Date.now() + 180000;
    }
  }, [nftAchievement]);

  const shouldHoldTerminalStateForNft = useCallback(() => {
    return !!nftAchievementRef.current || Date.now() < nftFlowHoldUntilRef.current;
  }, []);

  const applyLiveState = useCallback((state) => {
    if (!state || ((tournamentEndedRef.current || state?.isTournamentActive === false) && !state?.showFinalHand)) return;

    const table = convertToTableFormat(state, tournamentId, walletAddress);
    setCurrentTable(table);

    let foundSeatId = null;
    const normalizedWalletAddress = walletAddress?.toLowerCase();
    if (state.seats) {
      for (const [id, seat] of Object.entries(state.seats)) {
        if (seat?.player?.id?.toLowerCase() === normalizedWalletAddress) {
          foundSeatId = parseInt(id);
          break;
        }
      }
    }

    if (foundSeatId !== null) {
      setSeatId(foundSeatId);
    }
  }, [tournamentId, walletAddress]);

  useEffect(() => {
    const syncLiveGameState = async () => {
      if (!tournamentId || !walletAddress || tournamentEndedRef.current) return;

      try {
        const response = await fetch(
          buildApiUrl(`/api/tournament/${tournamentId}/state?walletAddress=${encodeURIComponent(walletAddress)}`)
        );
        if (!response.ok) return;

        const data = await response.json();
        if (data?.success && data?.state) {
          applyLiveState(data.state);
        }
      } catch (err) {
        console.warn('[TournamentGameContext] Live game state poll failed:', err.message);
      }
    };

    const syncTournamentState = async () => {
      if (!tournamentId || tournamentEndedRef.current) return;
      try {
        const response = await fetch(buildApiUrl(`/api/tournament/${tournamentId}`));
        const data = await response.json();
        const tournamentRecord = data?.tournament;
        if (!tournamentRecord) return;

        setTournament(tournamentRecord);

        if (tournamentRecord.status === 'IN_PROGRESS') {
          await syncLiveGameState();
        }

        if (tournamentRecord.status === 'COMPLETED' || tournamentRecord.status === 'CANCELLED') {
          if (shouldHoldTerminalStateForNft()) {
            console.log('[TournamentGameContext] Holding terminal tournament poll while NFT flow is active');
            return;
          }

          const rankings = (tournamentRecord.rankings || []).map((ranking, index) => {
            if (ranking && typeof ranking === 'object') return ranking;
            return {
              address: ranking,
              position: index + 1,
              prizeAmount: 0
            };
          });

          console.log('[TournamentGameContext] Poll detected terminal tournament state, clearing table');
          tournamentEndedRef.current = true;
          setTournamentEnded(true);
          setFinalRankings(rankings);
          setChipRewards(tournamentRecord.chipRewards || []);
          setRakeAmount(tournamentRecord.rakeAmount || 0);
          setCurrentTable(null);
          setSeatId(null);
        }
      } catch (err) {
        console.warn('[TournamentGameContext] Tournament poll failed:', err.message);
      }
    };

    syncTournamentState();
    pollTimerRef.current = setInterval(syncTournamentState, 5000);
    gameStatePollTimerRef.current = setInterval(syncLiveGameState, 2000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      if (gameStatePollTimerRef.current) clearInterval(gameStatePollTimerRef.current);
      gameStatePollTimerRef.current = null;
    };
  }, [tournamentId, walletAddress, applyLiveState, shouldHoldTerminalStateForNft]);

  // Socket event handlers
  useEffect(() => {
    // 确保连接建立后再发送事件
    const joinRoom = async () => {
      console.log('[TournamentGameContext] Joining tournament room:', tournamentId, 'wallet:', walletAddress?.substring(0, 10));
      
      // First, join the tournament via API (this adds player to the tournament)
      try {
        const tournamentResponse = await fetch(buildApiUrl(`/api/tournament/${tournamentId}`));
        const tournamentData = await tournamentResponse.json();
        const alreadyJoined = tournamentData?.tournament?.players?.some(
          player => player.address?.toLowerCase() === walletAddress?.toLowerCase()
        );

        if (alreadyJoined || tournamentData?.tournament?.status === 'IN_PROGRESS') {
          console.log('[TournamentGameContext] Player already joined or tournament in progress, skipping Join API');
        } else {
          const response = await fetch(buildApiUrl(`/api/tournament/${tournamentId}/join`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-wallet-address': walletAddress
            },
            body: JSON.stringify({ walletAddress })
          });
          const data = await response.json();
          console.log('[TournamentGameContext] Join API response:', data);
        }
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

    // Diagnostic: warn if no game state received within 5s
    const noStateTimer = setTimeout(() => {
      if (!currentTableRef.current) {
        console.warn('[TournamentGameContext] >>> WARNING: No game state received after 5 seconds! currentTable is still null.');
        console.warn('[TournamentGameContext] >>> Possible causes: 1) Player not in DB players list, 2) Address case mismatch, 3) Socket not in room');
        console.warn('[TournamentGameContext] >>> socket.connected:', socket.connected);
      }
    }, 5000);

    // Room joined
    socket.on('SC_TOURNAMENT_ROOM_JOINED', (data) => {
      console.log('[TournamentGameContext] >>> SC_TOURNAMENT_ROOM_JOINED:', {
        tournamentId: data.tournamentId,
        status: data.tournament?.status,
        playerCount: data.playerCount,
        isReconnecting: data.isReconnecting,
        players: data.tournament?.players?.map(p => p.address?.substring(0, 10))
      });
      setTournament(data.tournament);
    });

    // Room error
    socket.on('SC_TOURNAMENT_ROOM_ERROR', (data) => {
      console.error('[TournamentGameContext] Room error:', data);
      setIsLeaving(false);
      isLeavingRef.current = false;
      addMessage(`Error: ${data.error || 'Failed to join tournament'}`);
    });

    // Game state update - convert tournament state to table format
    socket.on('tournament_game_state', (state) => {
      if ((tournamentEndedRef.current || state?.isTournamentActive === false) && !state?.showFinalHand) {
        if (shouldHoldTerminalStateForNft()) {
          console.log('[TournamentGameContext] Holding terminal game state while NFT flow is active');
          return;
        }
        console.log('[TournamentGameContext] Ignoring/clearing terminal tournament state');
        setCurrentTable(null);
        setSeatId(null);
        return;
      }

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
      
      // Find my seat (case-insensitive comparison for TRON addresses)
      let foundSeatId = null;
      const normalizedWalletAddress = walletAddress?.toLowerCase();
      if (state.seats) {
        for (const [id, seat] of Object.entries(state.seats)) {
          if (seat?.player?.id?.toLowerCase() === normalizedWalletAddress) {
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
      setTournamentEnded(false);
      setFinalRankings([]);
      setChipRewards([]);
      setRakeAmount(0);
      setCurrentTable(null);
      setSeatId(null);
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
      const alreadyEnded = tournamentEndedRef.current;
      console.log('[TournamentGameContext] ========== SC_TOURNAMENT_ENDED received ==========');
      console.log('[TournamentGameContext] Tournament ended:', data);
      console.log('[TournamentGameContext] Rankings:', data.rankings);
      console.log('[TournamentGameContext] CHIP Rewards:', data.chipRewards);
      console.log('[TournamentGameContext] Setting tournamentEnded to true');

      if (shouldHoldTerminalStateForNft()) {
        console.log('[TournamentGameContext] Holding tournament end screen while NFT flow is active');
        return;
      }

      const rankingsWithPrizes = (data.rankings || []).map((ranking, index) => {
        if (ranking && typeof ranking === 'object') return ranking;
        const address = ranking;
        const prize = (data.prizes || []).find(p => p.address?.toLowerCase() === address?.toLowerCase());
        return {
          address,
          position: index + 1,
          prizeAmount: prize?.prizeAmount || 0
        };
      });

      setTournamentEnded(true);
      setFinalRankings(rankingsWithPrizes);
      setChipRewards(data.chipRewards || []);
      setRakeAmount(data.rakeAmount || 0);
      setCurrentTable(null);
      setSeatId(null);
      setIsLeaving(false);
      isLeavingRef.current = false;

      if (alreadyEnded) {
        return;
      }

      const reason = data.reason === 'time_limit' ? 'Time limit reached!' : 'Tournament finished!';
      addMessage(reason);

      // Show winner
      if (data.rankings && data.rankings.length > 0) {
        const winner = data.rankings[0];
        addMessage(`Winner: ${winner.substring(0, 8)}...${winner.substring(winner.length - 4)}`);
      }

      // Show CHIP reward if any
      if (data.chipRewards && data.chipRewards.length > 0) {
        const chipReward = data.chipRewards[0];
        addMessage(`CHIP Bonus: +${chipReward.chipReward} CHIP (${chipReward.vipLevel})`);
      }

      console.log('[TournamentGameContext] Tournament end handling complete');
    });

    // NFT Achievement earned
    socket.on(SC_NFT_ACHIEVEMENT_EARNED, (data) => {
      console.log('[TournamentGameContext] 🎉 NFT Achievement earned:', data);
      nftAchievementRef.current = data;
      nftFlowHoldUntilRef.current = Date.now() + 180000;
      if (data?.gameState) {
        tournamentEndedRef.current = false;
        setTournamentEnded(false);
        applyLiveState(data.gameState);
      }
      setNftAchievement(data);
    });

    // NFT Mint ready
    socket.on(SC_NFT_MINT_READY, (data) => {
      console.log('[TournamentGameContext] NFT Mint ready:', data);
    });

    // Cleanup
    return () => {
      clearTimeout(noStateTimer);
      socket.off('connect', joinRoom);
      socket.off('SC_TOURNAMENT_ROOM_JOINED');
      socket.off('SC_TOURNAMENT_ROOM_ERROR');
      socket.off('tournament_game_state');
      socket.off('SC_TOURNAMENT_STARTED');
      socket.off('tournament_blind_update');
      socket.off('SC_TOURNAMENT_ENDED');
      socket.off(SC_NFT_ACHIEVEMENT_EARNED);
      socket.off(SC_NFT_MINT_READY);
      
      // Only send leave event if actively leaving (not tournament ended or navigating away)
      if (isLeavingRef.current && !tournamentEndedRef.current) {
        socket.emit('CS_TOURNAMENT_ROOM_LEAVE', { tournamentId });
      }

      if (leaveNavigateTimerRef.current) {
        clearTimeout(leaveNavigateTimerRef.current);
        leaveNavigateTimerRef.current = null;
      }
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

  const leaveTable = useCallback((options = {}) => {
    const { forceNavigate = false } = options;
    if (isLeavingRef.current) return;

    setIsLeaving(true);
    isLeavingRef.current = true;

    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      setIsLeaving(false);
      isLeavingRef.current = false;
      navigate('/tournament');
    }, 8000);

    socket.emit('CS_TOURNAMENT_ROOM_LEAVE', { tournamentId, walletAddress }, (ack = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      setIsLeaving(false);
      isLeavingRef.current = false;

      if (ack?.error) {
        addMessage(ack.error);
        return;
      }

      // For multi-player: tournament continues without us. Don't navigate immediately --
      // let TournamentTable.js show an "eliminated / left" intermediate screen.
      // The user can manually navigate back from there.
      // For forced navigation (e.g. explicit user request) or when tournament ended,
      // proceed with normal flow.
      if (!ack?.tournamentEnded && !forceNavigate) {
        // Stay on page -- setIsLeaving(true) already triggers eliminated-screen render in TournamentTable
        return;
      }
      if (forceNavigate) {
        navigate('/tournament');
        return;
      }

      if (leaveNavigateTimerRef.current) {
        clearTimeout(leaveNavigateTimerRef.current);
      }

      leaveNavigateTimerRef.current = setTimeout(() => {
        leaveNavigateTimerRef.current = null;
        if (!tournamentEndedRef.current) {
          navigate('/tournament');
        }
      }, 3000);
    });
  }, [addMessage, navigate, socket, tournamentId, walletAddress]);

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
        chipRewards,
        rakeAmount,
        // NFT Achievement
        nftAchievement,
        setNftAchievement,
        // Setter for isLeaving (needed for NFT mint flow)
        setIsLeaving,
      }}
    >
      {children}
    </TournamentGameContext.Provider>
  );
};

export default TournamentGameContext;
