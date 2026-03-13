// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
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
    event RakeRateChangeCancelled();
    
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
    
    constructor(uint256 _initialRakeRate) {
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
