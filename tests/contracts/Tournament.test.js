const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Tournament Contract', function () {
  let Tournament;
  let tournament;
  let owner;
  let serverWallet;
  let player1;
  let player2;
  let chipToken;

  const ONE_TRX = 1e6; // 1 TRX in sun

  beforeEach(async function () {
    [owner, serverWallet, player1, player2] = await ethers.getSigners();

    // Deploy mock CHIP token
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    chipToken = await MockERC20.deploy('CHIP Token', 'CHIP', 18);

    // Deploy Tournament contract
    Tournament = await ethers.getContractFactory('Tournament');
    tournament = await Tournament.deploy(serverWallet.address, chipToken.address);
  });

  describe('Deployment', function () {
    it('Should set the correct server wallet', async function () {
      expect(await tournament.serverWallet()).to.equal(serverWallet.address);
    });

    it('Should set the correct chip token address', async function () {
      expect(await tournament.chipToken()).to.equal(chipToken.address);
    });

    it('Should initialize with default tournament configs', async function () {
      const config = await tournament.getConfig(1);
      expect(config.playerCount).to.equal(2);
      expect(config.buyIn).to.equal(100 * ONE_TRX);
    });
  });

  describe('Tournament Creation', function () {
    it('Should create a new tournament with valid config', async function () {
      const tx = await tournament.connect(owner).createTournament(1, 0);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === 'TournamentCreated');
      expect(event).to.not.be.undefined;
      expect(event.args.tournamentId).to.equal(5); // After 4 default configs
    });

    it('Should fail to create tournament with invalid config', async function () {
      await expect(
        tournament.connect(owner).createTournament(999, 0)
      ).to.be.revertedWith('Tournament: invalid config id');
    });
  });

  describe('Tournament Join', function () {
    let tournamentId;

    beforeEach(async function () {
      const tx = await tournament.connect(owner).createTournament(1, 0);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'TournamentCreated');
      tournamentId = event.args.tournamentId;
    });

    it('Should allow player to join with correct buy-in', async function () {
      const buyIn = 100 * ONE_TRX;
      
      await expect(
        tournament.connect(player1).joinTournament(tournamentId, { value: buyIn })
      ).to.emit(tournament, 'PlayerJoined')
        .withArgs(tournamentId, player1.address);
    });

    it('Should fail to join with insufficient buy-in', async function () {
      const insufficientBuyIn = 50 * ONE_TRX;
      
      await expect(
        tournament.connect(player1).joinTournament(tournamentId, { value: insufficientBuyIn })
      ).to.be.revertedWith('Tournament: incorrect buy-in amount');
    });

    it('Should fail to join same tournament twice', async function () {
      const buyIn = 100 * ONE_TRX;
      
      await tournament.connect(player1).joinTournament(tournamentId, { value: buyIn });
      
      await expect(
        tournament.connect(player1).joinTournament(tournamentId, { value: buyIn })
      ).to.be.revertedWith('Tournament: already joined');
    });
  });

  describe('Tournament Cancel', function () {
    let tournamentId;

    beforeEach(async function () {
      const tx = await tournament.connect(owner).createTournament(1, 0);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'TournamentCreated');
      tournamentId = event.args.tournamentId;
      
      // Player joins
      await tournament.connect(player1).joinTournament(tournamentId, { 
        value: 100 * ONE_TRX 
      });
    });

    it('Should allow player to cancel and get refund', async function () {
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      
      const tx = await tournament.connect(player1).cancelJoin(tournamentId);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === 'PlayerCancelled');
      expect(event).to.not.be.undefined;
      
      const balanceAfter = await ethers.provider.getBalance(player1.address);
      // Balance should increase (minus gas fees)
      expect(balanceAfter).to.be.greaterThan(balanceBefore.sub(ethers.utils.parseEther('0.01')));
    });

    it('Should fail to cancel if not joined', async function () {
      await expect(
        tournament.connect(player2).cancelJoin(tournamentId)
      ).to.be.revertedWith('Tournament: not joined');
    });
  });

  describe('Tournament Start', function () {
    let tournamentId;

    beforeEach(async function () {
      const tx = await tournament.connect(owner).createTournament(1, 0);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'TournamentCreated');
      tournamentId = event.args.tournamentId;
    });

    it('Should fail to start with insufficient players', async function () {
      // Only 1 player joins
      await tournament.connect(player1).joinTournament(tournamentId, { 
        value: 100 * ONE_TRX 
      });
      
      await expect(
        tournament.connect(serverWallet).startTournament(tournamentId)
      ).to.be.revertedWith('Tournament: not enough players');
    });

    it('Should start tournament when full', async function () {
      // Both players join
      await tournament.connect(player1).joinTournament(tournamentId, { 
        value: 100 * ONE_TRX 
      });
      await tournament.connect(player2).joinTournament(tournamentId, { 
        value: 100 * ONE_TRX 
      });
      
      await expect(
        tournament.connect(serverWallet).startTournament(tournamentId)
      ).to.emit(tournament, 'TournamentStarted');
      
      const t = await tournament.getTournament(tournamentId);
      expect(t.status).to.equal(2); // IN_PROGRESS
    });
  });

  describe('Prize Distribution', function () {
    let tournamentId;

    beforeEach(async function () {
      const tx = await tournament.connect(owner).createTournament(1, 0);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'TournamentCreated');
      tournamentId = event.args.tournamentId;
      
      // Players join
      await tournament.connect(player1).joinTournament(tournamentId, { 
        value: 100 * ONE_TRX 
      });
      await tournament.connect(player2).joinTournament(tournamentId, { 
        value: 100 * ONE_TRX 
      });
      
      // Start tournament
      await tournament.connect(serverWallet).startTournament(tournamentId);
    });

    it('Should calculate correct prize amounts', async function () {
      const prizeInfo = await tournament.getPrizeInfo(tournamentId);
      
      // Total pot: 200 TRX, Rake: 5% = 10 TRX
      // Prize pool: 190 TRX
      expect(prizeInfo.totalPot).to.equal(200 * ONE_TRX);
      expect(prizeInfo.rakeAmount).to.equal(10 * ONE_TRX);
    });

    it('Should allow claiming prize after tournament ends', async function () {
      // Finish tournament with player1 as winner
      await tournament.connect(serverWallet).finishTournament(tournamentId, [
        player1.address,
        player2.address
      ]);
      
      const balanceBefore = await ethers.provider.getBalance(player1.address);
      
      await tournament.connect(player1).claimPrize(tournamentId);
      
      const balanceAfter = await ethers.provider.getBalance(player1.address);
      // Player1 should receive 70% of prize pool (133 TRX)
      expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
        ethers.BigNumber.from(133 * ONE_TRX),
        ethers.utils.parseEther('0.01') // Account for gas
      );
    });
  });
});
