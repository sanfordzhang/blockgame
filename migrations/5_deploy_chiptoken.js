const ChipToken = artifacts.require("ChipToken");

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

function getAddressFromPrivateKey(privateKey) {
  const ethUtil = require('ethereumjs-util');
  const crypto = require('crypto');
  const cleanKey = privateKey.replace(/^0x/, '');
  const privateKeyBuffer = Buffer.from(cleanKey, 'hex');
  const publicKeyBuffer = ethUtil.privateToPublic(privateKeyBuffer);
  const hash = ethUtil.keccak256(publicKeyBuffer);
  const addressBytes = hash.slice(-20);
  const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
  const checksum = crypto.createHash('sha256').update(addressWithPrefix).digest();
  const doubleChecksum = crypto.createHash('sha256').update(checksum).digest();
  const addressWithChecksum = Buffer.concat([addressWithPrefix, doubleChecksum.slice(0, 4)]);
  return base58Encode(addressWithChecksum);
}

module.exports = async function(deployer, network) {
  const privateKey = network === 'mainnet'
    ? process.env.MAINNET_PRIVATE_KEY
    : process.env.NILE_PRIVATE_KEY;

  const deployerAddress = getAddressFromPrivateKey(privateKey);
  const initialSupply = '100000000000000000'; // 1 billion CHIP with 6 decimals

  console.log(`Deploying ChipToken to ${network}...`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Initial supply: 1,000,000,000 CHIP`);

  await deployer.deploy(ChipToken, initialSupply);

  const instance = await ChipToken.deployed();
  console.log(`ChipToken deployed at: ${instance.address}`);

  // Save deployment info
  const fs = require('fs');
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentFile = `${deploymentsDir}/${network}.json`;
  let deploymentInfo = {};
  if (fs.existsSync(deploymentFile)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  }

  deploymentInfo.chipTokenContract = instance.address;
  deploymentInfo.chipTokenDeployedAt = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info updated in ${deploymentFile}`);
};
