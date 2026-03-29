// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title Governance
 * @dev DAO Governance Contract for CHIP holders
 * Simple governance with voting, quorum, and proposal execution
 */
contract Governance is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    
    // ============ Enums ============
    
    enum ProposalState {
        PENDING,
        ACTIVE,
        SUCCEEDED,
        DEFEATED,
        EXECUTED,
        EXPIRED
    }
    
    enum VoteType {
        AGAINST,
        FOR,
        ABSTAIN
    }
    
    // ============ Structs ============
    
    struct Proposal {
        uint256 id;
        address proposer;
        address target;
        bytes callData;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quorumVotes;
        bool executed;
        string description;
        ProposalState state;
    }
    
    // ============ State Variables ============
    
    IERC20 public chipToken;
    
    uint256 public votingPeriod = 3 days;       // Default 3 days
    uint256 public proposalThreshold = 1000 * 1e6; // 1000 CHIP to create proposal
    uint256 public quorumNumerator = 100;       // 10% quorum (100/1000)
    
    uint256 public proposalCount;
    
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public votes; // 0=against, 1=for, 2=abstain
    
    EnumerableSet.UintSet private activeProposals;
    
    // ============ Events ============
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address target,
        string description
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event ProposalStateChanged(uint256 indexed proposalId, ProposalState newState);
    event VotingPeriodUpdated(uint256 newPeriod);
    event ProposalThresholdUpdated(uint256 newThreshold);
    
    // ============ Constructor ============
    
    constructor(
        address _chipToken,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumNumerator
    )  {
        require(_chipToken != address(0), "Governance: invalid token");
        
        chipToken = IERC20(_chipToken);
        votingPeriod = _votingPeriod;
        proposalThreshold = _proposalThreshold;
        quorumNumerator = _quorumNumerator;
    }
    
    // ============ Core Functions ============
    
    /**
     * @dev Create a new proposal
     * @param target Target contract address
     * @param callData Encoded function call
     * @param description Proposal description
     */
    function createProposal(
        address target,
        bytes calldata callData,
        string calldata description
    ) external whenNotPaused returns (uint256) {
        require(target != address(0), "Governance: invalid target");
        
        // Check proposal threshold
        uint256 balance = chipToken.balanceOf(msg.sender);
        require(balance >= proposalThreshold, "Governance: below threshold");
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.target = target;
        newProposal.callData = callData;
        newProposal.description = description;
        newProposal.startBlock = block.number;
        newProposal.endBlock = block.number + (votingPeriod / 3 seconds); // Approx blocks
        newProposal.state = ProposalState.ACTIVE;
        newProposal.quorumVotes = chipToken.totalSupply() * quorumNumerator / 1000;
        
        activeProposals.add(proposalId);
        
        emit ProposalCreated(proposalId, msg.sender, target, description);
        
        return proposalId;
    }
    
    /**
     * @dev Cast vote on a proposal
     * @param proposalId Proposal ID
     * @param support 0=Against, 1=For, 2=Abstain
     */
    function castVote(uint256 proposalId, uint8 support) 
        external 
        whenNotPaused 
    {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id != 0, "Governance: proposal not found");
        require(proposal.state == ProposalState.ACTIVE, "Governance: not active");
        require(!hasVoted[proposalId][msg.sender], "Governance: already voted");
        require(support <= 2, "Governance: invalid vote");
        
        uint256 weight = chipToken.balanceOf(msg.sender);
        require(weight > 0, "Governance: no voting power");
        
        hasVoted[proposalId][msg.sender] = true;
        votes[proposalId][msg.sender] = support;
        
        if (support == uint8(VoteType.FOR)) {
            proposal.forVotes += weight;
        } else if (support == uint8(VoteType.AGAINST)) {
            proposal.againstVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
        
        // Update state if voting ended
        _updateProposalState(proposalId);
    }
    
    /**
     * @dev Execute a successful proposal
     * @param proposalId Proposal ID
     */
    function executeProposal(uint256 proposalId) 
        external 
        whenNotPaused 
        returns (bool) 
    {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id != 0, "Governance: proposal not found");
        require(proposal.state == ProposalState.SUCCEEDED, "Governance: not succeeded");
        require(!proposal.executed, "Governance: already executed");
        
        proposal.executed = true;
        proposal.state = ProposalState.EXECUTED;
        
        activeProposals.remove(proposalId);
        
        // Execute the proposal
        (bool success, ) = proposal.target.call(proposal.callData);
        
        emit ProposalExecuted(proposalId, success);
        emit ProposalStateChanged(proposalId, ProposalState.EXECUTED);
        
        return success;
    }
    
    /**
     * @dev Update proposal state based on votes
     */
    function updateProposalState(uint256 proposalId) external {
        _updateProposalState(proposalId);
    }
    
    function _updateProposalState(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.state != ProposalState.ACTIVE) {
            return;
        }
        
        // Check if voting period ended (approximate with block number)
        if (block.number >= proposal.endBlock) {
            uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
            
            if (totalVotes < proposal.quorumVotes) {
                // Quorum not reached
                proposal.state = ProposalState.DEFEATED;
            } else if (proposal.forVotes > proposal.againstVotes) {
                proposal.state = ProposalState.SUCCEEDED;
            } else {
                proposal.state = ProposalState.DEFEATED;
            }
            
            activeProposals.remove(proposalId);
            emit ProposalStateChanged(proposalId, proposal.state);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get proposal state
     */
    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.id == 0) {
            return ProposalState.PENDING;
        }
        
        // Check if expired (not executed within 7 days after success)
        if (proposal.state == ProposalState.SUCCEEDED) {
            if (block.number > proposal.endBlock + (7 days / 3 seconds)) {
                return ProposalState.EXPIRED;
            }
        }
        
        return proposal.state;
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        address target,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        ProposalState state,
        bool executed
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.target,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.state,
            proposal.executed
        );
    }
    
    /**
     * @dev Get active proposals
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 length = activeProposals.length();
        uint256[] memory result = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = activeProposals.at(i);
        }
        
        return result;
    }
    
    /**
     * @dev Check if address has voted on proposal
     */
    function getVote(uint256 proposalId, address voter) external view returns (bool, uint256) {
        return (hasVoted[proposalId][voter], votes[proposalId][voter]);
    }
    
    /**
     * @dev Calculate quorum required
     */
    function quorum() external view returns (uint256) {
        return chipToken.totalSupply() * quorumNumerator / 1000;
    }
    
    // ============ Admin Functions ============
    
    function setVotingPeriod(uint256 _votingPeriod) external onlyOwner {
        require(_votingPeriod >= 1 days && _votingPeriod <= 14 days, "Governance: invalid period");
        votingPeriod = _votingPeriod;
        emit VotingPeriodUpdated(_votingPeriod);
    }
    
    function setProposalThreshold(uint256 _threshold) external onlyOwner {
        proposalThreshold = _threshold;
        emit ProposalThresholdUpdated(_threshold);
    }
    
    function setQuorumNumerator(uint256 _quorumNumerator) external onlyOwner {
        require(_quorumNumerator <= 500, "Governance: quorum too high"); // Max 50%
        quorumNumerator = _quorumNumerator;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Receive ============
    
    receive() external payable {}
    fallback() external payable {}
}
