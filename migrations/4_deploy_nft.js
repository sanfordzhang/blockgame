const AchievementNFT = artifacts.require("AchievementNFT");

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
  const signerAddress = getAddressFromPrivateKey(serverPrivateKey);
  const baseURI = process.env.NFT_BASE_URI || 'https://api.example.com/nft/';

  console.log(`Deploying AchievementNFT to ${network}...`);
  console.log(`Signer address: ${signerAddress}`);
  console.log(`Base URI: ${baseURI}`);

  await deployer.deploy(AchievementNFT, signerAddress, baseURI);

  const instance = await AchievementNFT.deployed();
  console.log(`AchievementNFT deployed at: ${instance.address}`);

  // Save deployment info
  const fs = require('fs');
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentFile = `${deploymentsDir}/${network}.json`;
  let deploymentInfo = {};
  if (fs.existsSync(deploymentFile)) {
    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  }

  deploymentInfo.nftContract = instance.address;
  deploymentInfo.nftDeployedAt = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info updated in ${deploymentFile}`);
};
