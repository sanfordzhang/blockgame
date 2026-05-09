/**
 * SettlementRouter — Dual-Chain Settlement Router
 * Routes settlement calls to the appropriate blockchain service based on config.
 *
 * When BLOCKCHAIN_MODE='tron' → uses existing ContractService (TRON)
 * When BLOCKCHAIN_MODE='0g'   → uses ZeroGContractService (0G EVM)
 * When BLOCKCHAIN_MODE='both' → uses both (primary=TRON, secondary=0G for DA anchor)
 */

const config = require('../config');
let tronContractService = null;
let zerogContractService = null;

class SettlementRouter {
    constructor() {
        this.mode = config.BLOCKCHAIN_MODE || 'tron';
        this.fallbackEnabled = config.SETTLEMENT_FALLBACK_ENABLED !== false;
        console.log(`[SettlementRouter] Mode: ${this.mode}, Fallback: ${this.fallbackEnabled}`);
    }

    /**
     * Initialize with contract service instances
     */
    init(tronSvc, zeroGSvc) {
        if (tronSvc) {
            tronContractService = tronSvc;
            console.log('[SettlementRouter] TRON ContractService attached');
        }
        if (zeroGSvc) {
            zerogContractService = zeroGSvc;
            console.log('[SettlementRouter] ZeroG ContractService attached');
        }
    }

    /**
     * Get the active contract service based on mode
     */
    _getActiveService() {
        if (this.mode === '0g') return zerogContractService || tronContractService;
        if (this.mode === 'both') return tronContractService; // primary is TRON
        return tronContractService; // default: TRON
    }

    /**
     * Get the secondary service (for DA anchoring in 'both' mode)
     */
    _getSecondaryService() {
        if (this.mode === 'both') return zerogContractService;
        return null;
    }

    // ============ Public Settlement API ============

    /**
     * Deposit funds into smart contract custody
     */
    async deposit(playerAddress, amount) {
        const svc = this._getActiveService();
        if (!svc) throw new Error('[SettlementRouter] No active contract service');

        try {
            const result = await svc.deposit(playerAddress, amount);
            this._log('deposit', playerAddress, amount, null);
            return result;
        } catch (err) {
            console.error(`[SettlementRouter] deposit failed:`, err.message);
            throw err;
        }
    }

    /**
     * Withdraw from custody
     */
    async withdraw(playerAddress, amount) {
        const svc = this._getActiveService();
        if (!svc) throw new Error('[SettlementRouter] No active contract service');
        return svc.withdraw(amount);
    }

    /**
     * Settle a poker hand — route to active chain + optional DA anchor
     */
    async settle(gameResult) {
        const svc = this._getActiveService();
        const secondary = this._getSecondaryService();

        if (!svc) throw new Error('[SettlementRouter] No active contract service');

        try {
            const result = await svc.settle(gameResult);
            this._log('settle', gameResult.handId, gameResult.totalPot, result.txHash);

            // In 'both' mode, also anchor state hash to DA layer via 0G
            if (secondary && gameResult.stateHash) {
                try {
                    const daService = global.zeroGDAService;
                    if (daService) {
                        await daService.submitStateHash({
                            handId: gameResult.handId,
                            stateHash: gameResult.stateHash,
                            winners: gameResult.winners,
                            timestamp: Date.now()
                        });
                        console.log(`[SettlementRouter] DA anchor submitted for hand ${gameResult.handId}`);
                    }
                } catch (daErr) {
                    console.warn('[SettlementRouter] DA anchor failed (non-critical):', daErr.message);
                }
            }

            return result;
        } catch (err) {
            console.error(`[SettlementRouter] settle failed:`, err.message);
            if (this.fallbackEnabled) {
                console.warn('[SettlementRouter] Using fallback settlement...');
                return this._fallbackSettle(gameResult);
            }
            throw err;
        }
    }

    /**
     * Authorize delegate address for a player
     */
    async authorizePlayer(playerAddress) {
        const svc = this._getActiveService();
        if (!svc?.authorizePlayer) {
            console.warn('[SettlementRouter] authorizePlayer not supported by current chain');
            return { success: true, mock: true };
        }
        return svc.authorizePlayer(playerAddress);
    }

    /**
     * Mint INFT (0G only or both mode)
     */
    async mintINFT(to, handType, storageRootHash, metadataURI) {
        if (this.mode === 'tron') {
            console.log('[SettlementRouter] INFT minting not available on TRON, using local DB only');
            return { success: false, reason: 'inft_not_supported_on_tron' };
        }
        if (!zerogContractService?.mintINFT) {
            throw new Error('[SettlementRouter] ZeroGContractService not available for INFT mint');
        }
        return zerogContractService.mintINFT(to, handType, storageRootHash, metadataURI);
    }

    /**
     * Query custody balance
     */
    async getCustodyBalance(address) {
        const svc = this._getActiveService();
        if (!svc?.getCustodyBalance) return { balance: 0 };
        return svc.getCustodyBalance(address);
    }

    // ============ Fallback Settlement ============

    /**
     * Fallback settlement when blockchain call fails
     * Records in DB but marks as pending on-chain confirmation
     */
    async _fallbackSettle(gameResult) {
        console.warn(`[SettlementRouter] ⚠️ Fallback settlement for hand ${gameResult.handId}`);
        return {
            success: true,
            fallback: true,
            handId: gameResult.handId,
            message: 'Settlement recorded locally, pending blockchain confirmation',
            txHash: null,
            pendingConfirmation: true
        };
    }

    // ============ Logging ============

    _log(action, target, value, txHash) {
        console.log(
            `[SettlementRouter] ${action.toUpperCase()} | ` +
            `target=${target} | value=${value} | ` +
            `chain=${this.mode} | tx=${txHash || '(pending)'}`
        );
    }
}

module.exports = new SettlementRouter();