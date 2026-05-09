// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PokerGame0G
 * @notice Main game contract for the 0G Poker game on ZeroGravity network
 * @dev Handles fund custody, deposits, withdrawals, and game settlement
 */
contract PokerGame0G is AccessControl {
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

    // ============ State Variables ============
    mapping(address => uint256) public custodyBalance;
    mapping(address => address) public delegates; // player => delegated operator
    mapping(uint256 => bytes32) public handStateHashes; // handId => stateHash
    uint256 public totalCustody;
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
    function withdraw(uint256 amount) external {
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
