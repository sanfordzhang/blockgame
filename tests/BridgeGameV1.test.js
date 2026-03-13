/**
 * BridgeGameV1 Contract Tests
 * Run with: tronbox test
 */

const BridgeGameV1 = artifacts.require("BridgeGameV1");

contract("BridgeGameV1", accounts => {
  const owner = accounts[0];
  const player1 = accounts[1];
  const player2 = accounts[2];
  
  let instance;
  
  beforeEach(async () => {
    instance = await BridgeGameV1.new({ from: owner });
  });
  
  describe("Initialization", () => {
    it("should set correct owner", async () => {
      const contractOwner = await instance.owner();
      assert.equal(contractOwner, owner, "Owner not set correctly");
    });
    
    it("should have default rake rate of 2.5%", async () => {
      const rakeRate = await instance.rakeRate();
      assert.equal(rakeRate.toNumber(), 250, "Default rake rate should be 250 basis points");
    });
    
    it("should not be paused initially", async () => {
      const paused = await instance.paused();
      assert.equal(paused, false, "Contract should not be paused initially");
    });
  });
  
  describe("Player Registration", () => {
    it("should register a new player", async () => {
      await instance.registerPlayer({ from: player1 });
      const isRegistered = await instance.isPlayerRegistered(player1);
      assert.equal(isRegistered, true, "Player should be registered");
    });
    
    it("should not allow duplicate registration", async () => {
      await instance.registerPlayer({ from: player1 });
      try {
        await instance.registerPlayer({ from: player1 });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Already registered");
      }
    });
  });
  
  describe("Deposits", () => {
    beforeEach(async () => {
      await instance.registerPlayer({ from: player1 });
    });
    
    it("should accept deposit within limits", async () => {
      const depositAmount = 100 * 1e6; // 100 TRX in SUN
      await instance.deposit({
        from: player1,
        value: depositAmount
      });
      
      const player = await instance.players(player1);
      assert.equal(player.balance.toNumber(), depositAmount, "Balance should match deposit");
    });
    
    it("should reject deposit below minimum", async () => {
      const smallAmount = 5 * 1e6; // 5 TRX (below 10 TRX minimum)
      try {
        await instance.deposit({
          from: player1,
          value: smallAmount
        });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Below minimum");
      }
    });
    
    it("should reject deposit above maximum", async () => {
      const largeAmount = 100001 * 1e6; // 100,001 TRX (above 100,000 TRX maximum)
      try {
        await instance.deposit({
          from: player1,
          value: largeAmount
        });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Above maximum");
      }
    });
  });
  
  describe("Withdrawals", () => {
    beforeEach(async () => {
      await instance.registerPlayer({ from: player1 });
      await instance.deposit({
        from: player1,
        value: 100 * 1e6
      });
    });
    
    it("should allow withdrawal of available balance", async () => {
      const withdrawAmount = 50 * 1e6;
      await instance.withdraw(withdrawAmount, { from: player1 });
      
      const player = await instance.players(player1);
      assert.equal(player.balance.toNumber(), 50 * 1e6, "Balance should be reduced");
    });
    
    it("should not allow withdrawal exceeding balance", async () => {
      try {
        await instance.withdraw(200 * 1e6, { from: player1 });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Insufficient balance");
      }
    });
    
    it("should not allow withdrawal of locked funds", async () => {
      // Lock some funds by joining a table
      await instance.joinTable(1, { from: player1 });
      
      try {
        await instance.withdraw(100 * 1e6, { from: player1 });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Insufficient balance");
      }
    });
  });
  
  describe("Game Operations", () => {
    beforeEach(async () => {
      await instance.registerPlayer({ from: player1 });
      await instance.registerPlayer({ from: player2 });
      await instance.deposit({ from: player1, value: 100 * 1e6 });
      await instance.deposit({ from: player2, value: 100 * 1e6 });
    });
    
    it("should lock funds when joining table", async () => {
      await instance.joinTable(1, { from: player1 });
      
      const player = await instance.players(player1);
      assert.equal(player.lockedBalance.toNumber(), 50 * 1e6, "Funds should be locked");
      assert.equal(player.currentTable.toNumber(), 1, "Table ID should be set");
    });
    
    it("should unlock funds when leaving table", async () => {
      await instance.joinTable(1, { from: player1 });
      await instance.leaveTable({ from: player1 });
      
      const player = await instance.players(player1);
      assert.equal(player.lockedBalance.toNumber(), 0, "Funds should be unlocked");
      assert.equal(player.currentTable.toNumber(), 0, "Table ID should be cleared");
    });
  });
  
  describe("Rake Rate Management", () => {
    it("should allow owner to initiate rate change", async () => {
      await instance.setRakeRate(300, { from: owner });
      const pendingRate = await instance.pendingRakeRate();
      assert.equal(pendingRate.toNumber(), 300, "Pending rate should be set");
    });
    
    it("should reject rate change outside bounds", async () => {
      try {
        await instance.setRakeRate(50, { from: owner }); // Below 1%
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Below minimum");
      }
      
      try {
        await instance.setRakeRate(1500, { from: owner }); // Above 10%
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Above maximum");
      }
    });
    
    it("should reject rate change exceeding max adjustment", async () => {
      try {
        await instance.setRakeRate(500, { from: owner }); // 2.5% -> 5% is 2.5% change
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "exceeds maximum");
      }
    });
  });
  
  describe("Emergency Controls", () => {
    it("should allow owner to pause", async () => {
      await instance.pause({ from: owner });
      const paused = await instance.paused();
      assert.equal(paused, true, "Contract should be paused");
    });
    
    it("should allow owner to unpause", async () => {
      await instance.pause({ from: owner });
      await instance.unpause({ from: owner });
      const paused = await instance.paused();
      assert.equal(paused, false, "Contract should be unpaused");
    });
    
    it("should block operations when paused", async () => {
      await instance.registerPlayer({ from: player1 });
      await instance.pause({ from: owner });
      
      try {
        await instance.deposit({ from: player1, value: 100 * 1e6 });
        assert.fail("Should have thrown error");
      } catch (error) {
        assert.include(error.message, "Pausable: paused");
      }
    });
  });
});
