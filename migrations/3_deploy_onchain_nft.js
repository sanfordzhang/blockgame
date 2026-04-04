const AchievementNFTOnChain = artifacts.require("AchievementNFTOnChain");

module.exports = function(deployer, network, accounts) {
  const signerAddress = process.env.NFT_SIGNER_ADDRESS || accounts[0];
  console.log('Deploying with signer:', signerAddress);
  deployer.deploy(AchievementNFTOnChain, signerAddress);
};
