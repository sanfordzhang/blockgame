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
        Object.keys(socketModule._test.lobbySessionVersions).forEach(key => {
            delete socketModule._test.lobbySessionVersions[key];
        });
        socketModule._test.cashDisconnectCleanupInProgress.clear();
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

    function stubZeroGContractInit() {
        sinon.stub(tronService, 'getSignerAddress').throws(new Error('TRON signer not initialized'));
        sinon.stub(ZeroGContractService.prototype, 'connectPokerGame').callsFake(function () {
            this.pokerGameContract = {};
        });
        sinon.stub(ZeroGContractService.prototype, 'connectINFT').callsFake(function () {
            this.inftContract = {};
        });
    }

    async function createConnectedZeroGSocket({ socketId = 'socket-0g', playerAddress, username = 'zerog' }) {
        const socketMap = new Map();
        const socket = createSocket(socketId);
        socketMap.set(socket.id, socket);
        const io = createIO(socketMap);

        socketModule.init(socket, io);
        await socket.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: playerAddress,
            username,
            gameId: '1'
        });

        return { socket, socketMap, io };
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

    it('removes normal cash-game seats when the socket disconnects directly', async function () {
        const socketMap = new Map();
        const socket = createSocket('socket-disconnect');
        socketMap.set(socket.id, socket);
        const io = createIO(socketMap);

        socketModule.init(socket, io);
        await socket.handlers.CS_FETCH_LOBBY_INFO({
            walletAddress: 'TDisconnectPlayer1111111111111111',
            username: 'disconnect',
            gameId: '1'
        });

        const table = socketModule._test.tables[1];
        const player = socketModule._test.players[socket.id];
        table.addPlayer(player);
        table.sitPlayer(player, 1, 100000000);

        socket.connected = false;
        await socket.handlers.disconnect('transport close');

        expect(table.seats[1]).to.equal(null);
        expect(table.players).to.have.length(0);
        expect(socketModule._test.players[socket.id]).to.equal(undefined);
        expect(io.emit.calledWith('SC_TABLES_UPDATED')).to.equal(true);
    });

    it('converts normal-game 0G buy-in and stack values from SUN to wei', function () {
        expect(socketModule._test.sunToZeroGWei(100000000).toString())
            .to.equal('100000000000000000');
        expect(socketModule._test.sunToZeroGWei(42000000).toString())
            .to.equal('42000000000000000');
    });

    it('accepts a 0G join when the receipt lookup is transient but the table session is active', async function () {
        const service = new ZeroGContractService();
        const playerAddress = '0x3333333333333333333333333333333333333333';
        const buyInWei = socketModule._test.sunToZeroGWei(100000000);
        const transientReceiptError = new Error('no matching receipts found: this may indicate potential data corruption');
        transientReceiptError.code = 'UNKNOWN_ERROR';

        service.zeroGService = {
            provider: {
                getTransactionReceipt: sinon.stub().resolves(null)
            }
        };
        service.pokerGameContract = {
            joinTableFor: sinon.stub().resolves({
                hash: '0xjoin',
                wait: sinon.stub().rejects(transientReceiptError)
            }),
            getTableSession: sinon.stub().resolves({
                buyIn: buyInWei.toString(),
                active: true
            })
        };

        const receipt = await service.joinTableFor(playerAddress, 1, buyInWei);

        expect(receipt.hash).to.equal('0xjoin');
        expect(receipt.confirmedByState).to.equal(true);
    });

    it('accepts a 0G leave when the receipt lookup is transient but the table session is closed', async function () {
        const service = new ZeroGContractService();
        const playerAddress = '0x3333333333333333333333333333333333333333';
        const finalStackWei = socketModule._test.sunToZeroGWei(100000000);
        const transientReceiptError = new Error('no matching receipts found: this may indicate potential data corruption');
        transientReceiptError.code = 'UNKNOWN_ERROR';

        service.zeroGService = {
            provider: {
                getTransactionReceipt: sinon.stub().resolves(null)
            }
        };
        service.pokerGameContract = {
            leaveTableFor: sinon.stub().resolves({
                hash: '0xleave',
                wait: sinon.stub().rejects(transientReceiptError)
            }),
            getTableSession: sinon.stub().resolves({
                buyIn: '0',
                active: false
            })
        };

        const receipt = await service.leaveTableFor(playerAddress, 1, finalStackWei);

        expect(receipt.hash).to.equal('0xleave');
        expect(receipt.confirmedByState).to.equal(true);
    });

    it('settles a 0G join that completes after the socket has already disconnected', async function () {
        config.BLOCKCHAIN_ENABLED = true;
        config.ZEROG_ENABLED = true;
        config.BLOCKCHAIN_MODE = '0g';
        config.ZEROG_PRIVATE_KEY = '0x' + '11'.repeat(32);
        config.ZEROG_POKERGAME_ADDRESS = '0x' + '22'.repeat(20);

        const playerAddress = '0x9999999999999999999999999999999999999999';
        const serverAddress = '0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A';
        const buyInSun = 100000000;
        const buyInWei = socketModule._test.sunToZeroGWei(buyInSun);
        const chainState = {
            custody: buyInWei,
            locked: 0n,
            active: false
        };
        let socketRef;

        stubZeroGContractInit();
        sinon.stub(ZeroGContractService.prototype, 'isAuthorizedDelegate')
            .callsFake(async (player, delegate) => player.toLowerCase() === playerAddress && delegate.toLowerCase() === serverAddress.toLowerCase());
        sinon.stub(ZeroGContractService.prototype, 'getTableSession')
            .callsFake(async () => ({
                buyIn: chainState.active ? buyInWei.toString() : '0',
                active: chainState.active
            }));
        sinon.stub(ZeroGContractService.prototype, 'joinTableFor')
            .callsFake(async () => {
                chainState.custody -= buyInWei;
                chainState.locked += buyInWei;
                chainState.active = true;
                socketRef.connected = false;
                return { hash: '0xlatejoin' };
            });
        const leaveStub = sinon.stub(ZeroGContractService.prototype, 'leaveTableFor')
            .callsFake(async (_player, _tableId, finalStackWei) => {
                expect(BigInt(finalStackWei)).to.equal(buyInWei);
                chainState.locked -= buyInWei;
                chainState.custody += BigInt(finalStackWei);
                chainState.active = false;
                return { hash: '0xlateleave' };
            });
        sinon.stub(ZeroGContractService.prototype, 'getCustodyBalance')
            .callsFake(async () => chainState.custody.toString());
        sinon.stub(ZeroGContractService.prototype, 'getLockedBalance')
            .callsFake(async () => chainState.locked.toString());

        const { socket } = await createConnectedZeroGSocket({ socketId: 'socket-0g-late-join', playerAddress, username: 'late' });
        socketRef = socket;
        gameFlowIntegration.setPlayerBalanceCache(playerAddress, Number(buyInWei), 0, {
            rawBalanceWei: buyInWei.toString(),
            rawLockedWei: '0',
            chain: '0G',
            source: 'test-late-join'
        });
        socketModule._test.players[socket.id].bankroll = Number(buyInWei);

        await socket.handlers.CS_JOIN_TABLE_BLOCKCHAIN({ tableId: 1, buyInAmount: buyInSun });

        const table = socketModule._test.tables[1];
        expect(leaveStub.calledOnce).to.equal(true);
        expect(table.players).to.have.length(0);
        expect(Object.values(table.seats).filter(Boolean)).to.have.length(0);
        expect(socketModule._test.players[socket.id]).to.equal(undefined);
        expect(socket.emitted.some(item => item.event === 'SC_TABLE_JOINED')).to.equal(false);
        const cache = gameFlowIntegration.getPlayerBalanceCache(playerAddress);
        expect(cache.rawBalanceWei).to.equal(buyInWei.toString());
        expect(cache.rawLockedWei).to.equal('0');
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
            locked: 0n,
            active: false
        };

        stubZeroGContractInit();
        sinon.stub(ZeroGContractService.prototype, 'getTableSession')
            .callsFake(async () => ({
                buyIn: chainState.active ? buyInWei.toString() : '0',
                active: chainState.active
            }));
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
                chainState.active = true;
                return { hash: `0xjoin${Date.now()}` };
            });
        sinon.stub(ZeroGContractService.prototype, 'leaveTableFor')
            .callsFake(async (player, tableId, finalStackWei) => {
                expect(player.toLowerCase()).to.equal(playerAddress);
                expect(tableId).to.equal(1);
                expect(BigInt(finalStackWei)).to.equal(buyInWei);
                chainState.locked -= buyInWei;
                chainState.custody += BigInt(finalStackWei);
                chainState.active = false;
                return { hash: '0xleave' };
            });
        sinon.stub(ZeroGContractService.prototype, 'getCustodyBalance')
            .callsFake(async () => chainState.custody.toString());
        sinon.stub(ZeroGContractService.prototype, 'getLockedBalance')
            .callsFake(async () => chainState.locked.toString());

        const { socket } = await createConnectedZeroGSocket({ socketId: 'socket-0g', playerAddress });

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

        stubZeroGContractInit();
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

        const { socket } = await createConnectedZeroGSocket({ socketId: 'socket-0g-restore', playerAddress, username: 'restore' });

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

    it('settles an unstarted restored 0G session with the on-chain buy-in instead of stale local stack', async function () {
        config.BLOCKCHAIN_ENABLED = true;
        config.ZEROG_ENABLED = true;
        config.BLOCKCHAIN_MODE = '0g';
        config.ZEROG_PRIVATE_KEY = '0x' + '11'.repeat(32);
        config.ZEROG_POKERGAME_ADDRESS = '0x' + '22'.repeat(20);

        const playerAddress = '0x5555555555555555555555555555555555555555';
        const serverAddress = '0x19E7E376E7C213B7E7E7E46CC70A5DD086DAFF2A';
        const buyInSun = 100000000;
        const buyInWei = socketModule._test.sunToZeroGWei(buyInSun);
        const staleStackWei = socketModule._test.sunToZeroGWei(250000000);
        const chainState = {
            custody: 0n,
            locked: buyInWei,
            active: true
        };

        stubZeroGContractInit();
        sinon.stub(ZeroGContractService.prototype, 'isAuthorizedDelegate').resolves(true);
        sinon.stub(ZeroGContractService.prototype, 'getTableSession')
            .callsFake(async () => ({ buyIn: buyInWei.toString(), active: chainState.active }));
        const leaveStub = sinon.stub(ZeroGContractService.prototype, 'leaveTableFor')
            .callsFake(async (player, tableId, finalStackWei) => {
                expect(player.toLowerCase()).to.equal(playerAddress);
                expect(tableId).to.equal(1);
                expect(BigInt(finalStackWei)).to.equal(buyInWei);
                expect(BigInt(finalStackWei)).to.not.equal(staleStackWei);
                chainState.locked -= buyInWei;
                chainState.custody += BigInt(finalStackWei);
                chainState.active = false;
                return { hash: '0xleave-buyin' };
            });
        sinon.stub(ZeroGContractService.prototype, 'getCustodyBalance')
            .callsFake(async () => chainState.custody.toString());
        sinon.stub(ZeroGContractService.prototype, 'getLockedBalance')
            .callsFake(async () => chainState.locked.toString());

        const { socket } = await createConnectedZeroGSocket({ socketId: 'socket-0g-stale-leave', playerAddress });
        const table = socketModule._test.tables[1];
        const player = socketModule._test.players[socket.id];
        table.addPlayer(player);
        table.sitPlayer(player, 1, buyInSun);
        table.seats[1].stack = 250000000;

        await socket.handlers.CS_LEAVE_TABLE_BLOCKCHAIN({ tableId: 1 });

        expect(leaveStub.calledOnce).to.equal(true);
        expect(chainState.custody).to.equal(buyInWei);
        expect(chainState.locked).to.equal(0n);
        const balanceSync = socket.emitted.find(item => item.event === 'SC_BALANCE_SYNCED' && item.payload.reason === 'leave_table_zerog');
        expect(balanceSync.payload.balance).to.equal(buyInWei.toString());
        expect(balanceSync.payload.locked).to.equal('0');
    });

    it('can leave an active 0G contract session even when the local seat is missing', async function () {
        config.BLOCKCHAIN_ENABLED = true;
        config.ZEROG_ENABLED = true;
        config.BLOCKCHAIN_MODE = '0g';
        config.ZEROG_PRIVATE_KEY = '0x' + '11'.repeat(32);
        config.ZEROG_POKERGAME_ADDRESS = '0x' + '22'.repeat(20);

        const playerAddress = '0x6666666666666666666666666666666666666666';
        const buyInWei = socketModule._test.sunToZeroGWei(100000000);
        const chainState = {
            custody: 0n,
            locked: buyInWei,
            active: true
        };

        stubZeroGContractInit();
        sinon.stub(ZeroGContractService.prototype, 'isAuthorizedDelegate').resolves(true);
        sinon.stub(ZeroGContractService.prototype, 'getTableSession')
            .callsFake(async () => ({ buyIn: buyInWei.toString(), active: chainState.active }));
        const leaveStub = sinon.stub(ZeroGContractService.prototype, 'leaveTableFor')
            .callsFake(async (_player, _tableId, finalStackWei) => {
                expect(BigInt(finalStackWei)).to.equal(buyInWei);
                chainState.locked = 0n;
                chainState.custody = BigInt(finalStackWei);
                chainState.active = false;
                return { hash: '0xleave-missing-seat' };
            });
        sinon.stub(ZeroGContractService.prototype, 'getCustodyBalance')
            .callsFake(async () => chainState.custody.toString());
        sinon.stub(ZeroGContractService.prototype, 'getLockedBalance')
            .callsFake(async () => chainState.locked.toString());

        const { socket } = await createConnectedZeroGSocket({ socketId: 'socket-0g-missing-seat', playerAddress });

        await socket.handlers.CS_LEAVE_TABLE_BLOCKCHAIN({ tableId: 1 });

        expect(leaveStub.calledOnce).to.equal(true);
        expect(socket.emitted.some(item => item.event === 'SC_TABLE_LEFT')).to.equal(true);
        const balanceSync = socket.emitted.find(item => item.event === 'SC_BALANCE_SYNCED' && item.payload.reason === 'leave_table_zerog');
        expect(balanceSync.payload.total).to.equal(buyInWei.toString());
    });

    it('does not inflate 0G wei balance cache when a hand winner is processed', async function () {
        config.BLOCKCHAIN_ENABLED = true;
        config.ZEROG_ENABLED = true;
        config.BLOCKCHAIN_MODE = '0g';

        const player1Address = '0x7777777777777777777777777777777777777777';
        const player2Address = '0x8888888888888888888888888888888888888888';
        const buyInWei = socketModule._test.sunToZeroGWei(100000000);

        const socketMap = new Map();
        const socket1 = createSocket('socket-0g-winner-1');
        const socket2 = createSocket('socket-0g-winner-2');
        socketMap.set(socket1.id, socket1);
        socketMap.set(socket2.id, socket2);
        const io = createIO(socketMap);

        socketModule.init(socket1, io);
        socketModule.init(socket2, io);
        await socket1.handlers.CS_FETCH_LOBBY_INFO({ walletAddress: player1Address, username: 'winner', gameId: '1' });
        await socket2.handlers.CS_FETCH_LOBBY_INFO({ walletAddress: player2Address, username: 'loser', gameId: '1' });

        const table = socketModule._test.tables[1];
        table.addPlayer(socketModule._test.players[socket1.id]);
        table.addPlayer(socketModule._test.players[socket2.id]);
        table.sitPlayer(socketModule._test.players[socket1.id], 1, 100000000);
        table.sitPlayer(socketModule._test.players[socket2.id], 2, 100000000);
        table.startHand();

        gameFlowIntegration.setPlayerBalanceCache(player1Address, 0, Number(buyInWei), {
            rawBalanceWei: '0',
            rawLockedWei: buyInWei.toString(),
            chain: '0G',
            source: 'test-winner-cache'
        });

        table.winMessages = ['winner wins $1000000.00'];
        table.endHand();
        await socket1.handlers.CS_CHECK(1);
        await waitFor(() => socket1.emitted.some(item => item.event === 'SC_BALANCE_SYNCED' && item.payload.reason === 'game_won'));

        const cache = gameFlowIntegration.getPlayerBalanceCache(player1Address);
        expect(cache.rawBalanceWei).to.equal('0');
        expect(cache.rawLockedWei).to.equal(buyInWei.toString());
    });

    it('does not award the pot twice when endWithoutShowdown is called repeatedly', function () {
        const table = socketModule._test.tables[1];
        const player1 = { id: 'p1', socketId: 's1', name: 'p1' };
        const player2 = { id: 'p2', socketId: 's2', name: 'p2' };

        table.addPlayer(player1);
        table.addPlayer(player2);
        table.sitPlayer(player1, 1, 100000000);
        table.sitPlayer(player2, 2, 100000000);
        table.startHand();
        table.pot = 3000000;
        table.seats[2].folded = true;

        const before = table.seats[1].stack;
        table.endWithoutShowdown();
        table.endWithoutShowdown();

        expect(table.seats[1].stack).to.equal(before + 3000000);
        expect(table.winMessages).to.have.length(1);
    });
});
