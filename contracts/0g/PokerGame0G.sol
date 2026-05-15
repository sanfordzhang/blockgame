// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PokerGame0G
 * @notice Main game contract for the 0G Poker game on ZeroGravity network
 * @dev Handles fund custody, deposits, withdrawals, and game settlement
 */
contract PokerGame0G is AccessControl, ReentrancyGuard {
    // ============ Roles ============
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============ Events ============
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    event Settled(
        uint256 indexed handId,
        address[] winners,
        uint256[] amounts,
        uint256 totalPot,
        uint256 rake,
        bytes32 stateHash
    );
    event DelegateAuthorized(address indexed player, address indexed delegate);
    event DelegateRevoked(address indexed player);
    event OperatorChanged(address indexed oldOperator, address indexed newOperator);
    event JoinedTableFor(address indexed player, uint256 indexed tableId, uint256 buyIn, address indexed operator);
    event LeftTableFor(address indexed player, uint256 indexed tableId, uint256 finalStack, address indexed operator);
    event RakeCollected(uint256 indexed tableId, address indexed player, uint256 rakeAmount);
    event PlayerLeftTable(address indexed player, uint256 finalStack);
    event TournamentSettled(
        uint256 indexed tournamentId,
        address[] players,
        uint256[] payouts,
        uint256 rake,
        bytes32 stateHash
    );
    event ForceUnlocked(address indexed player, uint256 amount);

    struct TableSession {
        uint256 buyIn;
        bool active;
    }

    // ============ State Variables ============
    mapping(address => uint256) public custodyBalance;
    mapping(address => uint256) public lockedBalance;
    mapping(address => address) public delegates; // player => delegated operator
    mapping(uint256 => bytes32) public handStateHashes; // handId => stateHash
    mapping(uint256 => mapping(address => TableSession)) public tableSessions; // tableId => player => session
    uint256 public totalCustody;
    uint256 public rakeRate = 500; // 5% in basis points
    address public feeRecipient;

    // ============ Modifiers ============
    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Only operator");
        _;
    }

    // ============ Constructor ============
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        feeRecipient = _feeRecipient;
    }

    // ============ Fund Custody ============

    /**
     * @notice Deposit ETH into custody for gameplay
     * @dev Must be called with ETH value
     */
    function deposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        
        custodyBalance[msg.sender] += msg.value;
        totalCustody += msg.value;
        
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens into custody
     * @param token ERC20 token address
     * @param amount Token amount
     */
    function depositToken(IERC20 token, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // For simplicity, track ETH-equivalent custody; extend for multi-token
        custodyBalance[msg.sender] += amount;
        totalCustody += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw from custody balance
     * @param amount Amount to withdraw in wei
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(custodyBalance[msg.sender] >= amount, "Insufficient custody balance");
        require(amount > 0, "Amount must be > 0");

        custodyBalance[msg.sender] -= amount;
        totalCustody -= amount;

        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ============ Game Settlement ============

    /**
     * @notice Settle a completed poker hand
     * @dev Only callable by OPERATOR_ROLE
     * @param handId Unique hand identifier
     * @param winners Array of winner addresses
     * @param amounts Array of winning amounts (must match winners length)
     * @param totalPot Total pot amount
     * @param rake Rake amount collected
     * @param stateHash SHA-256 hash of complete game state for DA anchoring
     */
    function settle(
        uint256 handId,
        address[] calldata winners,
        uint256[] calldata amounts,
        uint256 totalPot,
        uint256 rake,
        bytes32 stateHash
    ) external onlyOperator {
        require(winners.length == amounts.length, "Winners/amounts length mismatch");
        require(winners.length > 0, "No winners specified");

        // Verify total distribution doesn't exceed pot
        uint256 totalWinnings;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalWinnings += amounts[i];
            custodyBalance[winners[i]] += amounts[i];
        }
        
        require(totalWinnings + rake <= totalPot, "Amounts exceed pot");

        // Transfer rake to fee recipient
        if (rake > 0) {
            custodyBalance[feeRecipient] += rake;
        }

        // Store state hash for verifiable fairness
        handStateHashes[handId] = stateHash;

        emit Settled(handId, winners, amounts, totalPot, rake, stateHash);
    }

    // ============ Table Session (Join/Leave) ============

    /**
     * @notice Operator locks a player's buy-in for a table.
     * @dev This deducts spendable custody immediately, so losers are debited on-chain.
     */
    function joinTableFor(address player, uint256 tableId, uint256 buyIn)
        external
        onlyOperator
    {
        require(player != address(0), "Invalid player address");
        require(tableId != 0, "Invalid tableId");
        require(buyIn > 0, "Invalid buy-in");
        require(custodyBalance[player] >= buyIn, "Insufficient custody balance");
        require(!tableSessions[tableId][player].active, "Already at table");

        custodyBalance[player] -= buyIn;
        lockedBalance[player] += buyIn;
        tableSessions[tableId][player] = TableSession({
            buyIn: buyIn,
            active: true
        });

        emit JoinedTableFor(player, tableId, buyIn, msg.sender);
    }

    /**
     * @notice Operator settles a single player's table session.
     */
    function leaveTableFor(address player, uint256 tableId, uint256 finalStack)
        external
        onlyOperator
    {
        _leaveTable(player, tableId, finalStack, msg.sender);
    }

    /**
     * @notice Player-signed session leave fallback.
     */
    function leaveTableSession(uint256 tableId, uint256 finalStack)
        external
    {
        _leaveTable(msg.sender, tableId, finalStack, msg.sender);
    }

    /**
     * @notice Player leaves table — return final stack to custody balance
     * @dev Legacy operator helper kept for compatibility. Prefer leaveTableFor(tableId).
     * @param player Player address leaving the table
     * @param finalStack Player's remaining stack in SUN-equivalent wei units
     */
    function leaveTableSession(address player, uint256 finalStack)
        external
        onlyOperator
    {
        require(player != address(0), "Invalid player address");
        custodyBalance[player] += finalStack;
        emit PlayerLeftTable(player, finalStack);
    }

    /**
     * @notice Settle a full tournament from locked buy-ins.
     * @dev payouts and rake must exactly consume all locked buy-ins for these players.
     */
    function settleTournament(
        uint256 tournamentId,
        address[] calldata players,
        uint256[] calldata payouts,
        uint256 rake,
        bytes32 stateHash
    ) external onlyOperator {
        require(players.length == payouts.length, "Players/payouts length mismatch");
        require(players.length > 0, "No players");

        uint256 totalLockedForTournament;
        uint256 totalPayouts;

        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            require(player != address(0), "Invalid player");

            TableSession storage session = tableSessions[tournamentId][player];
            require(session.active, "Player not locked");

            totalLockedForTournament += session.buyIn;
            totalPayouts += payouts[i];

            lockedBalance[player] -= session.buyIn;
            custodyBalance[player] += payouts[i];

            session.buyIn = 0;
            session.active = false;
        }

        require(totalPayouts + rake == totalLockedForTournament, "Settlement must balance");

        if (rake > 0) {
            custodyBalance[feeRecipient] += rake;
        }

        handStateHashes[tournamentId] = stateHash;
        emit TournamentSettled(tournamentId, players, payouts, rake, stateHash);
    }

    function _leaveTable(address player, uint256 tableId, uint256 finalStack, address operator)
        internal
    {
        require(player != address(0), "Invalid player address");
        require(tableId != 0, "Invalid tableId");

        TableSession storage session = tableSessions[tableId][player];
        require(session.active, "Not at table");

        uint256 rake = 0;
        uint256 netStack = finalStack;
        if (finalStack > session.buyIn && rakeRate > 0) {
            uint256 profit = finalStack - session.buyIn;
            rake = (profit * rakeRate) / 10000;
            netStack = finalStack - rake;
        }

        lockedBalance[player] -= session.buyIn;
        custodyBalance[player] += netStack;

        if (rake > 0) {
            custodyBalance[feeRecipient] += rake;
            emit RakeCollected(tableId, player, rake);
        }

        session.buyIn = 0;
        session.active = false;

        emit LeftTableFor(player, tableId, netStack, operator);
        emit PlayerLeftTable(player, netStack);
    }

    // ============ Delegate Authorization ============

    /**
     * @notice Authorize server to act on behalf of player
     * @param delegate Address of the server/operator to authorize
     */
    function authorizeDelegate(address delegate) external {
        require(delegate != address(0), "Invalid delegate address");
        delegates[msg.sender] = delegate;
        emit DelegateAuthorized(msg.sender, delegate);
    }

    /**
     * @notice Revoke server authorization
     */
    function revokeDelegate() external {
        delete delegates[msg.sender];
        emit DelegateRevoked(msg.sender);
    }

    /**
     * @notice Execute deposit on behalf of authorized player
     * @param player Player address that has authorized this contract
     * @param amount Amount to deposit (msg.value must cover this)
     */
    function executeDepositFor(address player, uint256 amount) 
        external payable 
        onlyOperator 
    {
        require(delegates[player] == msg.sender || hasRole(OPERATOR_ROLE, msg.sender), "Not authorized");
        require(msg.value >= amount || amount == 0, "Insufficient value");
        require(amount > 0, "Amount must be > 0");

        custodyBalance[player] += amount;
        totalCustody += amount;

        emit Deposited(player, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get custody balance for an address
     * @param player Address to query
     * @return Custody balance
     */
    function getCustodyBalance(address player) external view returns (uint256) {
        return custodyBalance[player];
    }

    function getLockedBalance(address player) external view returns (uint256) {
        return lockedBalance[player];
    }

    function getPlayerInfo(address player)
        external
        view
        returns (uint256 balance, uint256 lockedAmount, bool isRegistered)
    {
        return (custodyBalance[player], lockedBalance[player], custodyBalance[player] + lockedBalance[player] > 0);
    }

    function getTableSession(uint256 tableId, address player)
        external
        view
        returns (uint256 buyIn, bool active)
    {
        TableSession storage session = tableSessions[tableId][player];
        return (session.buyIn, session.active);
    }

    function forceUnlockPlayer(address player) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(player != address(0), "Invalid player");
        uint256 amount = lockedBalance[player];
        require(amount > 0, "No locked funds");

        lockedBalance[player] = 0;
        custodyBalance[player] += amount;

        emit ForceUnlocked(player, amount);
    }

    /**
     * @notice Get stored state hash for a hand
     * @param handId Hand identifier
     * @return State hash bytes32
     */
    function getHandStateHash(uint256 handId) external view returns (bytes32) {
        return handStateHashes[handId];
    }

    /**
     * @notice Check if an address is a delegate for a player
     * @param player Player address
     * @param delegate Potential delegate address
     * @return Whether delegate is authorized
     */
    function isDelegateFor(address player, address delegate) external view returns (bool) {
        return delegates[player] == delegate;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update fee recipient address
     * @param newRecipient New fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }
}
