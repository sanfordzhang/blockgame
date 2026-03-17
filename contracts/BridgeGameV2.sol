// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BridgeGameV2
 * @dev Simplified Texas Hold'em Poker Game Contract for TRON Network
 * Optimized for lower deployment cost (demo version)
 */
contract BridgeGameV2 {

    // ============ State Variables ============

    address public owner;
    bool public paused;
    bool private _locked; // reentrancy guard

    uint256 public constant MIN_BUY_IN = 10 * 1e6;   // 10 TRX
    uint256 public constant MAX_BUY_IN = 1000 * 1e6; // 1000 TRX
    uint256 public rakeRate; // basis points, 250 = 2.5%

    struct Player {
        uint256 balance;
        uint256 lockedAmount;
        bool isRegistered;
    }

    // tableId => player => buyInAmount (tracks who is at which table)
    mapping(address => Player) public players;
    mapping(address => address) public playerDelegates;
    mapping(address => mapping(address => bool)) public isDelegateAuthorized;
    mapping(uint256 => address) public tableOwners;
    // tableId => player => isAtTable
    mapping(uint256 => mapping(address => bool)) public playerAtTable;
    // tableId => player => buyInAmount
    mapping(uint256 => mapping(address => uint256)) public playerBuyIn;

    address public rakeRecipient; // Server wallet address to receive rake

    uint256 public accumulatedRake;

    // ============ Events ============

    event PlayerRegistered(address indexed player);
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    event JoinedTableFor(address indexed player, uint256 indexed tableId, uint256 buyIn, address indexed delegate);
    event LeftTableFor(address indexed player, uint256 indexed tableId, uint256 amount, address indexed delegate);
    event LeftTable(address indexed player, uint256 indexed tableId, uint256 amount);
    event DelegateSet(address indexed player, address indexed delegate);
    event DelegateRevoked(address indexed player, address indexed delegate);
    event ForceUnlocked(address indexed player, uint256 amount);
    event RakeCollected(uint256 indexed tableId, address indexed player, uint256 rakeAmount, address recipient);
    event RakeWithdrawn(address indexed to, uint256 amount);
    event RakeRecipientSet(address indexed recipient);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyRegistered() {
        require(players[msg.sender].isRegistered, "Not registered");
        _;
    }

    // ============ Constructor ============

    constructor(uint256 _rakeRate, address _rakeRecipient) {
        owner = msg.sender;
        rakeRate = _rakeRate;
        rakeRecipient = _rakeRecipient != address(0) ? _rakeRecipient : msg.sender;
    }

    // ============ Player Functions ============

    function registerPlayer() external {
        require(!players[msg.sender].isRegistered, "Already registered");
        players[msg.sender].isRegistered = true;
        emit PlayerRegistered(msg.sender);
    }

    function deposit() external payable onlyRegistered whenNotPaused {
        require(msg.value >= MIN_BUY_IN, "Below minimum");
        require(msg.value <= MAX_BUY_IN, "Exceeds maximum");
        players[msg.sender].balance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        Player storage p = players[msg.sender];
        require(p.balance >= amount, "Insufficient balance");
        p.balance -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    // ============ Delegate Functions ============

    function setDelegate(address delegate) external onlyRegistered {
        require(delegate != address(0) && delegate != msg.sender, "Invalid delegate");
        playerDelegates[msg.sender] = delegate;
        isDelegateAuthorized[msg.sender][delegate] = true;
        emit DelegateSet(msg.sender, delegate);
    }

    function revokeDelegate() external onlyRegistered {
        address d = playerDelegates[msg.sender];
        require(d != address(0), "No delegate");
        isDelegateAuthorized[msg.sender][d] = false;
        playerDelegates[msg.sender] = address(0);
        emit DelegateRevoked(msg.sender, d);
    }

    function isAuthorizedDelegate(address player, address delegate) external view returns (bool) {
        return isDelegateAuthorized[player][delegate];
    }

    function getPlayerDelegate(address player) external view returns (address) {
        return playerDelegates[player];
    }

    // ============ Delegate Game Functions ============

    function joinTableFor(address playerAddr, uint256 tableId, uint256 buyInAmount) external whenNotPaused {
        require(isDelegateAuthorized[playerAddr][msg.sender], "Not authorized delegate");
        Player storage p = players[playerAddr];
        require(p.isRegistered, "Not registered");
        require(p.balance >= buyInAmount, "Insufficient balance");
        require(buyInAmount >= MIN_BUY_IN && buyInAmount <= MAX_BUY_IN, "Invalid buy-in");
        require(!playerAtTable[tableId][playerAddr], "Already at table");

        p.balance -= buyInAmount;
        p.lockedAmount += buyInAmount;
        playerAtTable[tableId][playerAddr] = true;
        playerBuyIn[tableId][playerAddr] = buyInAmount;

        if (tableOwners[tableId] == address(0)) {
            tableOwners[tableId] = msg.sender;
        }

        emit JoinedTableFor(playerAddr, tableId, buyInAmount, msg.sender);
    }

    function leaveTableFor(address playerAddr, uint256 tableId, uint256 finalStack) external nonReentrant whenNotPaused {
        require(isDelegateAuthorized[playerAddr][msg.sender], "Not authorized delegate");
        Player storage p = players[playerAddr];
        require(p.lockedAmount > 0, "No locked funds");
        require(playerAtTable[tableId][playerAddr], "Not at table");

        uint256 buyIn = playerBuyIn[tableId][playerAddr];

        // Calculate rake only on profit (finalStack > buyIn)
        uint256 rake = 0;
        uint256 netStack = finalStack;
        if (finalStack > buyIn && rakeRate > 0) {
            uint256 profit = finalStack - buyIn;
            rake = (profit * rakeRate) / 10000;
            netStack = finalStack - rake;
        }

        p.lockedAmount = 0;
        p.balance += netStack;
        playerAtTable[tableId][playerAddr] = false;
        playerBuyIn[tableId][playerAddr] = 0;

        // Send rake directly to rakeRecipient (server wallet)
        if (rake > 0 && rakeRecipient != address(0)) {
            (bool ok,) = payable(rakeRecipient).call{value: rake}("");
            if (ok) {
                emit RakeCollected(tableId, playerAddr, rake, rakeRecipient);
            } else {
                // If transfer fails, keep rake in contract
                accumulatedRake += rake;
            }
        }

        emit LeftTableFor(playerAddr, tableId, netStack, msg.sender);
        emit LeftTable(playerAddr, tableId, netStack);
    }

    function leaveTableSession(uint256 tableId, uint256 finalStack) external onlyRegistered whenNotPaused {
        Player storage p = players[msg.sender];
        require(p.lockedAmount > 0, "No locked funds");

        p.lockedAmount = 0;
        p.balance += finalStack;
        playerAtTable[tableId][msg.sender] = false;
        playerBuyIn[tableId][msg.sender] = 0;

        emit LeftTable(msg.sender, tableId, finalStack);
    }

    // ============ Admin Functions ============

    function setTableOwner(uint256 tableId, address tableOwner) external onlyOwner {
        tableOwners[tableId] = tableOwner;
    }

    function forceUnlockPlayer(address playerAddress) external onlyOwner {
        Player storage p = players[playerAddress];
        require(p.lockedAmount > 0, "No locked funds");
        uint256 amount = p.lockedAmount;
        p.lockedAmount = 0;
        p.balance += amount;
        emit ForceUnlocked(playerAddress, amount);
    }

    function setRakeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Max 10%");
        rakeRate = newRate;
    }

    function setRakeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid address");
        rakeRecipient = _recipient;
        emit RakeRecipientSet(_recipient);
    }

    function withdrawRake(address payable to, uint256 amount) external onlyOwner {
        require(amount <= accumulatedRake, "Insufficient rake");
        accumulatedRake -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit RakeWithdrawn(to, amount);
    }

    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    // ============ View Functions ============

    function getPlayerInfo(address player) external view returns (
        uint256 balance, uint256 lockedAmount, bool isRegistered
    ) {
        Player storage p = players[player];
        return (p.balance, p.lockedAmount, p.isRegistered);
    }

    receive() external payable {
        if (players[msg.sender].isRegistered) {
            players[msg.sender].balance += msg.value;
            emit Deposited(msg.sender, msg.value);
        }
    }
}

