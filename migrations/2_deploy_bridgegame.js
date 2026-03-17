const BridgeGameV2 = artifacts.require("BridgeGameV2");

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
  const initialRakeRate = 250; // 2.5%

  // Pick private key based on network
  const privateKey = network === 'mainnet'
    ? process.env.MAINNET_PRIVATE_KEY
    : process.env.NILE_PRIVATE_KEY;

  // rakeRecipient = server wallet (set via env, fallback to deployer)
  const serverPrivateKey = process.env.SERVER_PRIVATE_KEY || privateKey;
  const rakeRecipient = getAddressFromPrivateKey(serverPrivateKey);
  const deployerAddress = getAddressFromPrivateKey(privateKey);

  console.log(`Deploying BridgeGameV2 to ${network}...`);
  console.log(`Rake rate: ${initialRakeRate} basis points (2.5%)`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Rake recipient (server wallet): ${rakeRecipient}`);

  await deployer.deploy(BridgeGameV2, initialRakeRate, rakeRecipient);

  const instance = await BridgeGameV2.deployed();
  console.log(`BridgeGameV2 deployed at: ${instance.address}`);

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network,
    address: instance.address,
    deployTx: instance.transactionHash,
    initialRakeRate,
    deployer: deployerAddress,
    rakeRecipient,
    deployedAt: new Date().toISOString()
  };

  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  fs.writeFileSync(
    `${deploymentsDir}/${network}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`Deployment info saved to ${deploymentsDir}/${network}.json`);
  console.log(`\nNext steps:`);
  console.log(`1. Update .env: MAINNET_CONTRACT_ADDRESS=${instance.address}`);
  console.log(`2. Call setTableOwner(1, SERVER_WALLET_ADDRESS) on the contract`);
};
