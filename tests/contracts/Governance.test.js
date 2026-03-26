const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Governance Contract', function () {
  let Governance, ChipToken, MockTarget;
  let governance, chip, mockTarget;
  let owner, proposer, voter1, voter2, voter3;

  const PROPOSAL_THRESHOLD = ethers.utils.parseEther('1000');
  const VOTING_PERIOD = 3 * 24 * 60 * 60; // 3 days
  const QUORUM_PERCENT = 10; // 10%

  beforeEach(async function () {
    [owner, proposer, voter1, voter2, voter3] = await ethers.getSigners();

    // Deploy CHIP token
    ChipToken = await ethers.getContractFactory('ChipToken');
    chip = await ChipToken.deploy(owner.address);

    // Deploy mock target contract for proposal execution
    MockTarget = await ethers.getContractFactory('MockTarget');
    mockTarget = await MockTarget.deploy();

    // Deploy Governance contract
    Governance = await ethers.getContractFactory('Governance');
    governance = await Governance.deploy(chip.address);

    // Distribute tokens
    await chip.transfer(proposer.address, PROPOSAL_THRESHOLD.mul(2));
    await chip.transfer(voter1.address, ethers.utils.parseEther('10000'));
    await chip.transfer(voter2.address, ethers.utils.parseEther('5000'));
    await chip.transfer(voter3.address, ethers.utils.parseEther('3000'));

    // Delegate voting power
    await chip.connect(proposer).delegate(proposer.address);
    await chip.connect(voter1).delegate(voter1.address);
    await chip.connect(voter2).delegate(voter2.address);
    await chip.connect(voter3).delegate(voter3.address);
  });

  describe('Deployment', function () {
    it('Should set correct CHIP token', async function () {
      expect(await governance.chipToken()).to.equal(chip.address);
    });

    it('Should have correct proposal threshold', async function () {
      expect(await governance.proposalThreshold()).to.equal(PROPOSAL_THRESHOLD);
    });
  });

  describe('Proposal Creation', function () {
    it('Should create proposal with sufficient voting power', async function () {
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      
      const tx = await governance.connect(proposer).createProposal(
        'Test Proposal',
        'Description of test proposal',
        mockTarget.address,
        callData
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      
      expect(event).to.not.be.undefined;
      expect(event.args.proposalId).to.equal(1);
    });

    it('Should fail with insufficient voting power', async function () {
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      
      // voter3 only has 3000 CHIP, below threshold
      await expect(
        governance.connect(voter3).createProposal(
          'Test Proposal',
          'Description',
          mockTarget.address,
          callData
        )
      ).to.be.revertedWith('Governance: below threshold');
    });

    it('Should set correct proposal state', async function () {
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      
      await governance.connect(proposer).createProposal(
        'Test Proposal',
        'Description',
        mockTarget.address,
        callData
      );
      
      const proposal = await governance.getProposal(1);
      expect(proposal.state).to.equal(0); // PENDING
    });
  });

  describe('Voting', function () {
    let proposalId;

    beforeEach(async function () {
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      const tx = await governance.connect(proposer).createProposal(
        'Test Proposal',
        'Description',
        mockTarget.address,
        callData
      );
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      proposalId = event.args.proposalId;

      // Advance to active state
      await time.increase(1);
    });

    it('Should allow voting for', async function () {
      await governance.connect(voter1).castVote(proposalId, true);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.votesFor).to.equal(ethers.utils.parseEther('10000'));
    });

    it('Should allow voting against', async function () {
      await governance.connect(voter1).castVote(proposalId, false);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.votesAgainst).to.equal(ethers.utils.parseEther('10000'));
    });

    it('Should prevent double voting', async function () {
      await governance.connect(voter1).castVote(proposalId, true);
      
      await expect(
        governance.connect(voter1).castVote(proposalId, true)
      ).to.be.revertedWith('Governance: already voted');
    });

    it('Should update state after voting period', async function () {
      await governance.connect(voter1).castVote(proposalId, true);
      await governance.connect(voter2).castVote(proposalId, true);
      
      // Advance past voting period
      await time.increase(VOTING_PERIOD);
      
      await governance.updateState(proposalId);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.state).to.equal(2); // PASSED
    });
  });

  describe('Quorum', function () {
    let proposalId;

    beforeEach(async function () {
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      const tx = await governance.connect(proposer).createProposal(
        'Test Proposal',
        'Description',
        mockTarget.address,
        callData
      );
      const receipt = await tx.wait();
      proposalId = receipt.events.find(e => e.event === 'ProposalCreated').args.proposalId;
      
      await time.increase(1);
    });

    it('Should pass with quorum', async function () {
      // Vote with enough tokens to reach quorum
      await governance.connect(voter1).castVote(proposalId, true); // 10000 CHIP
      await governance.connect(voter2).castVote(proposalId, true); // 5000 CHIP
      
      await time.increase(VOTING_PERIOD);
      await governance.updateState(proposalId);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.state).to.equal(2); // PASSED
    });

    it('Should fail without quorum', async function () {
      // Vote with only small amount
      await governance.connect(voter3).castVote(proposalId, true); // 3000 CHIP
      
      await time.increase(VOTING_PERIOD);
      await governance.updateState(proposalId);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.state).to.equal(3); // REJECTED
    });
  });

  describe('Proposal Execution', function () {
    let proposalId;

    beforeEach(async function () {
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      const tx = await governance.connect(proposer).createProposal(
        'Test Proposal',
        'Description',
        mockTarget.address,
        callData
      );
      const receipt = await tx.wait();
      proposalId = receipt.events.find(e => e.event === 'ProposalCreated').args.proposalId;
      
      await time.increase(1);
      
      // Vote to pass
      await governance.connect(voter1).castVote(proposalId, true);
      await governance.connect(voter2).castVote(proposalId, true);
      
      await time.increase(VOTING_PERIOD);
      await governance.updateState(proposalId);
    });

    it('Should execute passed proposal', async function () {
      await governance.executeProposal(proposalId);
      
      expect(await mockTarget.value()).to.equal(42);
      
      const proposal = await governance.getProposal(proposalId);
      expect(proposal.state).to.equal(4); // EXECUTED
    });

    it('Should prevent re-execution', async function () {
      await governance.executeProposal(proposalId);
      
      await expect(
        governance.executeProposal(proposalId)
      ).to.be.revertedWith('Governance: not passed');
    });
  });

  describe('View Functions', function () {
    it('Should return voting power', async function () {
      const power = await governance.getVotingPower(voter1.address);
      expect(power).to.equal(ethers.utils.parseEther('10000'));
    });

    it('Should return proposal count', async function () {
      expect(await governance.proposalCount()).to.equal(0);
      
      const callData = mockTarget.interface.encodeFunctionData('setValue', [42]);
      await governance.connect(proposer).createProposal(
        'Test',
        'Desc',
        mockTarget.address,
        callData
      );
      
      expect(await governance.proposalCount()).to.equal(1);
    });
  });
});

// Mock target contract for testing
const MockTargetArtifact = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockTarget {
    uint256 public value;
    
    function setValue(uint256 _value) external {
        value = _value;
    }
}
`;
