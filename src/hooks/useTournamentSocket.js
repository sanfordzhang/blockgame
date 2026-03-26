import { useEffect, useCallback } from 'react';
import { useContext } from 'react';
import globalContext from '../context/global/globalContext';
import {
  SC_TOURNAMENT_LIST,
  SC_TOURNAMENT_JOINED,
  SC_TOURNAMENT_JOIN_ERROR,
  SC_TOURNAMENT_CANCELLED,
  SC_TOURNAMENT_STARTED,
  SC_TOURNAMENT_ENDED,
  SC_TOURNAMENT_UPDATE,
  SC_TOURNAMENT_ELIMINATION,
  SC_TOURNAMENT_PRIZE,
  SC_NFT_ACHIEVEMENT_EARNED,
  SC_NFT_ACHIEVEMENT_NONE,
  SC_NFT_MINT_READY,
  SC_NFT_MINT_ERROR,
  SC_NFT_COLLECTION,
  SC_CHIP_BALANCE,
  SC_CHIP_REWARDED,
  SC_CHIP_VIP_DISCOUNT,
  SC_STAKE_INFO,
  SC_STAKE_CREATED,
  SC_STAKE_ERROR,
  SC_STAKE_UNSTAKED,
  SC_STAKE_REWARD_CLAIMED,
  SC_DAO_PROPOSALS,
  SC_DAO_PROPOSAL_CREATED,
  SC_DAO_VOTED,
  SC_DAO_PROPOSAL_EXECUTED,
  SC_DAO_PROPOSAL_STATE_CHANGED,
} from '../pokergame/actions';

/**
 * Hook for handling tournament and related Socket events
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} callbacks - Callback functions for various events
 */
export function useTournamentSocket(socket, callbacks = {}) {
  const { setTournaments, setNFTs, setBalance, setProposals } = callbacks;

  // Tournament events
  useEffect(() => {
    if (!socket) return;

    const handleTournamentList = (data) => {
      console.log('[Socket] Tournament list received:', data);
      setTournaments?.(data.tournaments);
    };

    const handleTournamentJoined = (data) => {
      console.log('[Socket] Tournament joined:', data);
      callbacks.onTournamentJoined?.(data);
    };

    const handleTournamentJoinError = (data) => {
      console.error('[Socket] Tournament join error:', data);
      callbacks.onError?.(data.error);
    };

    const handleTournamentStarted = (data) => {
      console.log('[Socket] Tournament started:', data);
      callbacks.onTournamentStarted?.(data);
    };

    const handleTournamentEnded = (data) => {
      console.log('[Socket] Tournament ended:', data);
      callbacks.onTournamentEnded?.(data);
    };

    const handleTournamentElimination = (data) => {
      console.log('[Socket] Player eliminated:', data);
      callbacks.onElimination?.(data);
    };

    const handleTournamentPrize = (data) => {
      console.log('[Socket] Prize won:', data);
      callbacks.onPrize?.(data);
    };

    socket.on(SC_TOURNAMENT_LIST, handleTournamentList);
    socket.on(SC_TOURNAMENT_JOINED, handleTournamentJoined);
    socket.on(SC_TOURNAMENT_JOIN_ERROR, handleTournamentJoinError);
    socket.on(SC_TOURNAMENT_STARTED, handleTournamentStarted);
    socket.on(SC_TOURNAMENT_ENDED, handleTournamentEnded);
    socket.on(SC_TOURNAMENT_ELIMINATION, handleTournamentElimination);
    socket.on(SC_TOURNAMENT_PRIZE, handleTournamentPrize);

    return () => {
      socket.off(SC_TOURNAMENT_LIST, handleTournamentList);
      socket.off(SC_TOURNAMENT_JOINED, handleTournamentJoined);
      socket.off(SC_TOURNAMENT_JOIN_ERROR, handleTournamentJoinError);
      socket.off(SC_TOURNAMENT_STARTED, handleTournamentStarted);
      socket.off(SC_TOURNAMENT_ENDED, handleTournamentEnded);
      socket.off(SC_TOURNAMENT_ELIMINATION, handleTournamentElimination);
      socket.off(SC_TOURNAMENT_PRIZE, handleTournamentPrize);
    };
  }, [socket, setTournaments, callbacks]);

  // NFT events
  useEffect(() => {
    if (!socket) return;

    const handleAchievementEarned = (data) => {
      console.log('[Socket] Achievement earned:', data);
      callbacks.onAchievementEarned?.(data);
    };

    const handleMintReady = (data) => {
      console.log('[Socket] NFT mint ready:', data);
      callbacks.onNFTMintReady?.(data);
    };

    const handleNFTCollection = (data) => {
      console.log('[Socket] NFT collection received:', data);
      setNFTs?.(data.nfts);
    };

    socket.on(SC_NFT_ACHIEVEMENT_EARNED, handleAchievementEarned);
    socket.on(SC_NFT_MINT_READY, handleMintReady);
    socket.on(SC_NFT_COLLECTION, handleNFTCollection);

    return () => {
      socket.off(SC_NFT_ACHIEVEMENT_EARNED, handleAchievementEarned);
      socket.off(SC_NFT_MINT_READY, handleMintReady);
      socket.off(SC_NFT_COLLECTION, handleNFTCollection);
    };
  }, [socket, setNFTs, callbacks]);

  // CHIP events
  useEffect(() => {
    if (!socket) return;

    const handleChipBalance = (data) => {
      console.log('[Socket] CHIP balance:', data);
      setBalance?.(data);
    };

    const handleChipRewarded = (data) => {
      console.log('[Socket] CHIP rewarded:', data);
      callbacks.onChipRewarded?.(data);
    };

    const handleVIPDiscount = (data) => {
      console.log('[Socket] VIP discount:', data);
      callbacks.onVIPDiscount?.(data);
    };

    socket.on(SC_CHIP_BALANCE, handleChipBalance);
    socket.on(SC_CHIP_REWARDED, handleChipRewarded);
    socket.on(SC_CHIP_VIP_DISCOUNT, handleVIPDiscount);

    return () => {
      socket.off(SC_CHIP_BALANCE, handleChipBalance);
      socket.off(SC_CHIP_REWARDED, handleChipRewarded);
      socket.off(SC_CHIP_VIP_DISCOUNT, handleVIPDiscount);
    };
  }, [socket, setBalance, callbacks]);

  // Staking events
  useEffect(() => {
    if (!socket) return;

    const handleStakeInfo = (data) => {
      console.log('[Socket] Stake info:', data);
      callbacks.onStakeInfo?.(data);
    };

    const handleStakeCreated = (data) => {
      console.log('[Socket] Stake created:', data);
      callbacks.onStakeCreated?.(data);
    };

    const handleStakeError = (data) => {
      console.error('[Socket] Stake error:', data);
      callbacks.onError?.(data.error);
    };

    socket.on(SC_STAKE_INFO, handleStakeInfo);
    socket.on(SC_STAKE_CREATED, handleStakeCreated);
    socket.on(SC_STAKE_ERROR, handleStakeError);

    return () => {
      socket.off(SC_STAKE_INFO, handleStakeInfo);
      socket.off(SC_STAKE_CREATED, handleStakeCreated);
      socket.off(SC_STAKE_ERROR, handleStakeError);
    };
  }, [socket, callbacks]);

  // DAO events
  useEffect(() => {
    if (!socket) return;

    const handleDAOProposals = (data) => {
      console.log('[Socket] DAO proposals:', data);
      setProposals?.(data.proposals);
    };

    const handleProposalCreated = (data) => {
      console.log('[Socket] Proposal created:', data);
      callbacks.onProposalCreated?.(data);
    };

    const handleVoted = (data) => {
      console.log('[Socket] Vote cast:', data);
      callbacks.onVoted?.(data);
    };

    const handleProposalExecuted = (data) => {
      console.log('[Socket] Proposal executed:', data);
      callbacks.onProposalExecuted?.(data);
    };

    socket.on(SC_DAO_PROPOSALS, handleDAOProposals);
    socket.on(SC_DAO_PROPOSAL_CREATED, handleProposalCreated);
    socket.on(SC_DAO_VOTED, handleVoted);
    socket.on(SC_DAO_PROPOSAL_EXECUTED, handleProposalExecuted);

    return () => {
      socket.off(SC_DAO_PROPOSALS, handleDAOProposals);
      socket.off(SC_DAO_PROPOSAL_CREATED, handleProposalCreated);
      socket.off(SC_DAO_VOTED, handleVoted);
      socket.off(SC_DAO_PROPOSAL_EXECUTED, handleProposalExecuted);
    };
  }, [socket, setProposals, callbacks]);
}

export default useTournamentSocket;
