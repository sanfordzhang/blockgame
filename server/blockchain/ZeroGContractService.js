/**
 * ZeroGContractService - Smart Contract Interaction Layer for 0G Chain
 * Uses ethers.js v6 to interact with PokerGame0G and PokerHandINFT contracts
 */

const path = require('path');
const fs = require('fs');
const config = require('../config');
// Use ethers6 for v6 API (parseEther, Contract, etc.)
const ethers = require('ethers6');

const FALLBACK_POKER_GAME_ABI = [
    'event Deposited(address indexed player, uint256 amount)',
    'event Withdrawn(address indexed player, uint256 amount)',
    'event Settled(uint256 indexed handId, address[] winners, uint256[] amounts, uint256 totalPot, uint256 rake, bytes32 stateHash)',
    'event JoinedTableFor(address indexed player, uint256 indexed tableId, uint256 buyIn, address indexed operator)',
    'event LeftTableFor(address indexed player, uint256 indexed tableId, uint256 finalStack, address indexed operator)',
    'event TournamentSettled(uint256 indexed tournamentId, address[] players, uint256[] payouts, uint256 rake, bytes32 stateHash)',
    'function deposit() payable',
    'function withdraw(uint256 amount)',
    'function settle(uint256 handId, address[] winners, uint256[] amounts, uint256 totalPot, uint256 rake, bytes32 stateHash)',
    'function joinTableFor(address player, uint256 tableId, uint256 buyIn)',
    'function leaveTableFor(address player, uint256 tableId, uint256 finalStack)',
    'function leaveTableSession(address player, uint256 finalStack)',
    'function settleTournament(uint256 tournamentId, address[] players, uint256[] payouts, uint256 rake, bytes32 stateHash)',
    'function authorizeDelegate(address delegate)',
    'function delegates(address player) view returns (address)',
    'function isDelegateFor(address player, address delegate) view returns (bool)',
    'function getCustodyBalance(address player) view returns (uint256)',
    'function getLockedBalance(address player) view returns (uint256)',
    'function getPlayerInfo(address player) view returns (uint256 balance, uint256 lockedAmount, bool isRegistered)',
    'function getTableSession(uint256 tableId, address player) view returns (uint256 buyIn, bool active)',
    'function getHandStateHash(uint256 handId) view returns (bytes32)'
];

const FALLBACK_INFT_ABI = [
    'event PokerHandMinted(uint256 indexed tokenId, string handType, address indexed to, string storageRootHash)',
    'event EncryptedTransferEvent(uint256 indexed tokenId, address indexed from, address indexed to)',
    'event Cloned(uint256 indexed originalTokenId, uint256 indexed newTokenId, address indexed owner)',
    'event AgentBound(uint256 indexed tokenId, address indexed agentAddress)',
    'function mint(address to, string handType, string storageRootHash, string metadataURI) returns (uint256)',
    'function mintWithCards(address to, uint256 typeId, string[] cards, string storageRootHash, string metadataURI) returns (uint256)',
    'function getPokerData(uint256 tokenId) view returns (string handType, string storageRootHash, string metadataURI, uint256 timestamp, address aiAgent, bool isEncrypted)',
    'function encryptedTransfer(address to, bytes encryptedMetadata)',
    'function clone(address owner) returns (uint256)',
    'function bindAgent(address agent)',
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)'
];

class ZeroGContractService {
    constructor() {
        this.zeroGService = null;
        this.pokerGameContract = null;
        this.inftContract = null;
        this.pokerGameAbi = null;
        this.inftAbi = null;
        this.pokerGameAddress = null;
        this.inftAddress = null;
        this.initialized = false;
    }

    /**
     * Initialize contract service with ZeroGService instance
     * @param {ZeroGService} zeroGService - Initialized ZeroG service
     * @param {string} network - 'testnet' | 'mainnet'
     */
    init(zeroGService, network = 'testnet') {
        this.zeroGService = zeroGService;
        
        const netConfig = zeroGService.getNetworkConfig(network);
        this.pokerGameAddress = netConfig.pokerGameAddress;
        this.inftAddress = netConfig.inftAddress;

        // Load ABIs
        this.loadAbis();

        if (this.pokerGameAddress && this.pokerGameAbi) {
            this.connectPokerGame(this.pokerGameAddress);
        } else {
            console.warn('[ZeroGContractService] No PokerGame0G address configured');
        }

        if (this.inftAddress && this.inftAbi) {
            this.connectINFT(this.inftAddress);
        } else {
            console.warn('[ZeroGContractService] No PokerHandINFT address configured');
        }

        this.initialized = true;
        console.log('[ZeroGContractService] Initialized for', network);
        return this;
    }

    loadAbis() {
        try {
            // Check multiple possible locations for compiled artifacts:
            // 1. Hardhat artifacts (standard): artifacts/contracts/0g/*.sol/
            // 2. TronBox build (legacy): build/contracts/
            const searchPaths = [
                path.join(__dirname, '../../artifacts/contracts/0g'),
                path.join(__dirname, '../../build/contracts')
            ];

            for (const baseDir of searchPaths) {
                // PokerGame0G - try both with and without .sol subfolder
                if (!this.pokerGameAbi) {
                    const pgCandidates = [
                        path.join(baseDir, 'PokerGame0G.sol', 'PokerGame0G.json'),
                        path.join(baseDir, 'PokerGame0G.json')
                    ];
                    for (const pgPath of pgCandidates) {
                        if (fs.existsSync(pgPath)) {
                            const pgArtifact = JSON.parse(fs.readFileSync(pgPath, 'utf8'));
                            this.pokerGameAbi = pgArtifact.abi;
                            console.log('[ZeroGContractService] PokerGame0G ABI loaded from:', pgPath);
                            break;
                        }
                    }
                }

                // PokerHandINFT
                if (!this.inftAbi) {
                    const inftCandidates = [
                        path.join(baseDir, 'PokerHandINFT.sol', 'PokerHandINFT.json'),
                        path.join(baseDir, 'PokerHandINFT.json')
                    ];
                    for (const inftPath of inftCandidates) {
                        if (fs.existsSync(inftPath)) {
                            const inftArtifact = JSON.parse(fs.readFileSync(inftPath, 'utf8'));
                            this.inftAbi = inftArtifact.abi;
                            console.log('[ZeroGContractService] PokerHandINFT ABI loaded from:', inftPath);
                            break;
                        }
                    }
                }

                if (this.pokerGameAbi && this.inftAbi) break;
            }

            if (!this.pokerGameAbi) {
                this.pokerGameAbi = FALLBACK_POKER_GAME_ABI;
                console.warn('[ZeroGContractService] ⚠️ PokerGame0G ABI artifact not found; using built-in fallback ABI');
            }
            if (!this.inftAbi) {
                this.inftAbi = FALLBACK_INFT_ABI;
                console.warn('[ZeroGContractService] ⚠️ PokerHandINFT ABI artifact not found; using built-in fallback ABI');
            }
            if (this.pokerGameAbi || this.inftAbi) {
                console.log('[ZeroGContractService] ABI loading complete');
            }
        } catch (e) {
            console.error('[ZeroGContractService] Failed to load ABIs:', e.message);
        }
    }

    connectPokerGame(address) {
        if (!this.zeroGService || !this.zeroGService.wallet) {
            throw new Error('[ZeroGContractService] ZeroG wallet not available');
        }
        this.pokerGameContract = new ethers.Contract(
            address, this.pokerGameAbi, this.zeroGService.wallet
        );
        console.log(`[ZeroGContractService] PokerGame0G connected at ${address}`);
    }

    connectINFT(address) {
        if (!this.zeroGService || !this.zeroGService.wallet) {
            throw new Error('[ZeroGContractService] ZeroG wallet not available');
        }
        this.inftContract = new ethers.Contract(
            address, this.inftAbi, this.zeroGService.wallet
        );
        console.log(`[ZeroGContractService] PokerHandINFT connected at ${address}`);
    }

    // ============ PokerGame0G Methods ============

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _receiptHash(receiptOrTx) {
        return receiptOrTx?.hash || receiptOrTx?.transactionHash || receiptOrTx?.tx || null;
    }

    _isTransientReceiptError(error) {
        const details = [
            error?.code,
            error?.message,
            error?.shortMessage,
            error?.error?.message,
            error?.info?.error?.message
        ].filter(Boolean).join(' ');

        return /no matching receipts found|transaction receipt.*not found|receipt.*not found|timeout|ETIMEDOUT|ECONNRESET|503/i.test(details);
    }

    _syntheticReceipt(tx, reason) {
        return {
            hash: tx?.hash || null,
            transactionHash: tx?.hash || null,
            status: 1,
            confirmedByState: true,
            reason
        };
    }

    async _waitForTransaction(tx, {
        label = '0G transaction',
        attempts = 8,
        delayMs = 2500,
        confirmState = null
    } = {}) {
        let lastError = null;

        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const receipt = await tx.wait();
                return receipt;
            } catch (error) {
                lastError = error;
                if (!this._isTransientReceiptError(error)) {
                    throw error;
                }

                const hash = this._receiptHash(tx);
                console.warn(`[ZeroGContractService] ${label} receipt lookup failed on attempt ${attempt}/${attempts}, tx=${hash || 'unknown'}: ${error.message}`);

                if (hash && this.zeroGService?.provider?.getTransactionReceipt) {
                    try {
                        const receipt = await this.zeroGService.provider.getTransactionReceipt(hash);
                        if (receipt) return receipt;
                    } catch (receiptError) {
                        if (!this._isTransientReceiptError(receiptError)) {
                            throw receiptError;
                        }
                    }
                }

                if (confirmState) {
                    try {
                        if (await confirmState()) {
                            return this._syntheticReceipt(tx, `${label} confirmed by chain state`);
                        }
                    } catch (stateError) {
                        console.warn(`[ZeroGContractService] ${label} state confirmation failed: ${stateError.message}`);
                    }
                }

                if (attempt < attempts) {
                    await this._sleep(delayMs);
                }
            }
        }

        if (confirmState) {
            try {
                if (await confirmState()) {
                    return this._syntheticReceipt(tx, `${label} confirmed by chain state after retries`);
                }
            } catch (stateError) {
                console.warn(`[ZeroGContractService] ${label} final state confirmation failed: ${stateError.message}`);
            }
        }

        throw lastError;
    }

    async deposit(playerAddress, valueEth) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const tx = await this.pokerGameContract.deposit({
            value: ethers.parseEther(valueEth.toString())
        });
        return await this._waitForTransaction(tx, { label: 'deposit' });
    }

    async withdraw(amountEth) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const tx = await this.pokerGameContract.withdraw(ethers.parseEther(amountEth.toString()));
        return await this._waitForTransaction(tx, { label: 'withdraw' });
    }

    async settle(gameResult) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        
        const { handId, winners, amounts, totalPot, rake, stateHash } = gameResult;

        const parsedAmounts = amounts.map(a => ethers.parseEther(a.toString()));
        const tx = await this.pokerGameContract.settle(
            handId,
            winners,
            parsedAmounts,
            ethers.parseEther(totalPot.toString()),
            ethers.parseEther(rake.toString()),
            stateHash || ethers.id(0)
        );

        return await this._waitForTransaction(tx, { label: 'settle' });
    }

    async joinTableFor(playerAddress, tableId, buyInWei) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        if (!this.pokerGameContract.joinTableFor) {
            throw new Error('PokerGame contract does not support joinTableFor; redeploy PokerGame0G');
        }

        const tx = await this.pokerGameContract.joinTableFor(
            playerAddress,
            BigInt(tableId),
            BigInt(buyInWei)
        );
        return await this._waitForTransaction(tx, {
            label: 'joinTableFor',
            confirmState: async () => {
                const session = await this.getTableSession(tableId, playerAddress);
                return session.active && BigInt(session.buyIn || '0') === BigInt(buyInWei);
            }
        });
    }

    async leaveTableFor(playerAddress, tableId, finalStackWei) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        if (!this.pokerGameContract.leaveTableFor) {
            throw new Error('PokerGame contract does not support leaveTableFor; redeploy PokerGame0G');
        }

        const tx = await this.pokerGameContract.leaveTableFor(
            playerAddress,
            BigInt(tableId),
            BigInt(finalStackWei)
        );
        return await this._waitForTransaction(tx, {
            label: 'leaveTableFor',
            confirmState: async () => {
                const session = await this.getTableSession(tableId, playerAddress);
                return !session.active;
            }
        });
    }

    async settleTournament(tournamentId, players, payoutsWei, rakeWei, stateHash) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        if (!this.pokerGameContract.settleTournament) {
            throw new Error('PokerGame contract does not support settleTournament; redeploy PokerGame0G');
        }

        const tx = await this.pokerGameContract.settleTournament(
            BigInt(tournamentId),
            players,
            payoutsWei.map(amount => BigInt(amount)),
            BigInt(rakeWei),
            stateHash || ethers.ZeroHash
        );
        return await this._waitForTransaction(tx, { label: 'settleTournament' });
    }

    /**
     * Player leaves table — return final stack to custody balance
     * @param {string} playerAddress - Player wallet address
     * @param {number|string} finalStack - Final stack in wei (0G smallest unit)
     */
    async leaveTableSession(playerAddress, finalStack) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const tx = await this.pokerGameContract.leaveTableSession(
            playerAddress,
            BigInt(finalStack)  // already in wei
        );
        return await this._waitForTransaction(tx, { label: 'leaveTableSession' });
    }

    async authorizePlayer(playerAddress) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const serverAddr = this.zeroGService.getSignerAddress();
        const tx = await this.pokerGameContract.authorizeDelegate(serverAddr);
        return await this._waitForTransaction(tx, { label: 'authorizeDelegate' });
    }

    /**
     * Check if player has authorized a specific delegate address
     * @param {string} playerAddress - Player's EVM address
     * @param {string} delegateAddress - Delegate address to check
     * @returns {Promise<boolean>}
     */
    async isAuthorizedDelegate(playerAddress, delegateAddress) {
        if (!this.pokerGameContract) {
            console.warn('[ZeroGContractService] PokerGame not connected, cannot check authorization');
            return false;
        }
        try {
            const result = await this.pokerGameContract.isDelegateFor(
                playerAddress,
                delegateAddress
            );
            return Boolean(result);
        } catch (e) {
            console.error('[ZeroGContractService] isAuthorizedDelegate error:', e.message);
            return false;
        }
    }

    /**
     * Get player's current delegate address from contract
     * @param {string} playerAddress - Player's EVM address
     * @returns {Promise<string|null>} Delegate address or null
     */
    async getPlayerDelegate(playerAddress) {
        if (!this.pokerGameContract) return null;
        try {
            return await this.pokerGameContract.delegates(playerAddress);
        } catch (e) {
            console.error('[ZeroGContractService] getPlayerDelegate error:', e.message);
            return null;
        }
    }

    async getCustodyBalance(playerAddress) {
        if (!this.pokerGameContract) return '0';
        return (await this.pokerGameContract.getCustodyBalance(playerAddress)).toString();
    }

    async getLockedBalance(playerAddress) {
        if (!this.pokerGameContract || !this.pokerGameContract.getLockedBalance) return '0';
        return (await this.pokerGameContract.getLockedBalance(playerAddress)).toString();
    }

    async getTableSession(tableId, playerAddress) {
        if (!this.pokerGameContract || !this.pokerGameContract.getTableSession) {
            return { buyIn: '0', active: false };
        }

        const session = await this.pokerGameContract.getTableSession(
            BigInt(tableId),
            playerAddress
        );

        return {
            buyIn: (session.buyIn ?? session[0] ?? 0).toString(),
            active: Boolean(session.active ?? session[1])
        };
    }

    async getHandStateHash(handId) {
        if (!this.pokerGameContract) return null;
        return await this.pokerGameContract.getHandStateHash(handId);
    }

    // ============ PokerHandINFT Methods ============

    async mintINFT(to, handType, storageRootHash, metadataURI) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.mint(to, handType, storageRootHash, metadataURI);
        const receipt = await this._waitForTransaction(tx, { label: 'mintINFT' });
        return receipt;
    }

    async mintWithCards(to, typeId, cards, storageRootHash, metadataURI) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.mintWithCards(to, typeId, cards, storageRootHash, metadataURI);
        return await this._waitForTransaction(tx, { label: 'mintWithCards' });
    }

    async queryNFTData(tokenId) {
        if (!this.inftContract) return null;
        return await this.inftContract.getPokerData(tokenId);
    }

    async encryptedTransfer(tokenId, to, encryptedMetadata) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.encryptedTransfer(to, encryptedMetadata);
        return await this._waitForTransaction(tx, { label: 'encryptedTransfer' });
    }

    async cloneINFT(tokenId, newOwner) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.clone(newOwner);
        return await this._waitForTransaction(tx, { label: 'cloneINFT' });
    }

    async bindAgent(tokenId, agentAddress) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.bindAgent(agentAddress);
        return await this._waitForTransaction(tx, { label: 'bindAgent' });
    }

    // ============ Status ============

    getStatus() {
        return {
            initialized: this.initialized,
            pokerGameAddress: this.pokerGameAddress,
            inftAddress: this.inftAddress,
            pokerGameConnected: !!this.pokerGameContract,
            inftConnected: !!this.inftContract,
            signerAddress: this.zeroGService?.getSignerAddress() || null,
            network: config.ZEROG_NETWORK
        };
    }
}

module.exports = ZeroGContractService;
