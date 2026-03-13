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
            
            console.log('[Server] Blockchain services initialized successfully');
        } catch (error) {
            console.error('[Server] Failed to initialize blockchain services:', error.message);
            console.log('[Server] Continuing without blockchain integration...');
        }
    } else {
        console.log('[Server] Blockchain integration disabled');
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
const io = socketio(server);

io.on("connect", (socket) => gameSocket.init(socket, io));

// Error handling - close server

process.on("unhandledRejection", (err) => {
    // db.disconnect();

    console.error(`Error: ${err.message}`);
    server.close(() => {
        process.exit(1);
    });
});
