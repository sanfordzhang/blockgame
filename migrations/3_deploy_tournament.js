const Tournament = artifacts.require("Tournament");

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

  const serverPrivateKey = process.env.SERVER_PRIVATE_KEY || privateKey;
  const serverWallet = getAddressFromPrivateKey(serverPrivateKey);
  const chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS || 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'; // Placeholder

  console.log(`Deploying Tournament to ${network}...`);
  console.log(`Server wallet: ${serverWallet}`);
  console.log(`CHIP Token address: ${chipTokenAddress}`);

  await deployer.deploy(Tournament, serverWallet, chipTokenAddress);

  const instance = await Tournament.deployed();
  console.log(`Tournament deployed at: ${instance.address}`);

  // Save deployment info
  const fs = require('fs');
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentFile = `${deploymentsDir}/${network}.json`;
  let deploymentInfo = {};
  if (fs.existsSync(deploymentFile)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  }

  deploymentInfo.tournamentContract = instance.address;
  deploymentInfo.tournamentDeployedAt = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info updated in ${deploymentFile}`);
};
