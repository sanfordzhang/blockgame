// Load environment variables FIRST (before any other imports)
require("./config/loadEnv")();

const path = require("path");
const express = require("express");
// const connectDB = require('./config/db');
const configureMiddleware = require("./middleware");
const configureRoutes = require("./routes");
const socketio = require("socket.io");
const gameSocket = require("./socket/index");

// Then load config (which depends on env vars)
const config = require("./config");

// Blockchain services
const { TronService, ContractService } = require("./blockchain");
const EventListener = require("./blockchain/EventListener");
const GameSettlementService = require("./services/GameSettlementService");
const gameFlowIntegration = require("./services/GameFlowIntegration");
// Connect and get reference to mongodb instance
// let db;

// (async function () {
//   db = await connectDB();
// })();

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

            // Initialize TronService
            await TronService.init(config.TRON_NETWORK);

            // Initialize ContractService
            ContractService.init(TronService, config.TRON_NETWORK);

            // Initialize GameSettlementService
            const TransactionQueue = require('./blockchain/TransactionQueue');
            GameSettlementService.init(ContractService, TronService, TransactionQueue);

            // Initialize GameFlowIntegration
            gameFlowIntegration.init(TronService);

            // Initialize and start EventListener
            EventListener.init(TronService, ContractService);
            EventListener.start();

            // Set server as table owner for table 1 (so server can settle games)
            try {
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

            console.log('[Server] Blockchain services initialized successfully');
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

// Start server and listen for connections
const server = app.listen(config.PORT, () => {
    console.log(
        `Server is running in ${config.NODE_ENV} mode and is listening on port ${config.PORT}...`
    );
});

//  Handle real-time poker game logic with socket.io
const io = socketio(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:7777', 'http://127.0.0.1:7777'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on("connect", (socket) => gameSocket.init(socket, io));

// Error handling - close server

process.on("unhandledRejection", (err) => {
    // db.disconnect();

    console.error(`Error: ${err.message}`);
    server.close(() => {
        process.exit(1);
    });
});
