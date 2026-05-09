/**
 * ZeroGEventListener - Event Monitor for 0G Chain Smart Contracts
 * Uses ethers.js v6 queryFilter to listen for contract events
 */

const config = require('../config');

class ZeroGEventListener {
    constructor() {
        this.zeroGService = null;
        this.contractService = null;
        this.pollInterval = null;
        this.isRunning = false;
        this.lastProcessedBlock = 0;
    }

    init(zeroGService) {
        this.zeroGService = zeroGService;
        console.log('[ZeroGEventListener] Initialized');
        return this;
    }

    setContractService(contractService) {
        this.contractService = contractService;
    }

    start() {
        if (this.isRunning) return;
        if (!this.zeroGService?.initialized) {
            console.warn('[ZeroGEventListener] Cannot start: ZeroGService not initialized');
            return;
        }

        this.isRunning = true;
        this._initLastBlock();

        // Poll for events every 10 seconds
        this.pollInterval = setInterval(() => this._pollEvents(), 10000);
        console.log('[ZeroGEventListener] Event polling started (10s interval)');
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isRunning = false;
        console.log('[ZeroGEventListener] Event polling stopped');
    }

    async _initLastBlock() {
        try {
            this.lastProcessedBlock = await this.zeroGService.provider.getBlockNumber();
            console.log(`[ZeroGEventListener] Starting from block ${this.lastProcessedBlock}`);
        } catch (e) {
            this.lastProcessedBlock = 0;
            console.warn('[ZeroGEventListener] Could not get latest block, starting from 0');
        }
    }

    async _pollEvents() {
        if (!this.isRunning) return;

        try {
            const latestBlock = await this.zeroGService.provider.getBlockNumber();

            if (latestBlock <= this.lastProcessedBlock) return;

            // Process events in batches to avoid RPC limits
            const batchSize = 1000;
            const fromBlock = this.lastProcessedBlock + 1;
            const toBlock = Math.min(fromBlock + batchSize - 1, latestBlock);

            await this._processPokerGameEvents(fromBlock, toBlock);
            await this._processINFTEvents(fromBlock, toBlock);

            this.lastProcessedBlock = toBlock;
        } catch (error) {
            console.error(`[ZeroGEventListener] Poll error (${new Date().toISOString()}):`, error.message);
        }
    }

    async _processPokerGameEvents(fromBlock, toBlock) {
        if (!this.contractService?.pokerGameContract) return;

        try {
            const contract = this.contractService.pokerGameContract;

            // Listen for Deposited events
            const depositFilter = contract.filters.Deposited();
            const deposits = await contract.queryFilter(depositFilter, fromBlock, toBlock);
            for (const log of deposits) {
                await this._handleDeposit(log);
            }

            // Listen for Withdrawn events
            const withdrawalFilter = contract.filters.Withdrawn();
            const withdrawals = await contract.queryFilter(withdrawalFilter, fromBlock, toBlock);
            for (const log of withdrawals) {
                await this._handleWithdrawal(log);
            }

            // Listen for Settled events
            const settleFilter = contract.filters.Settled();
            const settlements = await contract.queryFilter(settleFilter, fromBlock, toBlock);
            for (const log of settlements) {
                await this._handleSettlement(log);
            }

            if (deposits.length || withdrawals.length || settlements.length) {
                console.log(
                    `[ZeroGEventListener] Blocks ${fromBlock}-${toBlock}: ` +
                    `${deposits.length} deposits, ${withdrawals.length} withdrawals, ${settlements.length} settlements`
                );
            }
        } catch (e) {
            console.error('[ZeroGEventListener] PokerGame event processing error:', e.message);
        }
    }

    async _processINFTEvents(fromBlock, toBlock) {
        if (!this.contractService?.inftContract) return;

        try {
            const contract = this.contractService.inftContract;

            // Listen for PokerHandMinted events
            const mintFilter = contract.filters.PokerHandMinted();
            const mints = await contract.queryFilter(mintFilter, fromBlock, toBlock);
            for (const log of mints) {
                await this._handleINFTMint(log);
            }

            // Listen for EncryptedTransfer events
            const xferFilter = contract.filters.EncryptedTransferEvent();
            const xfers = await contract.queryFilter(xferFilter, fromBlock, toBlock);
            for (const log of xfers) {
                await this._handleEncryptedTransfer(log);
            }

            // Listen for Cloned events
            const cloneFilter = contract.filters.Cloned();
            const clones = await contract.queryFilter(cloneFilter, fromBlock, toBlock);
            for (const log of clones) {
                await this._handleClone(log);
            }

            // Listen for AgentBound/Unbound events
            const agentBindFilter = contract.filters.AgentBound();
            const binds = await contract.queryFilter(agentBindFilter, fromBlock, toBlock);
            for (const log of binds) {
                await this._handleAgentBound(log);
            }
        } catch (e) {
            console.error('[ZeroGEventListener] INFT event processing error:', e.message);
        }
    }

    // ============ Event Handlers ============

    async _handleDeposit(log) {
        const { player, amount } = log.args;
        console.log(`[ZeroGEventListener] 📥 Deposit: ${player} deposited ${log.args.amount.toString()}wei`);
        // Update player balance in DB
        // TODO: integrate with balance update logic
    }

    async _handleWithdrawal(log) {
        const { player, amount } = log.args;
        console.log(`[ZeroGEventListener] 📤 Withdrawal: ${player} withdrew ${amount.toString()}wei`);
    }

    async _handleSettlement(log) {
        const { handId, winners, amounts, totalPot, rake, stateHash } = log.args;
        console.log(
            `[ZeroGEventListener] ✅ Settlement #${handId}: ` +
            `${winners.length} winners, pot=${totalPot.toString()}, rake=${rake.toString()}`
        );

        // Trigger DA layer submission for state hash
        if (global.zeroGDAService && stateHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            global.zeroGDAService.submitStateHash({ handId: handId.toString(), stateHash })
                .catch(e => console.warn('[ZeroGEventListener] DA submission failed:', e.message));
        }
    }

    async _handleINFTMint(log) {
        const { tokenId, handType, to, storageRootHash } = log.args;
        console.log(`[ZeroGEventListener] 🎴 INFT #${tokenId} minted: ${handType} → ${to}`);
        // Update MongoDB nft_claims record
        // TODO: integrate with NFT DB model
    }

    async _handleEncryptedTransfer(log) {
        const { tokenId, from, to } = log.args;
        console.log(`[ZeroGEventListener] 🔐 Encrypted Transfer: #${tokenId} ${from} → ${to}`);
    }

    async _handleClone(log) {
        const { originalTokenId, newTokenId, owner } = log.args;
        console.log(`[ZeroGEventListener] 📋 Clone: #${originalTokenId} → #${newTokenId} → ${owner}`);
    }

    async _handleAgentBound(log) {
        const { tokenId, agentAddress } = log.args;
        console.log(`[ZeroGEventListener] 🤖 Agent Bound: #${tokenId} ↔ ${agentAddress}`);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            lastProcessedBlock: this.lastProcessedBlock,
            hasZeroGService: !!this.zeroGService,
            hasContractService: !!this.contractService
        };
    }
}

module.exports = ZeroGEventListener;
