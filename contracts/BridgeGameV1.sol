// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeGameV1
 * @dev Texas Hold'em Poker Game Contract for TRON Network
 * 
 * Features:
 * - TRX fund custody (deposit/withdraw)
 * - Game table fund locking
 * - Settlement with dynamic rake rate
 * - Emergency pause functionality
 */
contract BridgeGameV1 is ReentrancyGuard, Pausable, Ownable {
    
    // ============ Data Structures ============
    
    struct Player {
        uint256 balance;        // Available balance in contract (in sun)
        uint256 lockedAmount;   // Amount locked in active games
        bool isRegistered;
        uint256 registeredAt;
    }
    
    struct GameSession {
        uint256 tableId;
        address[] players;
        uint256[] buyInAmounts;
        uint256 totalPot;
        uint256 createdAt;
        uint256 settledAt;
        GameState state;
        uint256 rakeRateUsed;    // Rake rate at game start
    }
    
    struct PendingRakeChange {
        uint256 newRate;
        uint256 effectiveTime;
        bool exists;
    }
    
    enum GameState {
        WAITING,      // Waiting for players
        PLAYING,      // Game in progress
        SETTLING,     // Settlement in progress
        FINISHED      // Game ended
    }
    
    // ============ State Variables ============
    
    // Balance limits (in sun, 1 TRX = 1,000,000 sun)
    uint256 public constant MIN_BUY_IN = 10 * 1e6;      // 10 TRX
    uint256 public constant MAX_BUY_IN = 1000 * 1e6;    // 1000 TRX
    
    // Rake rate limits (in basis points, 100 = 1%)
    uint256 public constant MIN_RAKE_RATE = 100;        // 1%
    uint256 public constant MAX_RAKE_RATE = 1000;       // 10%
    uint256 public constant MAX_RAKE_CHANGE = 200;      // Max 2% change per adjustment
    uint256 public constant RAKE_TIMELOCK = 24 hours;   // 24 hour delay
    
    // Current rake rate (in basis points)
    uint256 public rakeRate;
    // Last rake rate change timestamp
    uint256 public lastRakeChangeTime;
    
    // Pending rake change
    PendingRakeChange public pendingRakeChange;
    
    // Player data
    mapping(address => Player) public players;
    
    // Game sessions
    mapping(uint256 => GameSession) public gameSessions;
    uint256 public gameCounter;
    
    // Table ownership (who can settle games for a table)
    mapping(uint256 => address) public tableOwners;
    
    // Game results hash for verification
    mapping(uint256 => bytes32) public gameResultHashes;
    
    // ============ Delegate (Server Proxy) System ============
    // Player's authorized delegate (server) for proxy operations
    mapping(address => address) public playerDelegates;
    
    // Check if delegate is authorized for a player
    mapping(address => mapping(address => bool)) public isDelegateAuthorized;
    
    // Accumulated rake balance
    uint256 public accumulatedRake;
    
    // Total volume statistics
    uint256 public totalVolume;
    uint256 public totalRakeCollected;
    uint256 public totalGamesPlayed;
    
    // ============ Events ============
    
    event PlayerRegistered(address indexed player, uint256 timestamp);
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    event JoinedTable(address indexed player, uint256 indexed tableId, uint256 buyIn);
    event LeftTable(address indexed player, uint256 indexed tableId, uint256 amount);
    event GameStarted(uint256 indexed tableId, uint256 indexed gameId, address[] players);
    event GameSettled(uint256 indexed gameId, address[] winners, uint256[] amounts, uint256 rakeCollected);
    event RakeRateChanged(uint256 oldRate, uint256 newRate, uint256 effectiveTime);
    event RakeRateChangeScheduled(uint256 newRate, uint256 effectiveTime);
    event RakeWithdrawn(address indexed to, uint256 amount);
    event ForceUnlocked(address indexed player, uint256 amount);
    event GameSessionReset(uint256 indexed tableId);
    event RakeRateChangeCancelled();
    event RebuyEvent(address indexed player, uint256 indexed tableId, uint256 amount);
    event GameSettledSession(uint256 indexed gameId, address[] players, int256[] stackDeltas);
    
    // Delegate (Server Proxy) events
    event DelegateSet(address indexed player, address indexed delegate);
    event DelegateRevoked(address indexed player, address indexed delegate);
    event JoinedTableFor(address indexed player, uint256 indexed tableId, uint256 buyIn, address indexed delegate);
    event LeftTableFor(address indexed player, uint256 indexed tableId, uint256 amount, address indexed delegate);
    
    // ============ Modifiers ============
    
    modifier onlyRegistered() {
        require(players[msg.sender].isRegistered, "Player not registered");
        _;
    }
    
    modifier onlyTableOwner(uint256 tableId) {
        require(tableOwners[tableId] == msg.sender, "Not table owner");
        _;
    }
    
    modifier validRakeRate(uint256 newRate) {
        require(newRate >= MIN_RAKE_RATE, "Rake rate below minimum");
        require(newRate <= MAX_RAKE_RATE, "Rake rate above maximum");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(uint256 _initialRakeRate, address initialOwner) 
        Ownable(initialOwner) 
    {
        require(_initialRakeRate >= MIN_RAKE_RATE && _initialRakeRate <= MAX_RAKE_RATE, 
                "Invalid initial rake rate");
        rakeRate = _initialRakeRate;
        lastRakeChangeTime = block.timestamp;
    }
    
    // ============ Player Functions ============
    
    /**
     * @dev Register a new player
     */
    function registerPlayer() external {
        require(!players[msg.sender].isRegistered, "Already registered");
        
        players[msg.sender] = Player({
            balance: 0,
            lockedAmount: 0,
            isRegistered: true,
            registeredAt: block.timestamp
        });
        
        emit PlayerRegistered(msg.sender, block.timestamp);
    }
    
    // ============ Delegate (Server Proxy) Functions ============
    
    /**
     * @dev Set delegate (server) for proxy operations
     * Player authorizes a server to call joinTableFor/leaveTableFor on their behalf
     * @param delegate The address of the server/delegate to authorize
     */
    function setDelegate(address delegate) external onlyRegistered {
        require(delegate != address(0), "Invalid delegate address");
        require(delegate != msg.sender, "Cannot delegate to self");
        
        playerDelegates[msg.sender] = delegate;
        isDelegateAuthorized[msg.sender][delegate] = true;
        
        emit DelegateSet(msg.sender, delegate);
    }
    
    /**
     * @dev Revoke delegate authorization
     */
    function revokeDelegate() external onlyRegistered {
        address currentDelegate = playerDelegates[msg.sender];
        require(currentDelegate != address(0), "No delegate set");
        
        isDelegateAuthorized[msg.sender][currentDelegate] = false;
        playerDelegates[msg.sender] = address(0);
        
        emit DelegateRevoked(msg.sender, currentDelegate);
    }
    
    /**
     * @dev Check if an address is authorized delegate for a player
     */
    function isAuthorizedDelegate(address player, address delegate) external view returns (bool) {
        return isDelegateAuthorized[player][delegate];
    }
    
    /**
     * @dev Get player's current delegate
     */
    function getPlayerDelegate(address player) external view returns (address) {
        return playerDelegates[player];
    }
    
    /**
     * @dev Deposit TRX to contract
     */
    function deposit() external payable onlyRegistered whenNotPaused {
        require(msg.value >= MIN_BUY_IN, "Below minimum deposit");
        require(msg.value <= MAX_BUY_IN, "Exceeds maximum deposit");
        
        players[msg.sender].balance += msg.value;
        
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw TRX from contract
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        Player storage player = players[msg.sender];
        require(player.balance >= amount, "Insufficient available balance");
        
        player.balance -= amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }
    
    // ============ Game Functions ============
    
    /**
     * @dev Create or join a game table
     * @param tableId The table identifier
     * @param buyInAmount Amount to buy in (in sun)
     */
    function joinTable(uint256 tableId, uint256 buyInAmount) 
        external 
        onlyRegistered 
        whenNotPaused 
    {
        Player storage player = players[msg.sender];
        
        require(player.balance >= buyInAmount, "Insufficient available balance");
        require(buyInAmount >= MIN_BUY_IN, "Below minimum buy-in");
        require(buyInAmount <= MAX_BUY_IN, "Exceeds maximum buy-in");
        
        // Lock funds
        player.balance -= buyInAmount;
        player.lockedAmount += buyInAmount;
        
        // Initialize game session if new table
        GameSession storage session = gameSessions[tableId];
        if (session.state == GameState.WAITING || session.state == GameState.FINISHED) {
            session.tableId = tableId;
            session.state = GameState.PLAYING;
            session.createdAt = block.timestamp;
            session.rakeRateUsed = rakeRate;
            session.totalPot = 0;
            delete session.players;
            delete session.buyInAmounts;
            
            // Set table owner if not set
            if (tableOwners[tableId] == address(0)) {
                tableOwners[tableId] = msg.sender;
            }
        }
        
        session.players.push(msg.sender);
        session.buyInAmounts.push(buyInAmount);
        session.totalPot += buyInAmount;
        
        emit JoinedTable(msg.sender, tableId, buyInAmount);
    }
    
    /**
     * @dev Leave table (before game starts, refund locked amount)
     * @param tableId The table identifier
     */
    function leaveTable(uint256 tableId) external onlyRegistered whenNotPaused {
        GameSession storage session = gameSessions[tableId];
        require(session.state == GameState.PLAYING, "Game not in playing state");
        
        Player storage player = players[msg.sender];
        require(player.lockedAmount > 0, "No locked funds");
        
        // Find player in session and remove
        uint256 playerIndex = type(uint256).max;
        uint256 buyInAmount = 0;
        
        for (uint256 i = 0; i < session.players.length; i++) {
            if (session.players[i] == msg.sender) {
                playerIndex = i;
                buyInAmount = session.buyInAmounts[i];
                break;
            }
        }
        
        require(playerIndex != type(uint256).max, "Player not in this table");
        
        // Remove player from arrays
        if (playerIndex < session.players.length - 1) {
            session.players[playerIndex] = session.players[session.players.length - 1];
            session.buyInAmounts[playerIndex] = session.buyInAmounts[session.buyInAmounts.length - 1];
        }
        session.players.pop();
        session.buyInAmounts.pop();
        session.totalPot -= buyInAmount;
        
        // Unlock funds
        player.lockedAmount -= buyInAmount;
        player.balance += buyInAmount;
        
        emit LeftTable(msg.sender, tableId, buyInAmount);
    }

    /**
     * @dev Session mode leave table - settle with final stack amount
     * In session mode, player's lockedAmount may differ from initial buyIn due to game results
     * This function settles the locked funds based on final stack
     * @param tableId The table identifier
     * @param finalStack The player's final stack amount
     */
    function leaveTableSession(uint256 tableId, uint256 finalStack) external onlyRegistered whenNotPaused {
        GameSession storage session = gameSessions[tableId];
        require(session.state == GameState.PLAYING || session.state == GameState.FINISHED, "Invalid game state");
        
        Player storage player = players[msg.sender];
        require(player.lockedAmount > 0, "No locked funds");
        
        // Find player in session
        uint256 playerIndex = type(uint256).max;
        for (uint256 i = 0; i < session.players.length; i++) {
            if (session.players[i] == msg.sender) {
                playerIndex = i;
                break;
            }
        }
        
        require(playerIndex != type(uint256).max, "Player not in this table");
        
        uint256 buyInAmount = session.buyInAmounts[playerIndex];
        
        // Remove player from arrays
        if (playerIndex < session.players.length - 1) {
            session.players[playerIndex] = session.players[session.players.length - 1];
            session.buyInAmounts[playerIndex] = session.buyInAmounts[session.buyInAmounts.length - 1];
        }
        session.players.pop();
        session.buyInAmounts.pop();
        session.totalPot -= buyInAmount;
        
        // Session mode settlement: return finalStack to balance, clear locked
        // Note: finalStack should be <= lockedAmount in normal cases
        // If player lost, finalStack < lockedAmount, the difference stays in contract (house wins)
        // If player won, finalStack may be > lockedAmount, but locked is cleared and balance gets finalStack
        
        // Clear all locked and add final stack to balance
        uint256 lockedAmount = player.lockedAmount;
        player.lockedAmount = 0;
        player.balance += finalStack;
        
        emit LeftTable(msg.sender, tableId, finalStack);
    }

    // ============ Delegate (Server Proxy) Game Functions ============
    
    /**
     * @dev Server proxy join table on behalf of a player
     * Called by the authorized delegate (server) after player authorization
     * @param playerAddr The player's address
     * @param tableId The table identifier
     * @param buyInAmount Amount to buy in (in sun)
     */
    function joinTableFor(
        address playerAddr, 
        uint256 tableId, 
        uint256 buyInAmount
    ) external whenNotPaused {
        // Verify delegate authorization
        require(isDelegateAuthorized[playerAddr][msg.sender], "Not authorized delegate");
        
        Player storage player = players[playerAddr];
        require(player.isRegistered, "Player not registered");
        require(player.balance >= buyInAmount, "Insufficient available balance");
        require(buyInAmount >= MIN_BUY_IN, "Below minimum buy-in");
        require(buyInAmount <= MAX_BUY_IN, "Exceeds maximum buy-in");
        
        // Lock funds
        player.balance -= buyInAmount;
        player.lockedAmount += buyInAmount;
        
        // Initialize game session if new table
        GameSession storage session = gameSessions[tableId];
        if (session.state == GameState.WAITING || session.state == GameState.FINISHED) {
            session.tableId = tableId;
            session.state = GameState.PLAYING;
            session.createdAt = block.timestamp;
            session.rakeRateUsed = rakeRate;
            session.totalPot = 0;
            delete session.players;
            delete session.buyInAmounts;
            
            // Set table owner if not set (to the delegate/server)
            if (tableOwners[tableId] == address(0)) {
                tableOwners[tableId] = msg.sender;
            }
        }
        
        session.players.push(playerAddr);
        session.buyInAmounts.push(buyInAmount);
        session.totalPot += buyInAmount;
        
        emit JoinedTable(playerAddr, tableId, buyInAmount);
        emit JoinedTableFor(playerAddr, tableId, buyInAmount, msg.sender);
    }
    
    /**
     * @dev Server proxy leave table on behalf of a player
     * Called by the authorized delegate (server)
     * @param playerAddr The player's address
     * @param tableId The table identifier
     * @param finalStack The player's final stack amount
     */
    function leaveTableFor(
        address playerAddr,
        uint256 tableId,
        uint256 finalStack
    ) external whenNotPaused {
        // Verify delegate authorization
        require(isDelegateAuthorized[playerAddr][msg.sender], "Not authorized delegate");
        
        GameSession storage session = gameSessions[tableId];
        require(session.state == GameState.PLAYING || session.state == GameState.FINISHED, "Invalid game state");
        
        Player storage player = players[playerAddr];
        require(player.lockedAmount > 0, "No locked funds");
        
        // Find player in session
        uint256 playerIndex = type(uint256).max;
        for (uint256 i = 0; i < session.players.length; i++) {
            if (session.players[i] == playerAddr) {
                playerIndex = i;
                break;
            }
        }
        
        require(playerIndex != type(uint256).max, "Player not in this table");
        
        uint256 buyInAmount = session.buyInAmounts[playerIndex];

        // Remove player from arrays
        if (playerIndex < session.players.length - 1) {
            session.players[playerIndex] = session.players[session.players.length - 1];
            session.buyInAmounts[playerIndex] = session.buyInAmounts[session.buyInAmounts.length - 1];
        }
        session.players.pop();
        session.buyInAmounts.pop();
        session.totalPot -= buyInAmount;

        // Calculate rake on profit
        uint256 rake = 0;
        uint256 netPayout = finalStack;

        if (finalStack > buyInAmount) {
            // Player has profit, calculate rake
            uint256 profit = finalStack - buyInAmount;
            rake = (profit * session.rakeRateUsed) / 10000;
            netPayout = finalStack - rake;

            // Accumulate rake
            accumulatedRake += rake;
            totalRakeCollected += rake;
        }

        // Session mode settlement: return netPayout to balance, clear locked
        player.lockedAmount = 0;
        player.balance += netPayout;

        emit LeftTable(playerAddr, tableId, netPayout);
        emit LeftTableFor(playerAddr, tableId, netPayout, msg.sender);

        if (rake > 0) {
            emit GameSettled(session.gameId, new address[](0), new uint256[](0), rake);
        }
    }

    /**
     * @dev Rebuy in session mode - add more chips to stack
     * Deducts from balance, adds to locked
     * @param tableId The table identifier
     * @param rebuyAmount Amount to rebuy
     */
    function rebuy(uint256 tableId, uint256 rebuyAmount) external onlyRegistered whenNotPaused {
        Player storage player = players[msg.sender];
        
        require(player.balance >= rebuyAmount, "Insufficient balance for rebuy");
        require(rebuyAmount >= MIN_BUY_IN, "Below minimum rebuy");
        require(rebuyAmount <= MAX_BUY_IN, "Exceeds maximum rebuy");
        
        GameSession storage session = gameSessions[tableId];
        require(session.state == GameState.PLAYING, "Game not in playing state");
        
        // Find player in session
        bool found = false;
        for (uint256 i = 0; i < session.players.length; i++) {
            if (session.players[i] == msg.sender) {
                found = true;
                // Update buyInAmount to track total
                session.buyInAmounts[i] += rebuyAmount;
                session.totalPot += rebuyAmount;
                break;
            }
        }
        
        require(found, "Player not in this table");
        
        // Rule f: Rebuy from balance, add to locked
        player.balance -= rebuyAmount;
        player.lockedAmount += rebuyAmount;
        
        emit RebuyEvent(msg.sender, tableId, rebuyAmount);
    }

    /**
     * @dev Session mode settlement - only update stack, don't change locked
     * This is called after each hand in session mode
     * @param tableId The table identifier
     * @param playersToUpdate Array of player addresses
     * @param stackDeltas Array of stack changes (positive = win, negative = lose)
     * @param resultHash Hash of game result for verification
     */
    function settleGameSession(
        uint256 tableId,
        address[] calldata playersToUpdate,
        int256[] calldata stackDeltas,
        bytes32 resultHash
    ) external onlyTableOwner(tableId) nonReentrant whenNotPaused {
        require(playersToUpdate.length == stackDeltas.length, "Array length mismatch");
        
        GameSession storage session = gameSessions[tableId];
        require(session.state == GameState.PLAYING, "Game not in playing state");
        
        gameResultHashes[tableId] = resultHash;
        
        // Update each player's locked based on stack delta
        // Positive delta = they won, negative = they lost
        for (uint256 i = 0; i < playersToUpdate.length; i++) {
            Player storage player = players[playersToUpdate[i]];
            int256 delta = stackDeltas[i];
            
            if (delta > 0) {
                // Winner: add to balance (after rake would be handled off-chain)
                player.balance += uint256(delta);
            } else if (delta < 0) {
                // Loser: their locked already covers the loss
                // The actual loss is reflected when they leave with reduced finalStack
            }
        }
        
        // Update statistics
        totalGamesPlayed += 1;
        gameCounter++;
        
        emit GameSettledSession(gameCounter, playersToUpdate, stackDeltas);
    }
    
    /**
     * @dev Settle a completed game
     * @param tableId The table identifier
     * @param winners Array of winner addresses
     * @param amounts Array of winning amounts (before rake)
     * @param resultHash Hash of game result for verification
     */
    function settleGame(
        uint256 tableId,
        address[] calldata winners,
        uint256[] calldata amounts,
        bytes32 resultHash
    ) external onlyTableOwner(tableId) nonReentrant whenNotPaused {
        GameSession storage session = gameSessions[tableId];
        
        require(session.state == GameState.PLAYING, "Game not in playing state");
        require(winners.length == amounts.length, "Array length mismatch");
        
        session.state = GameState.SETTLING;
        gameResultHashes[tableId] = resultHash;
        
        uint256 totalRakeFromGame = 0;
        uint256 totalPayout = 0;
        
        // Process each winner
        for (uint256 i = 0; i < winners.length; i++) {
            address winner = winners[i];
            uint256 grossAmount = amounts[i];
            
            // Calculate rake (use rate at game start)
            uint256 rake = (grossAmount * session.rakeRateUsed) / 10000;
            uint256 netPayout = grossAmount - rake;
            
            // Update player balance
            Player storage player = players[winner];
            player.balance += netPayout;
            
            // Deduct from locked amount (winner's portion)
            // Note: losers' locked amounts are handled by total pot distribution
            if (player.lockedAmount >= grossAmount) {
                player.lockedAmount -= grossAmount;
            }
            
            totalRakeFromGame += rake;
            totalPayout += netPayout;
        }
        
        // Process losers - their locked funds go to the pot
        for (uint256 i = 0; i < session.players.length; i++) {
            address playerAddr = session.players[i];
            bool isWinner = false;
            for (uint256 j = 0; j < winners.length; j++) {
                if (winners[j] == playerAddr) {
                    isWinner = true;
                    break;
                }
            }
            
            Player storage loser = players[playerAddr];
            // Losers' locked amounts are consumed
            if (!isWinner && loser.lockedAmount > 0) {
                loser.lockedAmount = 0; // All locked amount is lost
            }
        }
        
        // Update statistics
        accumulatedRake += totalRakeFromGame;
        totalRakeCollected += totalRakeFromGame;
        totalVolume += session.totalPot;
        totalGamesPlayed += 1;
        
        session.state = GameState.FINISHED;
        session.settledAt = block.timestamp;
        gameCounter++;
        
        emit GameSettled(gameCounter, winners, amounts, totalRakeFromGame);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Schedule a rake rate change (with time lock)
     * @param newRate New rake rate in basis points
     */
    function scheduleRakeRateChange(uint256 newRate) 
        external 
        onlyOwner 
        validRakeRate(newRate) 
    {
        // Check rate change is within allowed amplitude
        uint256 change = newRate > rakeRate ? newRate - rakeRate : rakeRate - newRate;
        require(change <= MAX_RAKE_CHANGE, "Rake change exceeds maximum amplitude");
        
        // Check frequency (at least 24 hours between changes)
        require(
            block.timestamp >= lastRakeChangeTime + RAKE_TIMELOCK,
            "Rake change too frequent"
        );
        
        // Schedule the change
        pendingRakeChange = PendingRakeChange({
            newRate: newRate,
            effectiveTime: block.timestamp + RAKE_TIMELOCK,
            exists: true
        });
        
        emit RakeRateChangeScheduled(newRate, block.timestamp + RAKE_TIMELOCK);
    }
    
    /**
     * @dev Apply pending rake rate change after time lock
     */
    function applyRakeRateChange() external onlyOwner {
        require(pendingRakeChange.exists, "No pending rake change");
        require(block.timestamp >= pendingRakeChange.effectiveTime, "Time lock not expired");
        
        uint256 oldRate = rakeRate;
        rakeRate = pendingRakeChange.newRate;
        lastRakeChangeTime = block.timestamp;
        
        emit RakeRateChanged(oldRate, rakeRate, block.timestamp);
        
        delete pendingRakeChange;
    }
    
    /**
     * @dev Cancel pending rake rate change
     */
    function cancelRakeRateChange() external onlyOwner {
        require(pendingRakeChange.exists, "No pending rake change");
        
        delete pendingRakeChange;
        emit RakeRateChangeCancelled();
    }
    
    /**
     * @dev Withdraw accumulated rake (only owner)
     * @param to Address to send rake to
     * @param amount Amount to withdraw
     */
    function withdrawRake(address payable to, uint256 amount) external onlyOwner {
        require(amount <= accumulatedRake, "Insufficient rake balance");
        
        accumulatedRake -= amount;
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit RakeWithdrawn(to, amount);
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Set table owner (for backend service)
     */
    function setTableOwner(uint256 tableId, address owner) external onlyOwner {
        tableOwners[tableId] = owner;
    }

    /**
     * @dev Force unlock player's locked funds (admin only)
     * Used when player leaves table unexpectedly or game state is inconsistent
     * @param playerAddress The player address to unlock
     */
    function forceUnlockPlayer(address playerAddress) external onlyOwner {
        Player storage player = players[playerAddress];
        require(player.lockedAmount > 0, "No locked funds to unlock");

        uint256 lockedAmount = player.lockedAmount;
        player.lockedAmount = 0;
        player.balance += lockedAmount;

        emit ForceUnlocked(playerAddress, lockedAmount);
    }

    /**
     * @dev Reset game session state (admin only)
     * Used when game state is stuck and needs to be reset
     * @param tableId The table identifier
     */
    function resetGameSession(uint256 tableId) external onlyOwner {
        GameSession storage session = gameSessions[tableId];
        session.state = GameState.FINISHED;
        session.settledAt = block.timestamp;

        emit GameSessionReset(tableId);
    }

    // ============ View Functions ============
    
    /**
     * @dev Get player's available balance
     */
    function getPlayerBalance(address player) external view returns (uint256) {
        return players[player].balance;
    }
    
    /**
     * @dev Get player's locked balance
     */
    function getPlayerLockedBalance(address player) external view returns (uint256) {
        return players[player].lockedAmount;
    }
    
    /**
     * @dev Get player info
     */
    function getPlayerInfo(address player) external view returns (
        uint256 balance,
        uint256 lockedAmount,
        bool isRegistered,
        uint256 registeredAt
    ) {
        Player storage p = players[player];
        return (p.balance, p.lockedAmount, p.isRegistered, p.registeredAt);
    }
    
    /**
     * @dev Get game session info
     */
    function getGameSession(uint256 tableId) external view returns (
        uint256 tableId_,
        address[] memory players_,
        uint256[] memory buyInAmounts_,
        uint256 totalPot,
        GameState state,
        uint256 rakeRateUsed
    ) {
        GameSession storage session = gameSessions[tableId];
        return (
            session.tableId,
            session.players,
            session.buyInAmounts,
            session.totalPot,
            session.state,
            session.rakeRateUsed
        );
    }
    
    /**
     * @dev Get contract statistics
     */
    function getStatistics() external view returns (
        uint256 _totalVolume,
        uint256 _totalRakeCollected,
        uint256 _totalGamesPlayed,
        uint256 _accumulatedRake,
        uint256 _rakeRate,
        uint256 _playerCount
    ) {
        return (
            totalVolume,
            totalRakeCollected,
            totalGamesPlayed,
            accumulatedRake,
            rakeRate,
            gameCounter
        );
    }
    
    /**
     * @dev Check if pending rake change exists
     */
    function getPendingRakeChange() external view returns (
        bool exists,
        uint256 newRate,
        uint256 effectiveTime
    ) {
        return (
            pendingRakeChange.exists,
            pendingRakeChange.newRate,
            pendingRakeChange.effectiveTime
        );
    }
    
    // ============ Receive Function ============
    
    receive() external payable {
        // Allow contract to receive TRX (for deposits via transfer)
        if (players[msg.sender].isRegistered) {
            players[msg.sender].balance += msg.value;
            emit Deposited(msg.sender, msg.value);
        }
    }
}
