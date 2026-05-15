const assert = require('assert');
const hre = require('hardhat');
const ethers = require('ethers6');

describe('PokerGame0G cash game settlement', function () {
  it('allows a winning player to leave with a final stack above buy-in and collects rake', async function () {
    const provider = new ethers.BrowserProvider(hre.network.provider);
    const [ownerAddress, playerAddress, feeRecipientAddress] = await provider.send('eth_accounts', []);
    const owner = await provider.getSigner(ownerAddress);
    const player = await provider.getSigner(playerAddress);
    const artifact = require('../../artifacts/contracts/0g/PokerGame0G.sol/PokerGame0G.json');
    const PokerGame0G = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
    const game = await PokerGame0G.deploy(feeRecipientAddress);
    await game.waitForDeployment();

    const buyIn = ethers.parseEther('0.1');
    const finalStack = ethers.parseEther('0.15');
    const expectedRake = ethers.parseEther('0.0025');
    const expectedNetStack = finalStack - expectedRake;

    await game.connect(player).deposit({ value: buyIn });
    await game.joinTableFor(playerAddress, 1, buyIn);

    const receipt = await (await game.leaveTableFor(playerAddress, 1, finalStack)).wait();
    const rakeLog = receipt.logs
      .map(log => {
        try { return game.interface.parseLog(log); } catch { return null; }
      })
      .find(log => log?.name === 'RakeCollected');

    assert.ok(rakeLog, 'RakeCollected event should be emitted');
    assert.strictEqual(rakeLog.args[0], 1n);
    assert.strictEqual(rakeLog.args[1].toLowerCase(), playerAddress.toLowerCase());
    assert.strictEqual(rakeLog.args[2], expectedRake);

    assert.strictEqual(await game.getCustodyBalance(playerAddress), expectedNetStack);
    assert.strictEqual(await game.getLockedBalance(playerAddress), 0n);
    assert.strictEqual(await game.getCustodyBalance(feeRecipientAddress), expectedRake);

    const session = await game.getTableSession(1, playerAddress);
    assert.strictEqual(session.active, false);
    assert.strictEqual(session.buyIn, 0n);
  });
});
