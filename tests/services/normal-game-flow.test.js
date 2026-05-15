const { expect } = require('chai');
const sinon = require('sinon');

describe('Normal cash game flow regressions', function () {
    let config;
    let socketModule;
    let gameFlowIntegration;
    let contractService;
    let tronService;
    let ZeroGContractService;

    beforeEach(function () {
        config = require('../../server/config');
        socketModule = require('../../server/socket');
        gameFlowIntegration = require('../../server/services/GameFlowIntegration');
        contractService = require('../../server/blockchain/ContractService');
        tronService = require('../../server/blockchain/TronService');
        ZeroGContractService = require('../../server/blockchain/ZeroGContractService');

        config.BLOCKCHAIN_ENABLED = false;
        config.ZEROG_ENABLED = false;
        config.BLOCKCHAIN_MODE = 'tron';
        config.ZEROG_PRIVATE_KEY = '';
        config.ZEROG_POKERGAME_ADDRESS = '';

        for (const table of Object.values(socketModule._test.tables)) {
            table.players = [];
            table.resetEmptyTable();
        }

        Object.keys(socketModule._test.players).forEach(key => {
            delete socketModule._test.players[key];
        });
        Object.keys(socketModule._test.delegateCache).forEach(key => {
            delete socketModule._test.delegateCache[key];
        });
        gameFlowIntegration.playerBalances.clear();
    });

    afterEach(function () {
        sinon.restore();
    });

    function createSocket(id) {
        const handlers = {};
        const emitted = [];
        return {
            id,
            connected: true,
            on: sinon.spy((event, handler) => {
                handlers[event] = handler;
            }),
            once: sinon.spy((event, handler) => {
                handlers[event] = async (payload) => {
                    delete handlers[event];
                    return handler(payload);
                };
            }),
            emit: sinon.spy((event, payload) => {
                emitted.push({ event, payload });
            }),
            broadcast: {
                emit: sinon.spy()
            },
            handlers,
            emitted
        };
    }

    function createIO(socketMap) {
        return {
            emit: sinon.spy(),
            to: sinon.stub().callsFake((socketId) => ({
                emit: sinon.spy((event, payload) => {
                    socketMap.get(socketId)?.emit(event, payload);
                })
            })),
            sockets: {
                sockets: socketMap
            }
        };
    }

    function waitFor(predicate, timeoutMs = 8000, intervalMs = 50) {
        const startedAt = Date.now();
        return new Promise((resolve, reject) => {
            const tick = () => {
                if (predicate()) return resolve();
                if (Date.now() - startedAt >= timeoutMs) {
                    return reject(new Error('Timed out waiting for condition'));
                }
                setTimeout(tick, intervalMs);
            };
            tick();
        });
    }

    it('starts a second hand after a completed first hand', async function () {
        const socketMap = new Map();
        const socket1 = createSocket('socket-1');
        const socket2 = createSocket('socket-2');
        socketMap.set(socket1.id, socket1);
        socketMap.set(socket2.id, socket2);
        const io = createIO(socketMap);

        socketModule.init(socket1, io);
        socketModule.init(socket2, io);

        await socket1.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: '0x1111111111111111111111111111111111111111',
            username: 'player1',
            gameId: '1'
        });
        await socket2.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: '0x2222222222222222222222222222222222222222',
            username: 'player2',
            gameId: '1'
        });

        const table = socketModule._test.tables[1];
        table.addPlayer(socketModule._test.players[socket1.id]);
        table.addPlayer(socketModule._test.players[socket2.id]);
        table.sitPlayer(socketModule._test.players[socket1.id], 1, 100000000);
        table.sitPlayer(socketModule._test.players[socket2.id], 2, 100000000);
        table.startHand();

        table.winMessages = ['player1 wins $1000000.00'];
        table.wentToShowdown = true;
        table.endHand();

        await socket1.handlers.CS_CHECK(1);
        await waitFor(() => table.handOver === false && table.board.length === 0 && table.deck);

        expect(table.activePlayers()).to.have.length(2);
        expect(table.seats[1].hand).to.have.length(2);
        expect(table.seats[2].hand).to.have.length(2);
    });

    it('updates cache and player bankroll after delegated TRON leave', async function () {
        config.BLOCKCHAIN_ENABLED = true;

        sinon.stub(tronService, 'getSignerAddress').returns('TServerDelegate1111111111111111111');
        sinon.stub(contractService, 'isAuthorizedDelegate').resolves(true);
        sinon.stub(contractService, 'leaveTableFor').resolves({ tx: '0xleave' });

        const socketMap = new Map();
        const socket = createSocket('socket-leave');
        socketMap.set(socket.id, socket);
        const io = createIO(socketMap);

        socketModule.init(socket, io);
        await socket.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: 'TPlayerAddress111111111111111111111',
            username: 'tron',
            gameId: '1'
        });

        const table = socketModule._test.tables[1];
        const player = socketModule._test.players[socket.id];
        player.bankroll = 0;
        table.addPlayer(player);
        table.sitPlayer(player, 1, 100000000);
        table.seats[1].stack = 42000000;

        gameFlowIntegration.setPlayerBalanceCache(player.id, 0, 100000000);

        await socket.handlers.CS_LEAVE_TABLE_BLOCKCHAIN({ tableId: 1 });

        const cache = gameFlowIntegration.getPlayerBalanceCache(player.id);
        expect(cache.balance).to.equal(42000000);
        expect(cache.lockedAmount).to.equal(0);
        expect(player.bankroll).to.equal(42000000);
        expect(socket.emit.calledWith('SC_TABLE_LEFT')).to.equal(true);
        expect(socket.emitted.some(item => item.event === 'SC_BALANCE_SYNCED')).to.equal(true);
    });

    it('converts normal-game 0G buy-in and stack values from SUN to wei', function () {
        expect(socketModule._test.sunToZeroGWei(100000000).toString())
            .to.equal('100000000000000000');
        expect(socketModule._test.sunToZeroGWei(42000000).toString())
            .to.equal('42000000000000000');
    });

    it('supports 0G normal-game join, leave, and rejoin without losing balance or authorization', async function () {
        config.BLOCKCHAIN_ENABLED = true;
        config.ZEROG_ENABLED = true;
        config.BLOCKCHAIN_MODE = '0g';
        config.ZEROG_PRIVATE_KEY = '0x' + '11'.repeat(32);
        config.ZEROG_POKERGAME_ADDRESS = '0x' + '22'.repeat(20);

        const playerAddress = '0x3333333333333333333333333333333333333333';
        const serverAddress = '0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A';
        const buyInSun = 100000000;
        const buyInWei = socketModule._test.sunToZeroGWei(buyInSun);
        const chainState = {
            custody: buyInWei,
            locked: 0n
        };

        sinon.stub(tronService, 'getSignerAddress').throws(new Error('TRON signer not initialized'));
        sinon.stub(ZeroGContractService.prototype, 'connectPokerGame').callsFake(function () {
            this.pokerGameContract = {};
        });
        sinon.stub(ZeroGContractService.prototype, 'connectINFT').callsFake(function () {
            this.inftContract = {};
        });
        sinon.stub(ZeroGContractService.prototype, 'isAuthorizedDelegate')
            .callsFake(async (player, delegate) => player.toLowerCase() === playerAddress && delegate.toLowerCase() === serverAddress.toLowerCase());
        sinon.stub(ZeroGContractService.prototype, 'joinTableFor')
            .callsFake(async (player, tableId, amountWei) => {
                expect(player.toLowerCase()).to.equal(playerAddress);
                expect(tableId).to.equal(1);
                expect(BigInt(amountWei)).to.equal(buyInWei);
                if (chainState.custody < buyInWei) throw new Error('Insufficient custody balance');
                chainState.custody -= buyInWei;
                chainState.locked += buyInWei;
                return { hash: `0xjoin${Date.now()}` };
            });
        sinon.stub(ZeroGContractService.prototype, 'leaveTableFor')
            .callsFake(async (player, tableId, finalStackWei) => {
                expect(player.toLowerCase()).to.equal(playerAddress);
                expect(tableId).to.equal(1);
                expect(BigInt(finalStackWei)).to.equal(buyInWei);
                chainState.locked -= buyInWei;
                chainState.custody += BigInt(finalStackWei);
                return { hash: '0xleave' };
            });
        sinon.stub(ZeroGContractService.prototype, 'getCustodyBalance')
            .callsFake(async () => chainState.custody.toString());
        sinon.stub(ZeroGContractService.prototype, 'getLockedBalance')
            .callsFake(async () => chainState.locked.toString());

        const socketMap = new Map();
        const socket = createSocket('socket-0g');
        socketMap.set(socket.id, socket);
        const io = createIO(socketMap);

        socketModule.init(socket, io);
        await socket.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: playerAddress,
            username: 'zerog',
            gameId: '1'
        });

        gameFlowIntegration.setPlayerBalanceCache(playerAddress, Number(buyInWei), 0, {
            rawBalanceWei: buyInWei.toString(),
            rawLockedWei: '0',
            chain: '0G',
            source: 'test-initial-0g'
        });
        socketModule._test.players[socket.id].bankroll = Number(buyInWei);

        await socket.handlers.CS_CHECK_DELEGATE({ walletAddress: playerAddress });
        expect(socket.emitted.some(item => item.event === 'SC_DELEGATE_STATUS' && item.payload.isAuthorized)).to.equal(true);

        await socket.handlers.CS_JOIN_TABLE_BLOCKCHAIN({ tableId: 1, buyInAmount: buyInSun });

        const table = socketModule._test.tables[1];
        expect(table.seats[1]?.player?.id).to.equal(playerAddress);
        let cache = gameFlowIntegration.getPlayerBalanceCache(playerAddress);
        expect(cache.rawBalanceWei).to.equal('0');
        expect(cache.rawLockedWei).to.equal(buyInWei.toString());
        expect(socket.emitted.some(item => item.event === 'SC_BLOCKCHAIN_ERROR')).to.equal(false);
        expect(socket.emitted.some(item => item.event === 'SC_DELEGATE_ERROR')).to.equal(false);

        await socket.handlers.CS_LEAVE_TABLE_BLOCKCHAIN({ tableId: 1 });

        expect(table.seats[1]).to.equal(null);
        cache = gameFlowIntegration.getPlayerBalanceCache(playerAddress);
        expect(cache.rawBalanceWei).to.equal(buyInWei.toString());
        expect(cache.rawLockedWei).to.equal('0');
        expect(socket.emitted.some(item => item.event === 'SC_BALANCE_SYNCED' && item.payload.reason === 'leave_table_zerog')).to.equal(true);

        await socket.handlers.CS_JOIN_TABLE_BLOCKCHAIN({ tableId: 1, buyInAmount: buyInSun });

        expect(table.seats[1]?.player?.id).to.equal(playerAddress);
        cache = gameFlowIntegration.getPlayerBalanceCache(playerAddress);
        expect(cache.rawBalanceWei).to.equal('0');
        expect(cache.rawLockedWei).to.equal(buyInWei.toString());
        expect(ZeroGContractService.prototype.joinTableFor.callCount).to.equal(2);
        expect(ZeroGContractService.prototype.leaveTableFor.callCount).to.equal(1);
        expect(socket.emitted.some(item => item.event === 'SC_DELEGATE_ERROR')).to.equal(false);
    });

    it('restores a 0G normal-game table when the contract session is already active', async function () {
        config.BLOCKCHAIN_ENABLED = true;
        config.ZEROG_ENABLED = true;
        config.BLOCKCHAIN_MODE = '0g';
        config.ZEROG_PRIVATE_KEY = '0x' + '11'.repeat(32);
        config.ZEROG_POKERGAME_ADDRESS = '0x' + '22'.repeat(20);

        const playerAddress = '0x4444444444444444444444444444444444444444';
        const serverAddress = '0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A';
        const buyInSun = 100000000;
        const buyInWei = socketModule._test.sunToZeroGWei(buyInSun);
        const chainState = {
            custody: 0n,
            locked: buyInWei
        };

        sinon.stub(tronService, 'getSignerAddress').throws(new Error('TRON signer not initialized'));
        sinon.stub(ZeroGContractService.prototype, 'connectPokerGame').callsFake(function () {
            this.pokerGameContract = {};
        });
        sinon.stub(ZeroGContractService.prototype, 'connectINFT').callsFake(function () {
            this.inftContract = {};
        });
        sinon.stub(ZeroGContractService.prototype, 'isAuthorizedDelegate')
            .callsFake(async (player, delegate) => player.toLowerCase() === playerAddress && delegate.toLowerCase() === serverAddress.toLowerCase());
        sinon.stub(ZeroGContractService.prototype, 'getTableSession')
            .resolves({ buyIn: buyInWei.toString(), active: true });
        sinon.stub(ZeroGContractService.prototype, 'joinTableFor')
            .rejects(new Error('joinTableFor should not be called for active sessions'));
        sinon.stub(ZeroGContractService.prototype, 'getCustodyBalance')
            .callsFake(async () => chainState.custody.toString());
        sinon.stub(ZeroGContractService.prototype, 'getLockedBalance')
            .callsFake(async () => chainState.locked.toString());

        const socketMap = new Map();
        const socket = createSocket('socket-0g-restore');
        socketMap.set(socket.id, socket);
        const io = createIO(socketMap);

        socketModule.init(socket, io);
        await socket.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: playerAddress,
            username: 'restore',
            gameId: '1'
        });

        gameFlowIntegration.setPlayerBalanceCache(playerAddress, 0, Number(buyInWei), {
            rawBalanceWei: '0',
            rawLockedWei: buyInWei.toString(),
            chain: '0G',
            source: 'test-active-session'
        });
        socketModule._test.players[socket.id].bankroll = 0;

        await socket.handlers.CS_JOIN_TABLE_BLOCKCHAIN({ tableId: 1, buyInAmount: buyInSun });

        const table = socketModule._test.tables[1];
        expect(table.seats[1]?.player?.id).to.equal(playerAddress);
        expect(table.seats[1]?.stack).to.equal(buyInSun);
        expect(ZeroGContractService.prototype.joinTableFor.callCount).to.equal(0);
        expect(socket.emitted.some(item => item.event === 'SC_TABLE_JOINED' && item.payload.restored === true)).to.equal(true);
        expect(socket.emitted.some(item => item.event === 'SC_BLOCKCHAIN_ERROR')).to.equal(false);
    });
});
