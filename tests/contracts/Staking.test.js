const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Staking Contract', function () {
  let Staking, ChipToken;
  let staking, chip;
  let owner, user1, user2;

  const STAKE_AMOUNT = ethers.utils.parseEther('1000');
  const LOCK_DAYS = 30;
  const REWARD_AMOUNT = ethers.utils.parseEther('100');

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy CHIP token
    ChipToken = await ethers.getContractFactory('ChipToken');
    chip = await ChipToken.deploy(owner.address);

    // Deploy Staking contract
    Staking = await ethers.getContractFactory('Staking');
    staking = await Staking.deploy(chip.address);

    // Transfer tokens to users
    await chip.transfer(user1.address, STAKE_AMOUNT.mul(10));
    await chip.transfer(user2.address, STAKE_AMOUNT.mul(10));

    // Approve staking contract
    await chip.connect(user1).approve(staking.address, STAKE_AMOUNT.mul(10));
    await chip.connect(user2).approve(staking.address, STAKE_AMOUNT.mul(10));

    // Add staking as minter for rewards
    await chip.addMinter(staking.address);
  });

  describe('Deployment', function () {
    it('Should set correct CHIP token address', async function () {
      expect(await staking.chipToken()).to.equal(chip.address);
    });
  });

  describe('Staking', function () {
    it('Should allow staking tokens', async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT, LOCK_DAYS);
      
      const stakeInfo = await staking.getStakeInfo(user1.address, 0);
      expect(stakeInfo.amount).to.equal(STAKE_AMOUNT);
      expect(stakeInfo.lockDays).to.equal(LOCK_DAYS);
    });

    it('Should transfer tokens to staking contract', async function () {
      const balanceBefore = await chip.balanceOf(staking.address);
      
      await staking.connect(user1).stake(STAKE_AMOUNT, LOCK_DAYS);
      
      expect(await chip.balanceOf(staking.address)).to.equal(
        balanceBefore.add(STAKE_AMOUNT)
      );
    });

    it('Should fail with amount below minimum', async function () {
      const smallAmount = ethers.utils.parseEther('10'); // Below 100 minimum
      
      await expect(
        staking.connect(user1).stake(smallAmount, LOCK_DAYS)
      ).to.be.revertedWith('Staking: amount below minimum');
    });

    it('Should fail with invalid lock duration', async function () {
      await expect(
        staking.connect(user1).stake(STAKE_AMOUNT, 2) // Below 7 days
      ).to.be.revertedWith('Staking: invalid lock duration');
    });
  });

  describe('Unstaking', function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT, LOCK_DAYS);
    });

    it('Should allow unstaking after lock period', async function () {
      // Fast forward time
      await time.increase(LOCK_DAYS * 24 * 60 * 60);
      
      const balanceBefore = await chip.balanceOf(user1.address);
      
      await staking.connect(user1).unstake(0);
      
      expect(await chip.balanceOf(user1.address)).to.equal(
        balanceBefore.add(STAKE_AMOUNT)
      );
    });

    it('Should apply penalty for early unstake', async function () {
      // Unstake immediately (early)
      const balanceBefore = await chip.balanceOf(user1.address);
      
      await staking.connect(user1).unstake(0);
      
      // Should receive 90% (10% penalty)
      const expected = STAKE_AMOUNT.mul(90).div(100);
      expect(await chip.balanceOf(user1.address)).to.equal(
        balanceBefore.add(expected)
      );
    });

    it('Should fail if already unstaked', async function () {
      await time.increase(LOCK_DAYS * 24 * 60 * 60);
      await staking.connect(user1).unstake(0);
      
      await expect(
        staking.connect(user1).unstake(0)
      ).to.be.revertedWith('Staking: already unstaked');
    });
  });

  describe('Rewards', function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT, LOCK_DAYS);
      
      // Add rewards to contract
      await chip.connect(owner).transfer(staking.address, REWARD_AMOUNT);
      await staking.connect(owner).addReward(REWARD_AMOUNT);
    });

    it('Should accumulate rewards over time', async function () {
      // Wait some time
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      const pending = await staking.getPendingReward(user1.address, 0);
      expect(pending).to.be.greaterThan(0);
    });

    it('Should allow claiming rewards', async function () {
      await time.increase(7 * 24 * 60 * 60);
      
      const balanceBefore = await chip.balanceOf(user1.address);
      const pending = await staking.getPendingReward(user1.address, 0);
      
      await staking.connect(user1).claimReward(0);
      
      expect(await chip.balanceOf(user1.address)).to.equal(
        balanceBefore.add(pending)
      );
    });
  });

  describe('VIP Levels', function () {
    it('Should return BRONZE for no stake', async function () {
      const level = await staking.getVIPLevel(user2.address);
      expect(level).to.equal(0); // BRONZE
    });

    it('Should return SILVER for 1000 CHIP stake', async function () {
      await staking.connect(user1).stake(ethers.utils.parseEther('1000'), LOCK_DAYS);
      
      const level = await staking.getVIPLevel(user1.address);
      expect(level).to.equal(1); // SILVER
    });

    it('Should return GOLD for 10000 CHIP stake', async function () {
      await staking.connect(user1).stake(ethers.utils.parseEther('10000'), LOCK_DAYS);
      
      const level = await staking.getVIPLevel(user1.address);
      expect(level).to.equal(2); // GOLD
    });

    it('Should return PLATINUM for 100000 CHIP stake', async function () {
      await staking.connect(user1).stake(ethers.utils.parseEther('100000'), LOCK_DAYS);
      
      const level = await staking.getVIPLevel(user1.address);
      expect(level).to.equal(3); // PLATINUM
    });
  });

  describe('View Functions', function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT, LOCK_DAYS);
    });

    it('Should return total staked', async function () {
      expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
    });

    it('Should return stake count', async function () {
      expect(await staking.getStakeCount(user1.address)).to.equal(1);
    });
  });
});
