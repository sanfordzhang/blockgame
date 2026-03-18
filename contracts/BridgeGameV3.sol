// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BridgeGameV3 - Ultra Low Cost Version
 * @dev Optimized for minimal deployment and operation cost
 */
contract BridgeGameV3 {
    address public owner;
    bool public paused;

    uint256 public constant MIN_BUY_IN = 10 * 1e6;
    uint256 public constant MAX_BUY_IN = 1000 * 1e6;
    uint256 public rakeRate = 1000; // 10%

    struct Player {
        uint256 balance;
        uint256 lockedAmount;
        bool isRegistered;
    }

    mapping(address => Player) public players;
    mapping(address => address) public playerDelegates;
    mapping(address => mapping(address => bool)) public isDelegateAuthorized;
    mapping(uint256 => mapping(address => uint256)) public playerBuyIn;
    mapping(uint256 => mapping(address => bool)) public playerAtTable;

    uint256 public accumulatedRake;
    address public rakeRecipient;

    // Minimal events
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    event JoinedTableFor(address indexed player, uint256 indexed tableId, uint256 buyIn);
    event LeftTableFor(address indexed player, uint256 indexed tableId, uint256 amount);
    event RakeCollected(uint256 indexed tableId, address indexed player, uint256 rakeAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    constructor(address _rakeRecipient) {
        owner = msg.sender;
        rakeRecipient = _rakeRecipient != address(0) ? _rakeRecipient : msg.sender;
    }

    function registerPlayer() external {
        require(!players[msg.sender].isRegistered, "Already registered");
        players[msg.sender].isRegistered = true;
    }

    function deposit() external payable whenNotPaused {
        require(msg.value >= MIN_BUY_IN, "Below minimum");
        players[msg.sender].balance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external whenNotPaused {
        Player storage p = players[msg.sender];
        require(p.balance >= amount, "Insufficient balance");
        p.balance -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function setDelegate(address delegate) external {
        require(delegate != address(0), "Invalid delegate");
        playerDelegates[msg.sender] = delegate;
        isDelegateAuthorized[msg.sender][delegate] = true;
    }

    function joinTableFor(address playerAddr, uint256 tableId, uint256 buyInAmount) external whenNotPaused {
        require(isDelegateAuthorized[playerAddr][msg.sender], "Not authorized");
        Player storage p = players[playerAddr];
        require(p.balance >= buyInAmount, "Insufficient balance");
        require(!playerAtTable[tableId][playerAddr], "Already at table");

        p.balance -= buyInAmount;
        p.lockedAmount += buyInAmount;
        playerBuyIn[tableId][playerAddr] = buyInAmount;
        playerAtTable[tableId][playerAddr] = true;

        emit JoinedTableFor(playerAddr, tableId, buyInAmount);
    }

    function leaveTableFor(address playerAddr, uint256 tableId, uint256 finalStack) external whenNotPaused {
        require(isDelegateAuthorized[playerAddr][msg.sender], "Not authorized");
        Player storage p = players[playerAddr];
        require(playerAtTable[tableId][playerAddr], "Not at table");

        uint256 buyIn = playerBuyIn[tableId][playerAddr];
        uint256 rake = 0;
        uint256 netStack = finalStack;

        if (finalStack > buyIn && rakeRate > 0) {
            rake = ((finalStack - buyIn) * rakeRate) / 10000;
            netStack = finalStack - rake;
        }

        p.lockedAmount = 0;
        p.balance += netStack;
        playerBuyIn[tableId][playerAddr] = 0;
        playerAtTable[tableId][playerAddr] = false;

        if (rake > 0) {
            (bool ok,) = payable(rakeRecipient).call{value: rake}("");
            if (ok) {
                emit RakeCollected(tableId, playerAddr, rake);
            } else {
                accumulatedRake += rake;
            }
        }

        emit LeftTableFor(playerAddr, tableId, netStack);
    }

    function setRakeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Max 10%");
        rakeRate = newRate;
    }

    function withdrawRake(address payable to) external onlyOwner {
        uint256 amount = accumulatedRake;
        require(amount > 0, "No rake");
        accumulatedRake = 0;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    function getPlayerInfo(address player) external view returns (uint256, uint256, bool) {
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
