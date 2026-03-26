const Staking = artifacts.require("Staking");
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

  console.log(`Deploying Staking to ${network}...`);
  console.log(`CHIP Token address: ${chipTokenAddress}`);

  await deployer.deploy(Staking, chipTokenAddress);

  const instance = await Staking.deployed();
  console.log(`Staking deployed at: ${instance.address}`);

  // Save deployment info
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  let deploymentInfo = {};
  if (fs.existsSync(deploymentFile)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  }

  deploymentInfo.stakingContract = instance.address;
  deploymentInfo.stakingDeployedAt = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info updated in ${deploymentFile}`);
};
