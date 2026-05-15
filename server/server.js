// Load environment variables FIRST (before any other imports)
require("./config/loadEnv")();

const path = require("path");
const express = require("express");
const connectDB = require('./config/db');
const configureMiddleware = require("./middleware");
const configureRoutes = require("./routes");
const socketio = require("socket.io");
const gameSocket = require("./socket/index");
const { socketCorsOptions } = require('./middleware/corsConfig');

// Then load config (which depends on env vars)
const config = require("./config");

// Blockchain services
const { TronService, ContractService } = require("./blockchain");
const EventListener = require("./blockchain/EventListener");
const GameSettlementService = require("./services/GameSettlementService");
const gameFlowIntegration = require("./services/GameFlowIntegration");
const { initNFTService, getNFTService } = require("./services/NFTService");
const { initChipService } = require("./services/ChipService");
const LiquidityService = require("./services/LiquidityService");
const PriceOracleService = require("./services/PriceOracleService");
const ammApi = require("./routes/api/amm");

// 0G (ZeroGravity) blockchain services
let ZeroGService, ZeroGContractService, ZeroGEventListener;
if (config.ZEROG_ENABLED) {
    try {
        const zerogModule = require('./blockchain/blockchainFactory');
        // Lazy-load 0G services (only import when needed)
    } catch (e) {
        console.log('[Server] 0G services not available:', e.message);
    }
}
// Connect and get reference to mongodb instance
let db;

(async function () {
  db = await connectDB();
})();

// Init express app
const app = express();

// Config Express-Middleware
configureMiddleware(app);

// Set-up Routes
configureRoutes(app);

// Initialize blockchain services if enabled
async function initializeBlockchainServices() {
    if (config.BLOCKCHAIN_ENABLED) {
        try {
            console.log('[Server] Initializing blockchain services...');

            const isZeroGOnly = config.BLOCKCHAIN_MODE === '0g';

            if (!isZeroGOnly) {
                // Initialize TronService
                await TronService.init(config.TRON_NETWORK);

                // Initialize ContractService
                ContractService.init(TronService, config.TRON_NETWORK);

                // Initialize GameSettlementService
                const TransactionQueue = require('./blockchain/TransactionQueue');
                GameSettlementService.init(ContractService, TronService, TransactionQueue);
            } else {
                console.log('[Server] BLOCKCHAIN_MODE=0g, skipping TRON service initialization');
            }

            // Initialize GameFlowIntegration
            gameFlowIntegration.init(isZeroGOnly ? null : TronService);

            // Initialize NFT Service
            if (process.env.NFT_CONTRACT_ADDRESS) {
                try {
                    console.log('[Server] Initializing NFT Service...');
                    initNFTService({
                        tronWeb: TronService.tronWeb,
                        nftContractAddress: process.env.NFT_CONTRACT_ADDRESS,
                        signerPrivateKey: process.env.SERVER_PRIVATE_KEY || config.TESTNET_PRIVATE_KEY,
                        signerAddress: process.env.NFT_SIGNER_ADDRESS,
                        signatureValidity: 7 * 24 * 60 * 60 // 7 days
                    });
                    
                    const nftService = getNFTService();
                    await nftService.init();
                    console.log('[Server] ✅ NFT Service initialized with contract:', process.env.NFT_CONTRACT_ADDRESS);
                } catch (nftError) {
                    console.error('[Server] ⚠️ NFT Service initialization failed:', nftError.message);
                    console.log('[Server] Continuing without NFT blockchain integration...');
                }
            } else {
                console.log('[Server] ℹ️ NFT_CONTRACT_ADDRESS not set, NFT blockchain integration disabled');
            }

            // Initialize CHIP Token Service
            const chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS || 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
            try {
                console.log('[Server] Initializing CHIP Token Service...');
                await initChipService(TronService.tronWeb, {
                    chipTokenAddress: chipTokenAddress,
                    stakingAddress: process.env.STAKING_CONTRACT_ADDRESS
                });
                console.log('[Server] ✅ CHIP Token Service initialized with contract:', chipTokenAddress);
            } catch (chipError) {
                console.error('[Server] ⚠️ CHIP Token Service initialization failed:', chipError.message);
                console.log('[Server] Continuing without CHIP blockchain integration...');
            }

            // Initialize and start EventListener
            if (!isZeroGOnly) {
                EventListener.init(TronService, ContractService);
                EventListener.start();
            }

            console.log('[Server] Blockchain service bootstrap completed');

            // ============ Initialize 0G (ZeroGravity) services (BEFORE blocking setTableOwner) ============
            if (config.ZEROG_ENABLED && (config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both')) {
                try {
                    console.log('[Server] Initializing 0G blockchain services...');
                    
                    const { initializeAll } = require('./blockchain/blockchainFactory');
                    const { zerog } = initializeAll();
                    global.zeroGService = zerog;

                    if (zerog && zerog.initialized) {
                        // Initialize ZeroG Contract Service
                        try {
                            const ZeroGContractSvc = require('./blockchain/ZeroGContractService');
                            ZeroGContractService = new ZeroGContractSvc();
                            ZeroGContractService.init(zerog, config.ZEROG_NETWORK);
                            console.log(`[Server] ✅ ZeroG Contract Service initialized`);
                            global.zeroGContractService = ZeroGContractService;
                        } catch (zgcsError) {
                            console.warn('[Server] ⚠️ ZeroG Contract Service init failed:', zgcsError.message);
                        }

                        // Initialize ZeroG Event Listener
                        try {
                            const ZGEventListener = require('./blockchain/ZeroGEventListener');
                            ZeroGEventListener = new ZGEventListener();
                            ZeroGEventListener.init(zerog);
                            ZeroGEventListener.start();
                            console.log('[Server] ✅ ZeroG Event Listener started');
                        } catch (zgelError) {
                            console.warn('[Server] ⚠️ ZeroG Event Listener init failed:', zgelError.message);
                        }

                        // Initialize ZeroG Storage Service
                        if (config.ZEROG_STORAGE_ENABLED) {
                            try {
                                const ZeroGStorageService = require('./services/ZeroGStorageService');
                                global.zeroGStorageService = new ZeroGStorageService();
                                global.zeroGStorageService.init();
                                console.log('[Server] ✅ ZeroG Storage Service initialized');
                            } catch (zgssError) {
                                console.warn('[Server] ⚠️ ZeroG Storage Service init failed:', zgssError.message);
                            }
                        }

                        // Initialize ZeroG DA Service
                        if (config.ZEROG_DA_ENABLED) {
                            try {
                                const ZeroGDAService = require('./services/ZeroGDAService');
                                global.zeroGDAService = new ZeroGDAService();
                                global.zeroGDAService.init();
                                console.log('[Server] ✅ ZeroG DA Service initialized');
                            } catch (zgdaError) {
                                console.warn('[Server] ⚠️ ZeroG DA Service init failed:', zgdaError.message);
                            }
                        }

                        console.log('[Server] ✅ All 0G services initialized successfully');

                        // 0G 初始化完成后立即检查双链余额
                        checkServerWalletBalance();
                    }
                } catch (zgError) {
                    console.error('[Server] ❌ 0G services initialization failed:', zgError.message);
                    console.error('[Server] Continuing in TRON-only mode for blockchain operations...');
                }
            } else if (config.ZEROG_ENABLED) {
                console.log('[Server] ℹ️ 0G enabled but BLOCKCHAIN_MODE is not "0g" or "both", skipping 0G init');
            } else {
                console.log('[Server] ℹ️ 0G disabled, skipping 0G initialization');
            }

            // Set server as table owner for table 1 (blocking on-chain TX - moved AFTER 0G init)
            if (!isZeroGOnly) try {
                const serverAddress = TronService.getSignerAddress();
                console.log('[Server] Server address:', serverAddress);

                const currentOwner = await ContractService.getTableOwner(1);
                console.log('[Server] Current table 1 owner:', currentOwner);

                if (currentOwner !== serverAddress) {
                    console.log('[Server] Setting server as table owner for table 1...');
                    await ContractService.setTableOwner(1, serverAddress);
                    console.log('[Server] ✅ Server set as table owner for table 1');
                } else {
                    console.log('[Server] ✅ Server is already table owner for table 1');
                }
            } catch (tableOwnerError) {
                console.warn('[Server] ⚠️ Could not set table owner:', tableOwnerError.message);
                console.warn('[Server] This may affect game settlement. Make sure server wallet is contract owner.');
            }

            // Initialize AMM Services
            const ammPoolAddress = process.env.AMM_POOL_ADDRESS;
            const ammRouterAddress = process.env.AMM_ROUTER_ADDRESS;
            
            if (ammPoolAddress && ammRouterAddress && chipTokenAddress) {
                try {
                    console.log('[Server] Initializing AMM Services...');
                    
                    // Initialize LiquidityService
                    const liquidityService = new LiquidityService(
                        TronService.tronWeb,
                        ammPoolAddress,
                        chipTokenAddress
                    );
                    await liquidityService.initialize();
                    
                    // Initialize PriceOracleService
                    const priceOracleService = new PriceOracleService(
                        TronService.tronWeb,
                        ammPoolAddress,
                        chipTokenAddress
                    );
                    await priceOracleService.initialize();
                    
                    // Configure AMM API with services
                    ammApi.setServices({
                        liquidityService,
                        priceOracleService,
                        tronWeb: TronService.tronWeb,
                        poolAddress: ammPoolAddress,
                        routerAddress: ammRouterAddress,
                        tokenAddress: chipTokenAddress
                    });
                    
                    console.log('[Server] ✅ AMM Services initialized');
                    console.log('[Server]    Pool:', ammPoolAddress);
                    console.log('[Server]    Router:', ammRouterAddress);
                    console.log('[Server]    Token:', chipTokenAddress);
                } catch (ammError) {
                    console.error('[Server] ⚠️ AMM Services initialization failed:', ammError.message);
                    console.log('[Server] Continuing without AMM integration...');
                }
            } else {
                console.log('[Server] ℹ️ AMM addresses not configured, AMM integration disabled');
            }
            
        } catch (error) {
            console.error('[Server] Failed to initialize blockchain services:', error.message);
            console.log('[Server] Continuing without blockchain integration...');
        }
    } else {
        console.warn('⚠️  ==================================================');
        console.warn('⚠️  [BLOCKCHAIN DISABLED] Blockchain integration is OFF');
        console.warn('⚠️  Set BLOCKCHAIN_ENABLED=true in .env.local to enable');
        console.warn('⚠️  ==================================================');
    }
}

// Initialize blockchain services
initializeBlockchainServices();

// Server wallet balance monitor (supports both TRON and 0G modes)
const TRON_WARN_THRESHOLD = 50 * 1e6;   // 50 TRX warning
const TRON_CRITICAL_THRESHOLD = 10 * 1e6; // 10 TRX critical
const ZEROG_WARN_THRESHOLD = 0.5;       // 0.5 0G warning
const ZEROG_CRITICAL_THRESHOLD = 0.1;   // 0.1 0G critical

async function checkServerWalletBalance() {
    if (!config.BLOCKCHAIN_ENABLED) return;

    try {
        // ====== TRON 余额检查（当模式不是纯 0G 时都检查）======
        if (config.BLOCKCHAIN_MODE !== '0g') {
            try {
                const serverAddress = TronService.getSignerAddress();
                if (!serverAddress) {
                    console.warn('[Server] TRON wallet not initialized, skipping balance check');
                } else {
                    const balance = await TronService.getTrxBalance(serverAddress);
                    const balanceTRX = (balance / 1e6).toFixed(2);

                    if (balance < TRON_CRITICAL_THRESHOLD) {
                        console.error(`[Server] CRITICAL: Server TRON wallet balance critically low: ${balanceTRX} TRX!`);
                    } else if (balance < TRON_WARN_THRESHOLD) {
                        console.warn(`[Server] WARNING: Server TRON wallet balance low: ${balanceTRX} TRX.`);
                    } else {
                        console.log(`[Server] Server TRON wallet balance: ${balanceTRX} TRX (${serverAddress})`);
                    }
                }
            } catch (e) {
                console.error('[Server] Failed to check TRON wallet balance:', e.message);
            }
        }

        // ====== 0G 余额检查（当模式是 0G 或 both 时检查）======
        if ((config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both') && global.zeroGService) {
            try {
                const zgServerAddress = global.zeroGService.getSignerAddress();
                if (!zgServerAddress) {
                    console.warn('[Server] ZeroG wallet not initialized, skipping balance check');
                } else {
                    const balanceEth = await global.zeroGService.getBalance(zgServerAddress);
                    const balanceNum = parseFloat(balanceEth);

                    if (balanceNum < ZEROG_CRITICAL_THRESHOLD) {
                        console.error(`[Server] CRITICAL: Server 0G wallet balance critically low: ${balanceEth} 0G!`);
                    } else if (balanceNum < ZEROG_WARN_THRESHOLD) {
                        console.warn(`[Server] WARNING: Server 0G wallet balance low: ${balanceEth} 0G.`);
                    } else {
                        console.log(`[Server] Server 0G wallet balance: ${balanceEth} 0G (${zgServerAddress})`);
                    }
                }
            } catch (e) {
                console.error('[Server] Failed to check 0G wallet balance:', e.message);
            }
        }

        // 0G service 未就绪时的提示（both 或 0g 模式）
        if ((config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both') && !global.zeroGService) {
            console.log('[Server] 0G service not yet available, will retry balance check later (every 6h)');
        }
    } catch (e) {
        console.error('[Server] Failed to check server wallet balance:', e.message);
    }
}

// Check balance on startup and every 6 hours
setTimeout(checkServerWalletBalance, 5000);
setInterval(checkServerWalletBalance, 6 * 60 * 60 * 1000);

// Start server and listen for connections
const server = app.listen(config.PORT, () => {
    console.log(
        `Server is running in ${config.NODE_ENV} mode and is listening on port ${config.PORT}...`
    );
});

//  Handle real-time poker game logic with socket.io
const io = socketio(server, {
    cors: socketCorsOptions
});

io.on("connect", (socket) => gameSocket.init(socket, io));

// Expose globals for EventListener to use
global.io = io;
global.gameFlowIntegration = gameFlowIntegration;

// Pre-load AI worker if configured
if (config.AI_ENABLED && config.AI_WORKER_PRELOAD) {
    const aiService = require('./services/ai/AIService');
    aiService.preload()
        .then(() => console.log('[Server] AI worker pre-loaded'))
        .catch(err => console.warn('[Server] AI worker pre-load failed:', err.message));
}

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`[Server] Received ${signal}, shutting down...`);
    const aiService = require('./services/ai/AIService');
    aiService.shutdown().catch(() => {});
    server.close(() => {
        if (db) db.disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling - close server

process.on("unhandledRejection", (err) => {
    const aiService = require('./services/ai/AIService');
    aiService.shutdown().catch(() => {});
    db.disconnect();

    console.error(`Error: ${err.message}`);
    server.close(() => {
        process.exit(1);
    });
});
