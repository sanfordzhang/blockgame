const BridgeGameV1 = artifacts.require("BridgeGameV1");

module.exports = async function(deployer, network) {
  // Initial rake rate: 2.5% = 250 basis points
  const initialRakeRate = 250;
  
  console.log(`Deploying BridgeGameV1 to ${network}...`);
  console.log(`Initial rake rate: ${initialRakeRate} basis points (2.5%)`);
  
  await deployer.deploy(BridgeGameV1, initialRakeRate);
  
  const instance = await BridgeGameV1.deployed();
  console.log(`BridgeGameV1 deployed at: ${instance.address}`);
  console.log(`Owner: ${await instance.owner()}`);
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: network,
    address: instance.address,
    deployTx: instance.transactionHash,
    initialRakeRate: initialRakeRate,
    deployedAt: new Date().toISOString()
  };
  
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    `${deploymentsDir}/${network}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`Deployment info saved to ${deploymentsDir}/${network}.json`);
};
