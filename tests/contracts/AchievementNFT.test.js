const { expect } = require('chai');
const hre = require('hardhat');
const { ethers } = require('hardhat');

describe('AchievementNFT Contract', function () {
  let AchievementNFT;
  let nft;
  let owner;
  let signer;
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

  const BASE_URI = "https://api.example.com/nft/";

  // Helper functions at top level
  function splitSignature(signature) {
    const sig = ethers.Signature.from(signature);
    return { v: sig.v, r: sig.r, s: sig.s };
  }

  async function createSignature(signerWallet, player, achievementTypeId, ts, gid) {
    const hash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'string'],
      [player.address, achievementTypeId, ts, gid]
    );
    const signature = await signerWallet.signMessage(ethers.getBytes(hash));
    return signature;
  }

  async function mintNFT(nftContract, signerWallet, player, achievementType, timestamp, gameId, mintPrice) {
    const signature = await createSignature(signerWallet, player, achievementType, timestamp, gameId);
    const { v, r, s } = splitSignature(signature);
    await nftContract.connect(player).claimNFT(
      achievementType, timestamp, gameId, v, r, s,
      { value: mintPrice }
    );
  }

  beforeEach(async function () {
    [owner, signer, player1, player2] = await hre.ethers.getSigners();

    AchievementNFT = await hre.ethers.getContractFactory('AchievementNFT');
    nft = await AchievementNFT.deploy(signer.address, BASE_URI);
    await nft.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should set the correct signer', async function () {
      expect(await nft.signer()).to.equal(signer.address);
    });

    it('Should have correct name and symbol', async function () {
      expect(await nft.name()).to.equal('Poker Achievement NFT');
      expect(await nft.symbol()).to.equal('PA NFT');
    });

    it('Should initialize with default achievement types', async function () {
      const royalFlush = await nft.getAchievementInfo(1);
      expect(royalFlush.name).to.equal('Royal Flush');
      expect(Number(royalFlush.rarity)).to.equal(3); // LEGENDARY = 3
    });

    it('Should set the correct base URI', async function () {
      expect(await nft.baseURI()).to.equal(BASE_URI);
    });

    it('Should revert with zero signer address', async function () {
      const NFTFactory = await hre.ethers.getContractFactory('AchievementNFT');
      await expect(
        NFTFactory.deploy(ethers.ZeroAddress, BASE_URI)
      ).to.be.revertedWith('AchievementNFT: invalid signer');
    });
  });

  describe('NFT Claiming', function () {
    let achievementType;
    let timestamp;
    const gameId = "game-12345";
    let mintPrice;

    beforeEach(function () {
      achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;
      timestamp = Math.floor(Date.now() / 1000);
      mintPrice = ethers.parseUnits("5", 6); // 5 TRX in SUN
    });

    it('Should allow claiming NFT with valid signature', async function () {
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      const tx = await nft.connect(player1).claimNFT(
        achievementType,
        timestamp,
        gameId,
        v, r, s,
        { value: mintPrice }
      );
      
      const receipt = await tx.wait();
      
      // Check for AchievementMinted event (ethers v6 way)
      const iface = nft.interface;
      const event = receipt.logs.find(
        (log) => {
          try {
            return iface.parseLog(log)?.name === 'AchievementMinted';
          } catch { return false; }
        }
      );
      
      expect(event).to.not.be.undefined;
      const parsed = iface.parseLog(event);
      expect(parsed.args.player).to.equal(player1.address);
      expect(Number(parsed.args.achievementTypeId)).to.equal(achievementType);
    });

    it('Should mint NFT to correct owner', async function () {
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await nft.connect(player1).claimNFT(
        achievementType, timestamp, gameId, v, r, s,
        { value: mintPrice }
      );
      
      expect(await nft.ownerOf(1)).to.equal(player1.address);
      expect(Number(await nft.balanceOf(player1.address))).to.equal(1);
    });

    it('Should fail with invalid signature', async function () {
      // Sign with wrong wallet (player2 instead of signer)
      const hash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'string'],
        [player1.address, achievementType, timestamp, gameId]
      );
      const badSignature = await player2.signMessage(ethers.getBytes(hash));
      const { v, r, s } = splitSignature(badSignature);
      
      await expect(
        nft.connect(player1).claimNFT(
          achievementType, timestamp, gameId, v, r, s,
          { value: mintPrice }
        )
      ).to.be.revertedWith('AchievementNFT: invalid signature');
    });

    it('Should fail with expired signature', async function () {
      // Create a timestamp that's too old (more than 7 days ago)
      const oldTimestamp = Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60);
      const signature = await createSignature(signer, player1, achievementType, oldTimestamp, gameId);
      const { v, r, s } = splitSignature(signature);
      
      await expect(
        nft.connect(player1).claimNFT(
          achievementType, oldTimestamp, gameId, v, r, s,
          { value: mintPrice }
        )
      ).to.be.revertedWith('AchievementNFT: signature expired');
    });

    it('Should fail with replay attack (already claimed)', async function () {
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      // First claim should succeed
      await nft.connect(player1).claimNFT(
        achievementType, timestamp, gameId, v, r, s,
        { value: mintPrice }
      );
      
      // Try to claim again with same params
      await expect(
        nft.connect(player1).claimNFT(
          achievementType, timestamp, gameId, v, r, s,
          { value: mintPrice }
        )
      ).to.be.revertedWith('AchievementNFT: already claimed');
    });

    it('Should fail with insufficient payment', async function () {
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await expect(
        nft.connect(player1).claimNFT(
          achievementType, timestamp, gameId, v, r, s,
          { value: ethers.parseUnits("1", 6) } // Only 1 TRX
        )
      ).to.be.revertedWith('AchievementNFT: insufficient payment');
    });

    it('Should refund excess payment', async function () {
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      const excessAmount = ethers.parseUnits("10", 6); // 10 TRX

      const tx = await nft.connect(player1).claimNFT(
        achievementType, timestamp, gameId, v, r, s,
        { value: excessAmount }
      );
      
      await tx.wait();
      
      // Check contract balance - should only have mintPrice (5 TRX), not excessAmount (10 TRX)
      const nftAddress = await nft.getAddress();
      const contractBalance = await ethers.provider.getBalance(nftAddress);
      expect(contractBalance).to.equal(mintPrice); // Only mintPrice kept, excess refunded
    });

    it('Should fail with invalid achievement type', async function () {
      const invalidType = 7;
      const signature = await createSignature(signer, player1, invalidType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await expect(
        nft.connect(player1).claimNFT(
          invalidType, timestamp, gameId, v, r, s,
          { value: mintPrice }
        )
      ).to.be.revertedWith('AchievementNFT: invalid type');
    });

    it('Should support compact signature format', async function () {
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      
      const tx = await nft.connect(player1).claimNFTCompact(
        achievementType, timestamp, gameId, signature,
        { value: mintPrice }
      );
      
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
      
      expect(await nft.ownerOf(1)).to.equal(player1.address);
    });
  });

  describe('Monthly Limit', function () {
    let mintPrice;

    beforeEach(function () {
      mintPrice = ethers.parseUnits("5", 6);
    });

    it('Should enforce monthly limit for Royal Flush', async function () {
      const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;
      const royalFlush = await nft.getAchievementInfo(1);
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Monthly limit for Royal Flush is 5
      expect(Number(royalFlush.monthlyLimit)).to.equal(5);

      // Mint 5 NFTs (should all succeed)
      for (let i = 0; i < 5; i++) {
        await mintNFT(nft, signer, player1, achievementType, timestamp, `game-limit-${i}`, mintPrice);
      }
      
      expect(Number(await nft.balanceOf(player1.address))).to.equal(5);

      // 6th mint should fail
      const gameId = `game-limit-6`;
      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await expect(
        nft.connect(player1).claimNFT(
          achievementType, timestamp, gameId, v, r, s,
          { value: mintPrice }
        )
      ).to.be.revertedWith('AchievementNFT: monthly limit reached');
    });

    it('Should allow different achievement types in same month', async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Claim Royal Flush
      await mintNFT(nft, signer, player1, ACHIEVEMENT_TYPES.ROYAL_FLUSH, timestamp, 'game-type-1', mintPrice);
      
      // Claim Straight Flush (different type)
      await mintNFT(nft, signer, player1, ACHIEVEMENT_TYPES.STRAIGHT_FLUSH, timestamp, 'game-type-2', mintPrice);
      
      // Claim Four of a Kind (different type)
      await mintNFT(nft, signer, player1, ACHIEVEMENT_TYPES.FOUR_OF_A_KIND, timestamp, 'game-type-3', mintPrice);
      
      expect(Number(await nft.balanceOf(player1.address))).to.equal(3);
    });

    it('Should return correct remaining monthly mints', async function () {
      const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Initial remaining should be 5
      expect(Number(await nft.getMonthlyRemaining(achievementType))).to.equal(5);
      
      // Mint one
      await mintNFT(nft, signer, player1, achievementType, timestamp, 'game-remain-1', mintPrice);
      
      // Remaining should be 4
      expect(Number(await nft.getMonthlyRemaining(achievementType))).to.equal(4);
    });

    it('Should allow other players to mint same achievement type', async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Player 1 mints Royal Flush
      await mintNFT(nft, signer, player1, ACHIEVEMENT_TYPES.ROYAL_FLUSH, timestamp, 'game-p1', mintPrice);
      
      // Player 2 should still be able to mint Royal Flush
      await mintNFT(nft, signer, player2, ACHIEVEMENT_TYPES.ROYAL_FLUSH, timestamp, 'game-p2', mintPrice);
      
      expect(Number(await nft.balanceOf(player1.address))).to.equal(1);
      expect(Number(await nft.balanceOf(player2.address))).to.equal(1);
    });
  });

  describe('Achievement Info', function () {
    it('Should return correct achievement info for each type', async function () {
      const types = [
        { id: 1, name: 'Royal Flush', rarity: 3, monthlyLimit: 5 },      // LEGENDARY
        { id: 2, name: 'Straight Flush', rarity: 2, monthlyLimit: 10 },  // EPIC
        { id: 3, name: 'Four of a Kind', rarity: 1, monthlyLimit: 50 },  // RARE
        { id: 4, name: 'Full House', rarity: 1, monthlyLimit: 100 },     // RARE
        { id: 5, name: 'Flush', rarity: 0, monthlyLimit: 200 },          // COMMON
        { id: 6, name: 'Straight', rarity: 0, monthlyLimit: 300 }        // COMMON
      ];

      for (const type of types) {
        const info = await nft.getAchievementInfo(type.id);
        expect(info.name).to.equal(type.name);
        expect(Number(info.rarity)).to.equal(type.rarity);
        expect(Number(info.monthlyLimit)).to.equal(type.monthlyLimit);
        expect(info.mintPrice).to.equal(ethers.parseUnits("5", 6));
      }
    });

    it('Should return correct token URI', async function () {
      const mintPrice = ethers.parseUnits("5", 6);
      const timestamp = Math.floor(Date.now() / 1000);
      const gameId = "game-uri-test";
      const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;

      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await nft.connect(player1).claimNFT(
        achievementType, timestamp, gameId, v, r, s,
        { value: mintPrice }
      );

      const uri = await nft.tokenURI(1);
      expect(uri).to.equal(`${BASE_URI}1/1`);
    });
  });

  describe('Admin Functions', function () {
    it('Should allow owner to update signer', async function () {
      const newSigner = player2.address;
      await nft.connect(owner).setSigner(newSigner);
      expect(await nft.signer()).to.equal(newSigner);
    });

    it('Should not allow non-owner to update signer', async function () {
      await expect(
        nft.connect(player1).setSigner(player2.address)
      ).to.be.reverted;
    });

    it('Should allow owner to update base URI', async function () {
      const newURI = "https://new-api.example.com/nft/";
      await nft.connect(owner).setBaseURI(newURI);
      expect(await nft.baseURI()).to.equal(newURI);
    });

    it('Should allow owner to update achievement config', async function () {
      await nft.connect(owner).updateAchievement(
        1, // Royal Flush
        10, // new monthly limit
        ethers.parseUnits("10", 6) // new price
      );

      const info = await nft.getAchievementInfo(1);
      expect(Number(info.monthlyLimit)).to.equal(10);
      expect(info.mintPrice).to.equal(ethers.parseUnits("10", 6));
    });

    it('Should allow owner to pause and unpause', async function () {
      await nft.connect(owner).pause();
      expect(await nft.paused()).to.be.true;

      await nft.connect(owner).unpause();
      expect(await nft.paused()).to.be.false;
    });

    it('Should not allow claiming when paused', async function () {
      await nft.connect(owner).pause();

      const mintPrice = ethers.parseUnits("5", 6);
      const timestamp = Math.floor(Date.now() / 1000);
      const gameId = "game-paused";
      const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;

      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await expect(
        nft.connect(player1).claimNFT(
          achievementType, timestamp, gameId, v, r, s,
          { value: mintPrice }
        )
      ).to.be.reverted;
    });

    it('Should allow owner to withdraw TRX', async function () {
      // First, mint some NFTs to collect TRX
      const mintPrice = ethers.parseUnits("5", 6);
      const timestamp = Math.floor(Date.now() / 1000);
      const gameId = "game-withdraw";
      const achievementType = ACHIEVEMENT_TYPES.ROYAL_FLUSH;

      const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
      const { v, r, s } = splitSignature(signature);

      await nft.connect(player1).claimNFT(
        achievementType, timestamp, gameId, v, r, s,
        { value: mintPrice }
      );

      const nftAddress = await nft.getAddress();
      const contractBalance = await ethers.provider.getBalance(nftAddress);
      expect(contractBalance).to.equal(mintPrice);

      const tx = await nft.connect(owner).withdraw();
      await tx.wait();
      
      const contractBalanceAfter = await ethers.provider.getBalance(nftAddress);
      expect(contractBalanceAfter).to.equal(0);
    });
  });

  describe('View Functions', function () {
    it('Should return correct current year-month', async function () {
      const yearMonth = await nft.getCurrentYearMonth();
      // YearMonth should be in format YYYYMM
      expect(Number(yearMonth)).to.be.greaterThan(202401);
      expect(Number(yearMonth)).to.be.lessThan(210000);
    });

    it('Should return empty array for player with no NFTs', async function () {
      const tokens = await nft.getPlayerAchievements(player1.address);
      expect(tokens.length).to.equal(0);
    });

    it('Should return correct token IDs for player with NFTs', async function () {
      const mintPrice = ethers.parseUnits("5", 6);
      const timestamp = Math.floor(Date.now() / 1000);

      // Mint 3 NFTs for player1
      for (let i = 0; i < 3; i++) {
        const gameId = `game-view-${i}`;
        const achievementType = i + 1; // Types 1, 2, 3
        const signature = await createSignature(signer, player1, achievementType, timestamp, gameId);
        const { v, r, s } = splitSignature(signature);

        await nft.connect(player1).claimNFT(
          achievementType, timestamp, gameId, v, r, s,
          { value: mintPrice }
        );
      }

      const tokens = await nft.getPlayerAchievements(player1.address);
      expect(tokens.length).to.equal(3);
    });
  });
});
