const BridgeGameV1 = artifacts.require("BridgeGameV1");

// Base58 alphabet
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result += ALPHABET[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }
  return result;
}

// Helper function to derive TRON address from private key
function getAddressFromPrivateKey(privateKey) {
  const ethUtil = require('ethereumjs-util');
  const crypto = require('crypto');
  
  // Remove 0x prefix if present
  const cleanKey = privateKey.replace(/^0x/, '');
  
  // Derive public key
  const privateKeyBuffer = Buffer.from(cleanKey, 'hex');
  const publicKeyBuffer = ethUtil.privateToPublic(privateKeyBuffer);
  
  // Take last 20 bytes of keccak256 hash of public key
  const hash = ethUtil.keccak256(publicKeyBuffer);
  const addressBytes = hash.slice(-20);
  
  // Add TRON prefix (0x41)
  const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
  
  // Add checksum
  const checksum = crypto.createHash('sha256').update(addressWithPrefix).digest();
  const doubleChecksum = crypto.createHash('sha256').update(checksum).digest();
  const addressWithChecksum = Buffer.concat([addressWithPrefix, doubleChecksum.slice(0, 4)]);
  
  return base58Encode(addressWithChecksum);
}

module.exports = async function(deployer, network) {
  // Initial rake rate: 2.5% = 250 basis points
  const initialRakeRate = 250;
  
  // Get owner address from private key
  const privateKey = process.env.NILE_PRIVATE_KEY;
  const initialOwner = getAddressFromPrivateKey(privateKey);
  
  console.log(`Deploying BridgeGameV1 to ${network}...`);
  console.log(`Initial rake rate: ${initialRakeRate} basis points (2.5%)`);
  console.log(`Initial owner: ${initialOwner}`);
  
  await deployer.deploy(BridgeGameV1, initialRakeRate, initialOwner);
  
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
    owner: initialOwner,
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
