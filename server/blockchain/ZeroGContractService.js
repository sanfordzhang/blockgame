/**
 * ZeroGContractService - Smart Contract Interaction Layer for 0G Chain
 * Uses ethers.js v6 to interact with PokerGame0G and PokerHandINFT contracts
 */

const path = require('path');
const fs = require('fs');
const config = require('../config');
// Use ethers6 for v6 API (parseEther, Contract, etc.)
const ethers = require('ethers6');

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
            const basePath = path.join(__dirname, '../../build/contracts');
            
            const pgPath = path.join(basePath, 'PokerGame0G.json');
            if (fs.existsSync(pgPath)) {
                const pgArtifact = JSON.parse(fs.readFileSync(pgPath, 'utf8'));
                this.pokerGameAbi = pgArtifact.abi;
                console.log('[ZeroGContractService] PokerGame0G ABI loaded');
            }

            const inftPath = path.join(basePath, 'PokerHandINFT.json');
            if (fs.existsSync(inftPath)) {
                const inftArtifact = JSON.parse(fs.readFileSync(inftPath, 'utf8'));
                this.inftAbi = inftArtifact.abi;
                console.log('[ZeroGContractService] PokerHandINFT ABI loaded');
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

    async deposit(playerAddress, valueEth) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const tx = await this.pokerGameContract.deposit({
            value: ethers.parseEther(valueEth.toString())
        });
        return await tx.wait();
    }

    async withdraw(amountEth) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const tx = await this.pokerGameContract.withdraw(ethers.parseEther(amountEth.toString()));
        return await tx.wait();
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

        return await tx.wait();
    }

    async authorizePlayer(playerAddress) {
        if (!this.pokerGameContract) throw new Error('PokerGame not connected');
        const serverAddr = this.zeroGService.getSignerAddress();
        const tx = await this.pokerGameContract.authorizeDelegate(playerAddress);
        return await tx.wait();
    }

    async getCustodyBalance(playerAddress) {
        if (!this.pokerGameContract) return '0';
        return (await this.pokerGameContract.getCustodyBalance(playerAddress)).toString();
    }

    async getHandStateHash(handId) {
        if (!this.pokerGameContract) return null;
        return await this.pokerGameContract.getHandStateHash(handId);
    }

    // ============ PokerHandINFT Methods ============

    async mintINFT(to, handType, storageRootHash, metadataURI) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.mint(to, handType, storageRootHash, metadataURI);
        const receipt = await tx.wait();
        return receipt;
    }

    async mintWithCards(to, typeId, cards, storageRootHash, metadataURI) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.mintWithCards(to, typeId, cards, storageRootHash, metadataURI);
        return await tx.wait();
    }

    async queryNFTData(tokenId) {
        if (!this.inftContract) return null;
        return await this.inftContract.getPokerData(tokenId);
    }

    async encryptedTransfer(tokenId, to, encryptedMetadata) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.encryptedTransfer(to, encryptedMetadata);
        return await tx.wait();
    }

    async cloneINFT(tokenId, newOwner) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.clone(newOwner);
        return await tx.wait();
    }

    async bindAgent(tokenId, agentAddress) {
        if (!this.inftContract) throw new Error('INFT contract not connected');
        const tx = await this.inftContract.bindAgent(agentAddress);
        return await tx.wait();
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
