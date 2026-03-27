/**
 * DAOService
 * Manages DAO proposals, voting, and governance
 */

const Proposal = require('../models/Proposal');
const Vote = require('../models/Vote');

class DAOService {
    constructor(config) {
        this.tronWeb = config.tronWeb;
        this.governanceAddress = config.governanceAddress;
        this.chipTokenAddress = config.chipTokenAddress;
        this.contract = null;
        this.chipContract = null;
    }
    
    /**
     * Initialize the service
     */
    async init() {
        if (this.governanceAddress) {
            this.contract = await this.tronWeb.contract().at(this.governanceAddress);
            console.log('[DAOService] Governance contract loaded:', this.governanceAddress);
        }
        
        if (this.chipTokenAddress) {
            this.chipContract = await this.tronWeb.contract().at(this.chipTokenAddress);
            console.log('[DAOService] CHIP token contract loaded:', this.chipTokenAddress);
        }
    }
    
    // ============ Proposals ============
    
    /**
     * Create a new proposal
     * @param {Object} proposalData - Proposal data
     */
    async createProposal(proposalData) {
        const { proposerAddress, proposalType, description, targetContract, callData, parameters } = proposalData;
        
        // Check proposal threshold
        const balance = await this.getChipBalance(proposerAddress);
        const threshold = await this.getProposalThreshold();
        
        if (balance < threshold) {
            throw new Error('Insufficient CHIP balance for proposal');
        }
        
        // Create proposal on contract
        let onchainId = null;
        let txHash = null;
        
        if (this.contract) {
            const tx = await this.contract.createProposal(
                targetContract || this.governanceAddress,
                callData || '0x',
                description
            ).send({
                from: proposerAddress
            });
            
            txHash = tx;
            onchainId = await this._getProposalIdFromTx(tx);
        }
        
        // Calculate voting period
        const votingPeriod = await this.getVotingPeriod();
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + votingPeriod * 1000);
        
        // Create database record
        const proposal = new Proposal({
            onchainId,
            proposalType,
            description,
            proposerAddress,
            targetContract,
            callData,
            parameters,
            state: 'ACTIVE',
            startTime,
            endTime,
            totalVotingPower: await this.getTotalVotingPower()
        });
        
        await proposal.save();
        
        console.log(`[DAOService] Created proposal ${proposal._id}`);
        
        return proposal;
    }
    
    /**
     * Create a rake rate change proposal
     */
    async createRakeRateProposal(proposerAddress, newRakeRate, description) {
        // Encode call data for setRakeRate function
        const callData = this.encodeSetRakeRate(newRakeRate);
        
        return this.createProposal({
            proposerAddress,
            proposalType: 'RAKE_RATE',
            description: description || `Change rake rate to ${newRakeRate / 100}%`,
            targetContract: process.env.MAINNET_CONTRACT_ADDRESS,
            callData,
            parameters: { newRakeRate }
        });
    }
    
    /**
     * Get proposal by ID
     */
    async getProposal(proposalId) {
        return Proposal.findById(proposalId);
    }
    
    /**
     * Get active proposals
     */
    async getActiveProposals() {
        return Proposal.findActive();
    }
    
    /**
     * Get proposals by proposer
     */
    async getProposalsByProposer(address) {
        return Proposal.findByProposer(address);
    }
    
    // ============ Voting ============
    
    /**
     * Cast a vote
     * @param {string} proposalId - Proposal ID
     * @param {string} voterAddress - Voter's address
     * @param {number} support - 0=Against, 1=For, 2=Abstain
     * @param {string} reason - Optional reason
     */
    async castVote(proposalId, voterAddress, support, reason = null) {
        const proposal = await Proposal.findById(proposalId);
        
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        
        if (!proposal.isActive()) {
            throw new Error('Proposal not active');
        }
        
        // Check if already voted
        const alreadyVoted = await Vote.hasVoted(proposalId, voterAddress);
        if (alreadyVoted) {
            throw new Error('Already voted');
        }
        
        // Get voting weight
        const weight = await this.getChipBalance(voterAddress);
        
        if (weight === 0) {
            throw new Error('No voting power');
        }
        
        // Cast vote on contract
        let txHash = null;
        if (this.contract) {
            const tx = await this.contract.castVote(proposal.onchainId, support).send({
                from: voterAddress
            });
            txHash = tx;
        }
        
        // Record vote in database
        const vote = new Vote({
            proposalId,
            voterAddress,
            support,
            weight,
            reason,
            txHash
        });
        
        await vote.save();
        
        // Update proposal vote counts
        proposal.castVote(support, weight);
        await proposal.save();
        
        console.log(`[DAOService] Vote cast: ${support} by ${voterAddress} (${weight} CHIP)`);
        
        return vote;
    }
    
    /**
     * Check if address has voted on proposal
     */
    async hasVoted(proposalId, voterAddress) {
        return Vote.hasVoted(proposalId, voterAddress);
    }
    
    /**
     * Get votes for a proposal
     */
    async getProposalVotes(proposalId) {
        return Vote.findByProposal(proposalId);
    }
    
    /**
     * Get vote stats for a proposal
     */
    async getVoteStats(proposalId) {
        return Vote.getVoteStats(proposalId);
    }
    
    // ============ Execution ============
    
    /**
     * Execute a successful proposal
     */
    async executeProposal(proposalId) {
        const proposal = await Proposal.findById(proposalId);
        
        if (!proposal) {
            throw new Error('Proposal not found');
        }
        
        if (!proposal.canExecute()) {
            throw new Error('Proposal cannot be executed');
        }
        
        // Execute on contract
        let txHash = null;
        if (this.contract) {
            const tx = await this.contract.executeProposal(proposal.onchainId).send();
            txHash = tx;
        }
        
        // Update proposal
        proposal.execute(txHash);
        await proposal.save();
        
        console.log(`[DAOService] Executed proposal ${proposalId}`);
        
        return proposal;
    }
    
    /**
     * Update proposal states
     */
    async updateProposalStates() {
        const activeProposals = await Proposal.findActive();
        
        for (const proposal of activeProposals) {
            if (proposal.hasEnded()) {
                proposal.updateState(10); // 10% quorum
                await proposal.save();
                console.log(`[DAOService] Updated proposal ${proposal._id} to ${proposal.state}`);
            }
        }
    }
    
    // ============ Helpers ============
    
    /**
     * Get CHIP balance
     */
    async getChipBalance(address) {
        if (!this.chipContract) return 0;
        
        const balance = await this.chipContract.balanceOf(address).call();
        return this.tronWeb.toDecimal(balance);
    }
    
    /**
     * Get total voting power
     */
    async getTotalVotingPower() {
        if (!this.chipContract) return 0;
        
        const supply = await this.chipContract.totalSupply().call();
        return this.tronWeb.toDecimal(supply);
    }
    
    /**
     * Get proposal threshold
     */
    async getProposalThreshold() {
        if (!this.contract) return 1000 * 1e6; // Default 1000 CHIP
        
        const threshold = await this.contract.proposalThreshold().call();
        return this.tronWeb.toDecimal(threshold);
    }
    
    /**
     * Get voting period
     */
    async getVotingPeriod() {
        if (!this.contract) return 3 * 24 * 60 * 60; // Default 3 days
        
        const period = await this.contract.votingPeriod().call();
        return this.tronWeb.toDecimal(period);
    }
    
    /**
     * Encode setRakeRate call data
     */
    encodeSetRakeRate(newRate) {
        // Simplified encoding - in production use proper ABI encoding
        const methodId = this.tronWeb.sha3('setRakeRate(uint256)').slice(0, 8);
        const param = this.tronWeb.utils.padLeft(newRate.toString(16), 64);
        return '0x' + methodId + param;
    }
    
    async _getProposalIdFromTx(tx) {
        const event = tx.events?.ProposalCreated;
        return event?.result?.proposalId?.toNumber() || Date.now();
    }
}

// Singleton instance
let daoServiceInstance = null;

function initDAOService(config) {
    if (!daoServiceInstance) {
        daoServiceInstance = new DAOService(config);
    }
    return daoServiceInstance;
}

// Export with proxy methods
module.exports = {
    DAOService,
    initDAOService,
    getDAOService: () => daoServiceInstance,
    
    // Proxy methods
    getProposals: async (filter = {}) => {
        if (!daoServiceInstance) return [];
        return daoServiceInstance.getActiveProposals();
    },
    getProposal: async (id) => {
        if (!daoServiceInstance) return null;
        return daoServiceInstance.getProposal(id);
    },
    getProposalById: async (id) => {
        if (!daoServiceInstance) return null;
        return daoServiceInstance.getProposal(id);
    },
    getActiveProposals: async () => {
        if (!daoServiceInstance) return [];
        return daoServiceInstance.getActiveProposals();
    },
    getProposalsByProposer: async (address) => {
        if (!daoServiceInstance) return [];
        return daoServiceInstance.getProposalsByProposer(address);
    },
    createProposal: async (address, data) => {
        if (!daoServiceInstance) throw new Error('Service not initialized');
        return daoServiceInstance.createProposal({ proposerAddress: address, ...data });
    },
    createRakeRateProposal: async (address, newRakeRate, description) => {
        if (!daoServiceInstance) throw new Error('Service not initialized');
        return daoServiceInstance.createRakeRateProposal(address, newRakeRate, description);
    },
    castVote: async (voterAddress, proposalId, support, reason) => {
        if (!daoServiceInstance) throw new Error('Service not initialized');
        return daoServiceInstance.castVote(proposalId, voterAddress, support, reason);
    },
    hasVoted: async (proposalId, voterAddress) => {
        if (!daoServiceInstance) return false;
        return daoServiceInstance.hasVoted(proposalId, voterAddress);
    },
    getVoteStats: async (proposalId) => {
        if (!daoServiceInstance) return { for: 0, against: 0, abstain: 0 };
        return daoServiceInstance.getVoteStats(proposalId);
    },
    executeProposal: async (proposalId) => {
        if (!daoServiceInstance) throw new Error('Service not initialized');
        return daoServiceInstance.executeProposal(proposalId);
    },
    getProposalThreshold: async () => {
        if (!daoServiceInstance) return 1000000;
        return daoServiceInstance.getProposalThreshold();
    },
    getVotingPeriod: async () => {
        if (!daoServiceInstance) return 86400;
        return daoServiceInstance.getVotingPeriod();
    },
    getUserVotes: async (walletAddress) => {
        if (!daoServiceInstance) return [];
        // Get votes from Vote model directly
        const Vote = require('../models/Vote');
        return Vote.find({ voterAddress }).sort({ createdAt: -1 }).limit(50);
    },
    getVotingPower: async (walletAddress) => {
        if (!daoServiceInstance) return 0;
        return daoServiceInstance.getChipBalance(walletAddress);
    },
    getQuorum: async () => {
        if (!daoServiceInstance) return 10000000;
        return 10000000; // Default quorum
    }
};
