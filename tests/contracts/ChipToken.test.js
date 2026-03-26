const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ChipToken Contract', function () {
  let ChipToken;
  let chip;
  let owner;
  let minter;
  let user1;
  let user2;

  const INITIAL_SUPPLY = ethers.utils.parseEther('1000000000'); // 1 billion
  const MINT_AMOUNT = ethers.utils.parseEther('1000');

  beforeEach(async function () {
    [owner, minter, user1, user2] = await ethers.getSigners();

    ChipToken = await ethers.getContractFactory('ChipToken');
    chip = await ChipToken.deploy(owner.address);
  });

  describe('Deployment', function () {
    it('Should set correct name and symbol', async function () {
      expect(await chip.name()).to.equal('CHIP Token');
      expect(await chip.symbol()).to.equal('CHIP');
    });

    it('Should mint initial supply to owner', async function () {
      expect(await chip.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
      expect(await chip.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it('Should set owner as initial minter', async function () {
      expect(await chip.isMinter(owner.address)).to.be.true;
    });
  });

  describe('Minting', function () {
    it('Should allow minter to mint tokens', async function () {
      await chip.connect(owner).addMinter(minter.address);
      await chip.connect(minter).mint(user1.address, MINT_AMOUNT);
      
      expect(await chip.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });

    it('Should fail if non-minter tries to mint', async function () {
      await expect(
        chip.connect(user1).mint(user2.address, MINT_AMOUNT)
      ).to.be.revertedWith('ChipToken: caller is not a minter');
    });

    it('Should allow owner to add/remove minters', async function () {
      await chip.connect(owner).addMinter(minter.address);
      expect(await chip.isMinter(minter.address)).to.be.true;
      
      await chip.connect(owner).removeMinter(minter.address);
      expect(await chip.isMinter(minter.address)).to.be.false;
    });
  });

  describe('Burning', function () {
    it('Should allow burning own tokens', async function () {
      const burnAmount = ethers.utils.parseEther('100');
      const balanceBefore = await chip.balanceOf(owner.address);
      
      await chip.connect(owner).burn(burnAmount);
      
      expect(await chip.balanceOf(owner.address)).to.equal(
        balanceBefore.sub(burnAmount)
      );
    });

    it('Should allow burning with approval', async function () {
      const burnAmount = ethers.utils.parseEther('100');
      
      // Transfer some tokens to user1
      await chip.connect(owner).transfer(user1.address, burnAmount);
      
      // User1 approves user2 to burn
      await chip.connect(user1).approve(user2.address, burnAmount);
      
      // User2 burns from user1
      await chip.connect(user2).burnFrom(user1.address, burnAmount);
      
      expect(await chip.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe('Pausing', function () {
    it('Should pause transfers when paused', async function () {
      await chip.connect(owner).pause();
      
      await expect(
        chip.connect(owner).transfer(user1.address, MINT_AMOUNT)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('Should allow transfers when unpaused', async function () {
      await chip.connect(owner).pause();
      await chip.connect(owner).unpause();
      
      await expect(
        chip.connect(owner).transfer(user1.address, MINT_AMOUNT)
      ).to.not.be.reverted;
    });
  });

  describe('Transfers', function () {
    it('Should transfer tokens correctly', async function () {
      await chip.connect(owner).transfer(user1.address, MINT_AMOUNT);
      
      expect(await chip.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
    });

    it('Should emit Transfer event', async function () {
      await expect(
        chip.connect(owner).transfer(user1.address, MINT_AMOUNT)
      ).to.emit(chip, 'Transfer')
        .withArgs(owner.address, user1.address, MINT_AMOUNT);
    });

    it('Should fail transfer if insufficient balance', async function () {
      const tooMuch = INITIAL_SUPPLY.add(1);
      
      await expect(
        chip.connect(owner).transfer(user1.address, tooMuch)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
  });

  describe('Allowance', function () {
    it('Should approve spending', async function () {
      await chip.connect(owner).approve(user1.address, MINT_AMOUNT);
      
      expect(await chip.allowance(owner.address, user1.address)).to.equal(MINT_AMOUNT);
    });

    it('Should transferFrom with approval', async function () {
      await chip.connect(owner).approve(user1.address, MINT_AMOUNT);
      await chip.connect(user1).transferFrom(owner.address, user2.address, MINT_AMOUNT);
      
      expect(await chip.balanceOf(user2.address)).to.equal(MINT_AMOUNT);
    });
  });
});
