// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Staking
 * @dev CHIP Token Staking Contract
 * Stake CHIP to earn platform revenue share and VIP benefits
 * 
 * Reward Rule: Daily Reward = clamp(max(stakes) * (userStake / totalStaked) / 30, 1 CHIP, 1000 CHIP)
 * 
 * Examples:
 * - If max stake is 30000 CHIP, total staked is 30000 CHIP, user stakes 30000 CHIP:
 *   Daily reward = 30000 * 30000/30000 / 30 = 1000 CHIP (capped at MAX)
 * - If max stake is 30000 CHIP, total staked is 60000 CHIP, user stakes 1000 CHIP:
 *   Daily reward = 30000 * 1000/60000 / 30 = 16.67 CHIP
 * - If max stake is 100 CHIP, total staked is 100 CHIP, user stakes 100 CHIP:
 *   Daily reward = 100 * 100/100 / 30 = 3.33 CHIP
 */
contract Staking is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    uint256 public constant MIN_STAKE = 100 * 1e6;          // 100 CHIP minimum
    uint256 public constant MIN_LOCK_DURATION = 30 days;    // 30 days minimum
    uint256 public constant MAX_LOCK_DURATION = 365 days;   // 365 days maximum
    uint256 public constant EARLY_UNSTAKE_PENALTY = 1000;   // 10% penalty (basis points)
    
    // Reward limits
    uint256 public constant MIN_DAILY_REWARD = 1 * 1e6;     // 1 CHIP minimum daily reward
    uint256 public constant MAX_DAILY_REWARD = 1000 * 1e6;  // 1000 CHIP maximum daily reward
    uint256 public constant REWARD_DENOMINATOR = 30;        // Divide by 30 for daily reward
    
    // ============ Structs ============
    
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lockedUntil;
        uint256 lastClaimTime;    // Last time rewards were claimed
        bool isActive;
    }
    
    // ============ State Variables ============
    
    IERC20 public chipToken;
    
    uint256 public totalStaked;
    uint256 public totalRewardPool;
    uint256 public totalRewardsClaimed;
    
    uint256 public minLockDuration = MIN_LOCK_DURATION;
    uint256 public maxLockDuration = MAX_LOCK_DURATION;
    uint256 public earlyUnstakePenalty = EARLY_UNSTAKE_PENALTY;
    
    // Track largest stake for reward calculation
    uint256 public largestStake;
    
    // Track all stakers for largestStake recalculation
    address[] public stakers;
    mapping(address => uint256) public stakerIndex; // 1-based index, 0 means not in array
    
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public totalUserRewardsClaimed;
    
    // ============ Events ============
    
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount, uint256 totalPool);
    event PenaltyUpdated(uint256 newPenalty);
    event LargestStakeUpdated(uint256 newLargestStake);
    
    // ============ Constructor ============
    
    constructor(address _chipToken)  {
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
            userStake.lastClaimTime = block.timestamp;
            userStake.isActive = true;
            
            // Add to stakers array (only for new stakers)
            _addStaker(msg.sender);
        }
        
        totalStaked += amount;
        
        // Update largestStake if needed
        if (userStake.amount > largestStake) {
            largestStake = userStake.amount;
            emit LargestStakeUpdated(largestStake);
        }
        
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
        
        uint256 penalty = 0;
        uint256 transferAmount = amount;
        
        // Calculate penalty if unstaking early
        if (block.timestamp < userStake.lockedUntil) {
            penalty = amount * earlyUnstakePenalty / 10000;
            transferAmount = amount - penalty;
        }
        
        // Update stake
        userStake.amount -= amount;
        
        if (userStake.amount == 0) {
            userStake.isActive = false;
            // Remove from stakers array
            _removeStaker(msg.sender);
        }
        
        totalStaked -= amount;
        
        // Update largestStake if this was the largest staker
        if (userStake.amount < largestStake || largestStake == 0) {
            _updateLargestStake();
        }
        
        // Transfer tokens to user
        chipToken.safeTransfer(msg.sender, transferAmount);
        
        // Send penalty to owner
        if (penalty > 0) {
            chipToken.safeTransfer(owner(), penalty);
        }
        
        emit Unstaked(msg.sender, amount, penalty);
    }
    
    /**
     * @dev Claim pending rewards
     * Daily Reward = clamp(largestStake * (userStake / totalStaked) / 30, MIN, MAX)
     */
    function claimReward() external nonReentrant whenNotPaused {
        StakeInfo storage userStake = stakes[msg.sender];
        
        require(userStake.isActive, "Staking: no active stake");
        require(userStake.amount > 0, "Staking: no stake amount");
        require(totalStaked > 0, "Staking: no total staked");
        
        // Calculate reward
        uint256 stakeDuration = block.timestamp - userStake.lastClaimTime;
        
        // Daily reward = largestStake * (userStake / totalStaked) / 30
        // Formula: reward = largestStake * userStake.amount * stakeDuration / (totalStaked * 30 * 1 day)
        uint256 reward = largestStake * userStake.amount * stakeDuration / (totalStaked * REWARD_DENOMINATOR * 1 days);
        
        // Apply daily limits
        uint256 dailyMin = MIN_DAILY_REWARD * stakeDuration / 1 days;
        uint256 dailyMax = MAX_DAILY_REWARD * stakeDuration / 1 days;
        
        if (reward < dailyMin) {
            reward = dailyMin;
        } else if (reward > dailyMax) {
            reward = dailyMax;
        }
        
        require(reward > 0, "Staking: no rewards to claim");
        
        // Check reward pool balance
        uint256 availableRewards = chipToken.balanceOf(address(this)) - totalStaked;
        require(reward <= availableRewards, "Staking: insufficient reward pool");
        
        // Update last claim time
        userStake.lastClaimTime = block.timestamp;
        
        // Update total claimed
        totalRewardsClaimed += reward;
        totalUserRewardsClaimed[msg.sender] += reward;
        
        // Transfer reward
        chipToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    /**
     * @dev Add rewards to the pool (called by platform)
     * @param amount Amount of CHIP to add
     */
    function addReward(uint256 amount) external nonReentrant {
        chipToken.safeTransferFrom(msg.sender, address(this), amount);
        totalRewardPool += amount;
        emit RewardAdded(amount, totalRewardPool);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Add staker to the array
     */
    function _addStaker(address staker) internal {
        if (stakerIndex[staker] == 0) {
            stakers.push(staker);
            stakerIndex[staker] = stakers.length; // 1-based index
        }
    }
    
    /**
     * @dev Remove staker from the array
     */
    function _removeStaker(address staker) internal {
        uint256 index = stakerIndex[staker];
        if (index == 0) return; // Not in array
        
        // Move last element to the position of the element to delete
        uint256 lastIndex = stakers.length;
        if (index != lastIndex) {
            address lastStaker = stakers[lastIndex - 1];
            stakers[index - 1] = lastStaker;
            stakerIndex[lastStaker] = index;
        }
        
        // Remove last element
        stakers.pop();
        stakerIndex[staker] = 0;
    }
    
    /**
     * @dev Recalculate largestStake from all active stakers
     */
    function _updateLargestStake() internal {
        uint256 maxStake = 0;
        
        for (uint256 i = 0; i < stakers.length; i++) {
            address staker = stakers[i];
            StakeInfo storage s = stakes[staker];
            
            if (s.isActive && s.amount > maxStake) {
                maxStake = s.amount;
            }
        }
        
        largestStake = maxStake;
        emit LargestStakeUpdated(largestStake);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get pending reward for user
     * Daily Reward = clamp(largestStake * (userStake / totalStaked) / 30, MIN, MAX)
     */
    function getPendingReward(address user) external view returns (uint256) {
        StakeInfo storage userStake = stakes[user];
        
        if (!userStake.isActive || userStake.amount == 0 || totalStaked == 0) {
            return 0;
        }
        
        uint256 stakeDuration = block.timestamp - userStake.lastClaimTime;
        
        // Daily reward calculation
        uint256 reward = largestStake * userStake.amount * stakeDuration / (totalStaked * REWARD_DENOMINATOR * 1 days);
        
        // Apply limits
        uint256 dailyMin = MIN_DAILY_REWARD * stakeDuration / 1 days;
        uint256 dailyMax = MAX_DAILY_REWARD * stakeDuration / 1 days;
        
        if (reward < dailyMin) {
            return dailyMin;
        } else if (reward > dailyMax) {
            return dailyMax;
        }
        
        return reward;
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
    
    /**
     * @dev Get total number of stakers
     */
    function getStakersCount() external view returns (uint256) {
        return stakers.length;
    }
    
    /**
     * @dev Get staker address by index
     */
    function getStaker(uint256 index) external view returns (address) {
        require(index < stakers.length, "Staking: index out of bounds");
        return stakers[index];
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
        
        // Remove from stakers array
        _removeStaker(msg.sender);
        
        // Update largestStake
        _updateLargestStake();
        
        chipToken.safeTransfer(msg.sender, transferAmount);
        chipToken.safeTransfer(owner(), penalty);
        
        emit Unstaked(msg.sender, amount, penalty);
    }
    
    // ============ Receive ============
    
    receive() external payable {}
    fallback() external payable {}
}
