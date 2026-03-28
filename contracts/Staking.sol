// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Staking
 * @dev CHIP Token Staking Contract
 * Stake CHIP to earn platform revenue share and VIP benefits
 */
contract Staking is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant MIN_STAKE = 100 * 1e6;          // 100 CHIP minimum
    uint256 public constant MIN_LOCK_DURATION = 7 days;     // 7 days minimum
    uint256 public constant MAX_LOCK_DURATION = 365 days;   // 365 days maximum
    uint256 public constant EARLY_UNSTAKE_PENALTY = 1000;   // 10% penalty (basis points)
    
    // ============ Structs ============
    
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lockedUntil;
        uint256 rewardDebt;      // Reward debt for reward calculation
        bool isActive;
    }
    
    // ============ State Variables ============
    
    IERC20 public chipToken;
    
    uint256 public totalStaked;
    uint256 public totalRewardPool;
    uint256 public rewardPerToken;       // Accumulated reward per token
    uint256 public lastRewardUpdate;
    
    uint256 public minLockDuration = MIN_LOCK_DURATION;
    uint256 public maxLockDuration = MAX_LOCK_DURATION;
    uint256 public earlyUnstakePenalty = EARLY_UNSTAKE_PENALTY;
    
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public pendingRewards;
    
    // ============ Events ============
    
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount, uint256 totalPool);
    event PenaltyUpdated(uint256 newPenalty);
    
    // ============ Constructor ============
    
    constructor(address _chipToken) Ownable(msg.sender) {
        require(_chipToken != address(0), "Staking: invalid token");
        chipToken = IERC20(_chipToken);
    }
    
    // ============ Core Functions ============
    
    /**
     * @dev Stake CHIP tokens
     * @param amount Amount to stake
     * @param lockDuration Lock duration in seconds
     */
    function stake(uint256 amount, uint256 lockDuration) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(amount >= MIN_STAKE, "Staking: below minimum stake");
        require(lockDuration >= minLockDuration, "Staking: lock too short");
        require(lockDuration <= maxLockDuration, "Staking: lock too long");
        
        // Update rewards for existing stake
        _updateRewards(msg.sender);
        
        // Transfer tokens
        chipToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create or update stake
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.isActive) {
            // Add to existing stake
            userStake.amount += amount;
            userStake.lockedUntil = block.timestamp + lockDuration;
        } else {
            // New stake
            userStake.amount = amount;
            userStake.startTime = block.timestamp;
            userStake.lockedUntil = block.timestamp + lockDuration;
            userStake.isActive = true;
        }
        
        userStake.rewardDebt = userStake.amount * rewardPerToken / 1e18;
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, lockDuration);
    }
    
    /**
     * @dev Unstake CHIP tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        StakeInfo storage userStake = stakes[msg.sender];
        
        require(userStake.isActive, "Staking: no active stake");
        require(userStake.amount >= amount, "Staking: insufficient stake");
        
        // Update rewards
        _updateRewards(msg.sender);
        
        uint256 penalty = 0;
        uint256 transferAmount = amount;
        
        // Calculate penalty if unstaking early
        if (block.timestamp < userStake.lockedUntil) {
            penalty = amount * earlyUnstakePenalty / 10000;
            transferAmount = amount - penalty;
        }
        
        // Update stake
        userStake.amount -= amount;
        userStake.rewardDebt = userStake.amount * rewardPerToken / 1e18;
        
        if (userStake.amount == 0) {
            userStake.isActive = false;
        }
        
        totalStaked -= amount;
        
        // Transfer tokens to user
        chipToken.safeTransfer(msg.sender, transferAmount);
        
        // Burn penalty tokens (or send to treasury)
        if (penalty > 0) {
            chipToken.safeTransfer(owner(), penalty);
        }
        
        emit Unstaked(msg.sender, amount, penalty);
    }
    
    /**
     * @dev Claim pending rewards
     */
    function claimReward() external nonReentrant whenNotPaused {
        _updateRewards(msg.sender);
        
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "Staking: no rewards to claim");
        
        pendingRewards[msg.sender] = 0;
        
        chipToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    /**
     * @dev Add rewards to the pool (called by platform)
     * @param amount Amount of CHIP to add
     */
    function addReward(uint256 amount) external nonReentrant {
        chipToken.safeTransferFrom(msg.sender, address(this), amount);
        
        if (totalStaked > 0) {
            rewardPerToken += amount * 1e18 / totalStaked;
        }
        
        totalRewardPool += amount;
        lastRewardUpdate = block.timestamp;
        
        emit RewardAdded(amount, totalRewardPool);
    }
    
    // ============ Internal Functions ============
    
    function _updateRewards(address user) internal {
        StakeInfo storage userStake = stakes[user];
        
        if (userStake.isActive && userStake.amount > 0) {
            uint256 pending = userStake.amount * rewardPerToken / 1e18 - userStake.rewardDebt;
            pendingRewards[user] += pending;
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get pending reward for user
     */
    function getPendingReward(address user) external view returns (uint256) {
        StakeInfo storage userStake = stakes[user];
        
        if (!userStake.isActive || userStake.amount == 0) {
            return pendingRewards[user];
        }
        
        uint256 pending = userStake.amount * rewardPerToken / 1e18 - userStake.rewardDebt;
        return pendingRewards[user] + pending;
    }
    
    /**
     * @dev Get stake info for user
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lockedUntil,
        bool isLocked,
        bool isActive
    ) {
        StakeInfo storage userStake = stakes[user];
        return (
            userStake.amount,
            userStake.startTime,
            userStake.lockedUntil,
            block.timestamp < userStake.lockedUntil,
            userStake.isActive
        );
    }
    
    /**
     * @dev Check if user's stake is locked
     */
    function isLocked(address user) external view returns (bool) {
        return block.timestamp < stakes[user].lockedUntil;
    }
    
    /**
     * @dev Get remaining lock time for user
     */
    function getRemainingLockTime(address user) external view returns (uint256) {
        uint256 lockedUntil = stakes[user].lockedUntil;
        
        if (block.timestamp >= lockedUntil) {
            return 0;
        }
        
        return lockedUntil - block.timestamp;
    }
    
    // ============ Admin Functions ============
    
    function setLockDuration(uint256 _minDuration, uint256 _maxDuration) external onlyOwner {
        require(_minDuration < _maxDuration, "Staking: invalid durations");
        minLockDuration = _minDuration;
        maxLockDuration = _maxDuration;
    }
    
    function setEarlyUnstakePenalty(uint256 _penalty) external onlyOwner {
        require(_penalty <= 3000, "Staking: penalty too high"); // Max 30%
        earlyUnstakePenalty = _penalty;
        emit PenaltyUpdated(_penalty);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Emergency Functions ============
    
    function emergencyUnstake() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        
        require(userStake.isActive, "Staking: no active stake");
        
        uint256 amount = userStake.amount;
        uint256 penalty = amount * earlyUnstakePenalty / 10000;
        uint256 transferAmount = amount - penalty;
        
        userStake.amount = 0;
        userStake.isActive = false;
        totalStaked -= amount;
        
        chipToken.safeTransfer(msg.sender, transferAmount);
        chipToken.safeTransfer(owner(), penalty);
        
        emit Unstaked(msg.sender, amount, penalty);
    }
    
    // ============ Receive ============
    
    receive() external payable {}
    fallback() external payable {}
}
