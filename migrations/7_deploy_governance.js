const Governance = artifacts.require("Governance");
const ChipToken = artifacts.require("ChipToken");

const fs = require('fs');

module.exports = async function(deployer, network) {
  // Get ChipToken address from deployment file
  const deploymentsDir = './deployments';
  const deploymentFile = `${deploymentsDir}/${network}.json`;
  
  let chipTokenAddress;
  if (fs.existsSync(deploymentFile)) {
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    chipTokenAddress = deploymentInfo.chipTokenContract;
  }

  if (!chipTokenAddress) {
    console.log('ChipToken address not found in deployment file, using env or placeholder');
    chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS || 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
  }

  // Governance parameters
  const votingPeriod = 3 * 24 * 60 * 60; // 3 days in seconds
  const proposalThreshold = '100000000000'; // 1000 CHIP with 6 decimals
  const quorumNumerator = 100; // 10% (100/1000)

  console.log(`Deploying Governance to ${network}...`);
  console.log(`CHIP Token address: ${chipTokenAddress}`);
  console.log(`Voting period: 3 days`);
  console.log(`Proposal threshold: 1000 CHIP`);
  console.log(`Quorum: 10%`);

  await deployer.deploy(Governance, chipTokenAddress, votingPeriod, proposalThreshold, quorumNumerator);

  const instance = await Governance.deployed();
  console.log(`Governance deployed at: ${instance.address}`);

  // Save deployment info
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  let deploymentInfo = {};
  if (fs.existsSync(deploymentFile)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  }

  deploymentInfo.governanceContract = instance.address;
  deploymentInfo.governanceDeployedAt = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info updated in ${deploymentFile}`);
};
