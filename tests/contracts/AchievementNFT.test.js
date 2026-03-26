const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('AchievementNFT Contract', function () {
  let AchievementNFT;
  let nft;
  let owner;
  let serverWallet;
  let player1;
  let player2;

  const ACHIEVEMENT_TYPES = {
    ROYAL_FLUSH: 1,
    STRAIGHT_FLUSH: 2,
    FOUR_OF_A_KIND: 3,
    FULL_HOUSE: 4,
    FLUSH: 5,
    STRAIGHT: 6
  };

  beforeEach(async function () {
    [owner, serverWallet, player1, player2] = await ethers.getSigners();

    AchievementNFT = await ethers.getContractFactory('AchievementNFT');
    nft = await AchievementNFT.deploy(serverWallet.address);
  });

  describe('Deployment', function () {
    it('Should set the correct server wallet', async function () {
      expect(await nft.serverWallet()).to.equal(serverWallet.address);
    });

    it('Should have correct name and symbol', async function () {
      expect(await nft.name()).to.equal('Poker Achievement NFT');
      expect(await nft.symbol()).to.equal('PANFT');
    });

    it('Should initialize with default achievement types', async function () {
      const royalFlush = await nft.getAchievementType(1);
      expect(royalFlush.name).to.equal('Royal Flush');
      expect(royalFlush.rarity).to.equal(1); // Legendary
    });
  });

  describe('NFT Claiming', function () {
    let signature;
    let messageHash;
    const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;
    const nonce = Date.now();

    beforeEach(async function () {
      // Create message hash
      messageHash = ethers.utils.solidityKeccak256(
        ['address', 'uint8', 'uint256', 'uint256'],
        [player1.address, achievementType, nonce, 0] // 0 = tokenId placeholder
      );
      
      // Sign with server wallet
      signature = await serverWallet.signMessage(ethers.utils.arrayify(messageHash));
    });

    it('Should allow claiming NFT with valid signature', async function () {
      const tx = await nft.connect(player1).claimNFT(
        achievementType,
        nonce,
        signature
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'NFTClaimed');
      
      expect(event).to.not.be.undefined;
      expect(event.args.to).to.equal(player1.address);
      expect(event.args.achievementType).to.equal(achievementType);
    });

    it('Should mint NFT to correct owner', async function () {
      await nft.connect(player1).claimNFT(achievementType, nonce, signature);
      
      expect(await nft.ownerOf(1)).to.equal(player1.address);
      expect(await nft.balanceOf(player1.address)).to.equal(1);
    });

    it('Should fail with invalid signature', async function () {
      // Sign with wrong wallet
      const badSignature = await player2.signMessage(ethers.utils.arrayify(messageHash));
      
      await expect(
        nft.connect(player1).claimNFT(achievementType, nonce, badSignature)
      ).to.be.revertedWith('AchievementNFT: invalid signature');
    });

    it('Should fail with used nonce', async function () {
      // First claim
      await nft.connect(player1).claimNFT(achievementType, nonce, signature);
      
      // Try to reuse nonce
      await expect(
        nft.connect(player1).claimNFT(achievementType, nonce, signature)
      ).to.be.revertedWith('AchievementNFT: signature already used');
    });
  });

  describe('Monthly Limit', function () {
    async function createSignature(player, achievementType, nonce) {
      const messageHash = ethers.utils.solidityKeccak256(
        ['address', 'uint8', 'uint256', 'uint256'],
        [player.address, achievementType, nonce, 0]
      );
      return serverWallet.signMessage(ethers.utils.arrayify(messageHash));
    }

    it('Should enforce monthly limit of 1 per achievement type', async function () {
      const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;
      const nonce1 = Date.now();
      
      // First claim should succeed
      const sig1 = await createSignature(player1, achievementType, nonce1);
      await nft.connect(player1).claimNFT(achievementType, nonce1, sig1);
      
      // Second claim for same type in same month should fail
      const nonce2 = nonce1 + 1;
      const sig2 = await createSignature(player1, achievementType, nonce2);
      
      await expect(
        nft.connect(player1).claimNFT(achievementType, nonce2, sig2)
      ).to.be.revertedWith('AchievementNFT: monthly limit exceeded');
    });

    it('Should allow different achievement types in same month', async function () {
      const nonce1 = Date.now();
      const nonce2 = nonce1 + 1;
      
      // Claim Royal Flush
      const sig1 = await createSignature(player1, ACHIEVEMENT_TYPES.ROYAL_FLUSH, nonce1);
      await nft.connect(player1).claimNFT(ACHIEVEMENT_TYPES.ROYAL_FLUSH, nonce1, sig1);
      
      // Claim Straight Flush (different type)
      const sig2 = await createSignature(player1, ACHIEVEMENT_TYPES.STRAIGHT_FLUSH, nonce2);
      await nft.connect(player1).claimNFT(ACHIEVEMENT_TYPES.STRAIGHT_FLUSH, nonce2, sig2);
      
      expect(await nft.balanceOf(player1.address)).to.equal(2);
    });
  });

  describe('Achievement Info', function () {
    beforeEach(async function () {
      // Mint an NFT
      const nonce = Date.now();
      const messageHash = ethers.utils.solidityKeccak256(
        ['address', 'uint8', 'uint256', 'uint256'],
        [player1.address, ACHIEVEMENT_TYPES.ROYAL_FLUSH, nonce, 0]
      );
      const signature = await serverWallet.signMessage(ethers.utils.arrayify(messageHash));
      
      await nft.connect(player1).claimNFT(ACHIEVEMENT_TYPES.ROYAL_FLUSH, nonce, signature);
    });

    it('Should return correct achievement info for token', async function () {
      const info = await nft.getAchievementInfo(1);
      
      expect(info.achievementType).to.equal(ACHIEVEMENT_TYPES.ROYAL_FLUSH);
      expect(info.claimedAt).to.be.greaterThan(0);
    });

    it('Should return correct token URI', async function () {
      const uri = await nft.tokenURI(1);
      expect(uri).to.include('data:application/json;base64,');
    });
  });

  describe('Rarity Levels', function () {
    it('Should have correct rarity for each achievement type', async function () {
      const royalFlush = await nft.getAchievementType(1);
      const straightFlush = await nft.getAchievementType(2);
      const fourOfKind = await nft.getAchievementType(3);
      const fullHouse = await nft.getAchievementType(4);
      const flush = await nft.getAchievementType(5);
      const straight = await nft.getAchievementType(6);
      
      expect(royalFlush.rarity).to.equal(1);      // Legendary
      expect(straightFlush.rarity).to.equal(2);   // Epic
      expect(fourOfKind.rarity).to.equal(3);      // Rare
      expect(fullHouse.rarity).to.equal(4);       // Uncommon
      expect(flush.rarity).to.equal(5);           // Common
      expect(straight.rarity).to.equal(6);        // Common
    });
  });
});
