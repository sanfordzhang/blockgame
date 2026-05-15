const { expect } = require('chai');
const path = require('path');
const dotenv = require('dotenv');
const ethers = require('ethers6');
const { io } = require('socket.io-client');

dotenv.config({
    path: path.resolve(__dirname, '../..', process.env.ENV_FILE || '.env.0g')
});

const actions = require('../../server/pokergame/actions');
const pokerGameArtifact = require('../../artifacts/contracts/0g/PokerGame0G.sol/PokerGame0G.json');

const SERVER_URL = process.env.E2E_SERVER_URL || `http://127.0.0.1:${process.env.SERVER_PORT || process.env.REACT_APP_SERVER_PORT || 7778}`;
const TABLE_ID = 1;
const BUY_IN_SUN = 100000000;
const WEI_PER_SUN = 1000000000n;
const BUY_IN_WEI = BigInt(BUY_IN_SUN) * WEI_PER_SUN;
const TARGET_CUSTODY = BUY_IN_WEI * 2n;
const GAS_TOP_UP = ethers.parseEther('0.03');

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function makeContract(wallet) {
    return new ethers.Contract(
        requireEnv('ZEROG_POKERGAME_ADDRESS'),
        pokerGameArtifact.abi,
        wallet
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientReceiptError(error) {
    const details = [
        error?.code,
        error?.message,
        error?.shortMessage,
        error?.error?.message,
        error?.info?.error?.message
    ].filter(Boolean).join(' ');

    return /no matching receipts found|transaction receipt.*not found|receipt.*not found|timeout|ETIMEDOUT|ECONNRESET|503/i.test(details);
}

async function waitForTx(tx, label = 'tx') {
    let lastError;
    for (let attempt = 1; attempt <= 8; attempt++) {
        try {
            return await tx.wait();
        } catch (error) {
            lastError = error;
            if (!isTransientReceiptError(error)) throw error;

            const hash = tx?.hash;
            if (hash && tx?.provider?.getTransactionReceipt) {
                try {
                    const receipt = await tx.provider.getTransactionReceipt(hash);
                    if (receipt) return receipt;
                } catch (receiptError) {
                    if (!isTransientReceiptError(receiptError)) throw receiptError;
                }
            }

            if (attempt < 8) await sleep(2500);
        }
    }
    throw new Error(`${label} receipt was not available after retries: ${lastError?.message || lastError}`);
}

function deriveSecondWalletPrivateKey() {
    return ethers.keccak256(ethers.toUtf8Bytes(`${requireEnv('ZEROG_PRIVATE_KEY')}:normal-cash-e2e-player-2`));
}

async function waitForEvent(socket, event, predicate = () => true, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out waiting for ${event}`));
        }, timeoutMs);

        const onEvent = (payload) => {
            try {
                if (!predicate(payload)) return;
                cleanup();
                resolve(payload);
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        const onError = (payload) => {
            cleanup();
            reject(new Error(`${payload?.operation || 'blockchain'} error: ${payload?.message || JSON.stringify(payload)}`));
        };

        function cleanup() {
            clearTimeout(timer);
            socket.off(event, onEvent);
            socket.off(actions.SC_BLOCKCHAIN_ERROR, onError);
            socket.off(actions.SC_DELEGATE_ERROR, onError);
        }

        socket.on(event, onEvent);
        socket.on(actions.SC_BLOCKCHAIN_ERROR, onError);
        socket.on(actions.SC_DELEGATE_ERROR, onError);
    });
}

async function connectPlayer(walletAddress, username) {
    const socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 10000
    });

    await waitForEvent(socket, 'connect', () => true, 10000);
    socket.emit(actions.CS_FETCH_LOBBY_INFO, {
        walletAddress,
        username,
        gameId: String(TABLE_ID)
    });
    await waitForEvent(socket, actions.SC_RECEIVE_LOBBY_INFO);
    return socket;
}

async function emitAndWait(socket, emitEvent, emitPayload, waitEvent, predicate, timeoutMs) {
    const waiting = waitForEvent(socket, waitEvent, predicate, timeoutMs);
    socket.emit(emitEvent, emitPayload);
    return await waiting;
}

function hasSeatedPlayer(table, address) {
    const normalized = address.toLowerCase();
    return Object.values(table.seats || {}).some((seat) =>
        seat?.player?.id?.toLowerCase() === normalized
    );
}

function getSeatByAddress(table, address) {
    const normalized = address.toLowerCase();
    return Object.values(table.seats || {}).find((seat) =>
        seat?.player?.id?.toLowerCase() === normalized
    );
}

async function waitForSeated(socket, address) {
    return await waitForEvent(socket, actions.SC_TABLE_UPDATED, ({ table }) =>
        table?.id === TABLE_ID && hasSeatedPlayer(table, address)
    );
}

async function joinTable(socket, address) {
    const joined = await emitAndWait(
        socket,
        actions.CS_JOIN_TABLE_BLOCKCHAIN,
        { tableId: TABLE_ID, buyInAmount: BUY_IN_SUN },
        actions.SC_TABLE_JOINED,
        ({ tableId }) => tableId === TABLE_ID,
        60000
    );

    const seated = await waitForSeated(socket, address);
    expect(hasSeatedPlayer(seated.table, address)).to.equal(true);
    return joined;
}

async function leaveTable(socket) {
    const balanceWait = waitForEvent(
        socket,
        actions.SC_BALANCE_SYNCED,
        (payload) => payload?.reason === 'leave_table_zerog',
        90000
    );
    const leftWait = waitForEvent(
        socket,
        actions.SC_TABLE_LEFT,
        ({ tableId }) => tableId === TABLE_ID,
        90000
    );

    socket.emit(actions.CS_LEAVE_TABLE_BLOCKCHAIN, { tableId: TABLE_ID });
    const [balance, left] = await Promise.all([balanceWait, leftWait]);
    return { balance, left };
}

async function checkDelegate(socket, player, server) {
    const status = await emitAndWait(
        socket,
        actions.CS_CHECK_DELEGATE,
        { walletAddress: player },
        actions.SC_DELEGATE_STATUS,
        (payload) => payload?.playerAddress?.toLowerCase() === player.toLowerCase(),
        30000
    );

    expect(status.isAuthorized).to.equal(true);
    expect((status.zeroGServerAddress || status.serverAddress).toLowerCase()).to.equal(server.toLowerCase());
    return status;
}

async function ensureNativeBalance(provider, funder, wallet) {
    if (wallet.address.toLowerCase() === funder.address.toLowerCase()) return;

    const balance = await provider.getBalance(wallet.address);
    if (balance >= GAS_TOP_UP) return;

    const tx = await funder.sendTransaction({
        to: wallet.address,
        value: GAS_TOP_UP - balance
    });
    await waitForTx(tx, 'native top-up');
}

async function cleanupTableSession(contract, playerAddress) {
    const [buyIn, active] = await contract.getTableSession(TABLE_ID, playerAddress);
    if (active) {
        const tx = await contract.leaveTableFor(playerAddress, TABLE_ID, buyIn);
        await waitForTx(tx, 'cleanup leaveTableFor');
    }

    const locked = await contract.getLockedBalance(playerAddress);
    if (locked > 0n) {
        const tx = await contract.forceUnlockPlayer(playerAddress);
        await waitForTx(tx, 'cleanup forceUnlockPlayer');
    }
}

async function ensureDelegate(contract, playerAddress, delegateAddress) {
    const current = await contract.isDelegateFor(playerAddress, delegateAddress);
    if (current) return;

    const tx = await contract.authorizeDelegate(delegateAddress);
    await waitForTx(tx, 'authorizeDelegate');
}

async function ensureCustodyFor(operatorContract, playerAddress, minCustody) {
    const custody = await operatorContract.getCustodyBalance(playerAddress);
    if (custody >= minCustody) return;

    const tx = await operatorContract.executeDepositFor(playerAddress, minCustody - custody, {
        value: minCustody - custody
    });
    await waitForTx(tx, 'executeDepositFor');
}

async function prepareWallet(provider, funder, wallet) {
    await ensureNativeBalance(provider, funder, wallet);
    const contract = makeContract(wallet);
    const operatorContract = makeContract(funder);

    await cleanupTableSession(operatorContract, wallet.address);
    await ensureDelegate(contract, wallet.address, funder.address);
    await ensureCustodyFor(operatorContract, wallet.address, TARGET_CUSTODY);

    return contract;
}

async function foldCurrentTurn(table, socketsByAddress) {
    const turnSeat = table.seats?.[table.turn];
    expect(turnSeat?.player?.id, 'current turn player').to.be.a('string');

    const socket = socketsByAddress.get(turnSeat.player.id.toLowerCase());
    expect(socket, `socket for ${turnSeat.player.id}`).to.exist;
    socket.emit(actions.CS_FOLD, TABLE_ID);
}

describe('0G normal cash-game live E2E', function () {
    this.timeout(240000);

    let provider;
    let serverWallet;
    let player2Wallet;

    before(async function () {
        provider = new ethers.JsonRpcProvider(requireEnv('ZEROG_RPC_URL'));
        serverWallet = new ethers.Wallet(requireEnv('ZEROG_PRIVATE_KEY'), provider);
        player2Wallet = new ethers.Wallet(deriveSecondWalletPrivateKey(), provider);

        const code = await provider.getCode(requireEnv('ZEROG_POKERGAME_ADDRESS'));
        expect(code).to.not.equal('0x');

        await prepareWallet(provider, serverWallet, serverWallet);
        await prepareWallet(provider, serverWallet, player2Wallet);
    });

    it('joins, leaves, updates GameBalance, and rejoins without losing authorization', async function () {
        const contract = makeContract(serverWallet);
        await cleanupTableSession(contract, serverWallet.address);

        const socket = await connectPlayer(serverWallet.address, 'live-e2e-p1');
        try {
            await checkDelegate(socket, serverWallet.address, serverWallet.address);

            await joinTable(socket, serverWallet.address);
            let locked = await contract.getLockedBalance(serverWallet.address);
            expect(locked).to.equal(BUY_IN_WEI);

            const firstLeave = await leaveTable(socket);
            expect(BigInt(firstLeave.balance.balance) >= BUY_IN_WEI).to.equal(true);
            expect(BigInt(firstLeave.balance.locked)).to.equal(0n);

            await checkDelegate(socket, serverWallet.address, serverWallet.address);

            await joinTable(socket, serverWallet.address);
            locked = await contract.getLockedBalance(serverWallet.address);
            expect(locked).to.equal(BUY_IN_WEI);

            const secondLeave = await leaveTable(socket);
            expect(BigInt(secondLeave.balance.balance) >= BUY_IN_WEI).to.equal(true);
            expect(BigInt(secondLeave.balance.locked)).to.equal(0n);
        } finally {
            socket.disconnect();
            await cleanupTableSession(contract, serverWallet.address);
        }
    });

    it('starts a second hand in normal cash-game mode after the first hand completes', async function () {
        const operatorContract = makeContract(serverWallet);
        await cleanupTableSession(operatorContract, serverWallet.address);
        await cleanupTableSession(operatorContract, player2Wallet.address);

        const socket1 = await connectPlayer(serverWallet.address, 'live-e2e-p1');
        const socket2 = await connectPlayer(player2Wallet.address, 'live-e2e-p2');
        const socketsByAddress = new Map([
            [serverWallet.address.toLowerCase(), socket1],
            [player2Wallet.address.toLowerCase(), socket2]
        ]);

        let lastTable = null;
        const rememberTable = ({ table }) => {
            if (table?.id === TABLE_ID) lastTable = table;
        };
        socket1.on(actions.SC_TABLE_UPDATED, rememberTable);
        socket2.on(actions.SC_TABLE_UPDATED, rememberTable);

        try {
            await checkDelegate(socket1, serverWallet.address, serverWallet.address);
            await checkDelegate(socket2, player2Wallet.address, serverWallet.address);

            await joinTable(socket1, serverWallet.address);
            await joinTable(socket2, player2Wallet.address);

            const firstHand = await waitForEvent(socket1, actions.SC_TABLE_UPDATED, ({ table }) =>
                table?.id === TABLE_ID &&
                table.handOver === false &&
                table.board?.length === 0 &&
                hasSeatedPlayer(table, serverWallet.address) &&
                hasSeatedPlayer(table, player2Wallet.address) &&
                getSeatByAddress(table, serverWallet.address)?.hand?.length === 2 &&
                getSeatByAddress(table, player2Wallet.address)?.hand?.length === 2,
                20000
            );

            await foldCurrentTurn(firstHand.table, socketsByAddress);

            await waitForEvent(socket1, actions.SC_TABLE_UPDATED, ({ table }) =>
                table?.id === TABLE_ID && table.handOver === true && (table.winMessages || []).length > 0,
                20000
            );

            const secondHand = await waitForEvent(socket1, actions.SC_TABLE_UPDATED, ({ table }) =>
                table?.id === TABLE_ID &&
                table.handOver === false &&
                table.board?.length === 0 &&
                hasSeatedPlayer(table, serverWallet.address) &&
                hasSeatedPlayer(table, player2Wallet.address) &&
                getSeatByAddress(table, serverWallet.address)?.hand?.length === 2 &&
                getSeatByAddress(table, player2Wallet.address)?.hand?.length === 2,
                20000
            );

            expect(secondHand.table.handOver).to.equal(false);
        } finally {
            socket1.off(actions.SC_TABLE_UPDATED, rememberTable);
            socket2.off(actions.SC_TABLE_UPDATED, rememberTable);

            const p1Seat = lastTable && getSeatByAddress(lastTable, serverWallet.address);
            const p2Seat = lastTable && getSeatByAddress(lastTable, player2Wallet.address);
            if (p1Seat && socket1.connected) {
                try {
                    await leaveTable(socket1);
                } catch (error) {
                    console.warn('p1 server-side leave failed during cleanup:', error.message);
                }
            }
            if (p2Seat && socket2.connected) {
                try {
                    await leaveTable(socket2);
                } catch (error) {
                    console.warn('p2 server-side leave failed during cleanup:', error.message);
                }
            }

            socket1.disconnect();
            socket2.disconnect();

            await cleanupTableSession(operatorContract, serverWallet.address);
            await cleanupTableSession(operatorContract, player2Wallet.address);
        }
    });
});
