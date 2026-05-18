/**
 * Blockchain Factory
 * Creates appropriate blockchain service instance based on configuration
 */

const config = require('../config');
const TronService = require('./TronService');
const ZeroGService = require('./ZeroGService');

// Singleton instances
let _tronInstance = null;
let _zerogInstance = null;

/**
 * Create or get singleton TronService instance
 * @returns {TronService}
 */
function getTronService() {
    if (!_tronInstance) {
        _tronInstance = new TronService();
        _tronInstance.init(config.TRON_NETWORK);
    }
    return _tronInstance;
}

/**
 * Create or get singleton ZeroGService instance
 * @returns {ZeroGService}
 */
function getZeroGService() {
    if (!_zerogInstance && config.ZEROG_ENABLED) {
        _zerogInstance = new ZeroGService();
        _zerogInstance.init(config.ZEROG_NETWORK);
    }
    return _zerogInstance;
}

/**
 * Get primary blockchain service based on current mode
 * When BLOCKCHAIN_MODE is 'both', returns an object with both services
 * 
 * @returns {TronService|ZeroGService|{tron: TronService, zerog: ZeroGService}}
 */
function getPrimaryService() {
    const mode = config.BLOCKCHAIN_MODE;

    switch (mode) {
        case '0g':
            return getZeroGService();
        case 'both':
            return {
                tron: getTronService(),
                zerog: getZeroGService(),
                isDualMode: true
            };
        case 'tron':
        default:
            return getTronService();
    }
}

/**
 * Initialize all enabled services
 * Should be called during server startup
 * @returns {{ tron: TronService|null, zerog: ZeroGService|null }}
 */
function initializeAll() {
    const result = { tron: null, zerog: null };
    const mode = config.BLOCKCHAIN_MODE;

    // Init TRON only when selected. In 0G-only mode there is no TRON server wallet.
    if (mode === 'tron' || mode === 'both') {
        try {
            result.tron = getTronService();
            console.log('[BlockchainFactory] TRON service initialized');
        } catch (e) {
            console.error('[BlockchainFactory] TRON init failed:', e.message);
        }
    } else {
        console.log('[BlockchainFactory] TRON service skipped (0G-only mode)');
    }

    // Init 0G if enabled
    if (config.ZEROG_ENABLED && (mode === '0g' || mode === 'both')) {
        try {
            result.zerog = getZeroGService();
            console.log('[BlockchainFactory] 0G service initialized');
        } catch (e) {
            console.error('[BlockchainFactory] 0G init failed:', e.message);
        }
    } else {
        console.log('[BlockchainFactory] 0G service skipped (disabled or not selected)');
    }

    console.log(`[BlockchainFactory] Mode: ${mode}`);
    
    return result;
}

module.exports = {
    getTronService,
    getZeroGService,
    getPrimaryService,
    initializeAll
};
