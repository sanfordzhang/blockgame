/**
 * Deploy 0G Smart Contracts Script
 * Deploys PokerGame0G.sol and PokerHandINFT.sol to 0G testnet/mainnet
 *
 * Usage:
 *   ENV_FILE=.env.0g npx hardhat run deploy-0g.js --network zerogTestnet
 *   ENV_FILE=.env.0g npx hardhat run deploy-0g.js --network zerogMainnet
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('='.repeat(60));
    console.log('Deploying 0G Poker Smart Contracts...');
    console.log('Network:', hre.network.name);
    console.log('Chain ID:', (await hre.ethers.provider.getNetwork()).chainId);
    console.log('='.repeat(60));

    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    
    console.log('\nDeployer:', deployer.address);
    console.log('Balance:', hre.ethers.formatEther(balance), 'ETH\n');

    // ========== 1. Deploy PokerGame0G ==========
    console.log('[1/2] Deploying PokerGame0G...');
    const PokerGame0G = await hre.ethers.getContractFactory("PokerGame0G");
    const pokerGame = await PokerGame0G.deploy(deployer.address); // deployer = initial admin
    await pokerGame.waitForDeployment();
    const pokerGameAddress = await pokerGame.getAddress();
    console.log('✅ PokerGame0G deployed to:', pokerGameAddress);

    // ========== 2. Deploy PokerHandINFT ==========
    console.log('[2/2] Deploying PokerHandINFT...');
    const PokerHandINFT = await hre.ethers.getContractFactory("PokerHandINFT");
    const inft = await PokerHandINFT.deploy(); // constructor takes no args (ERC721 name/symbol hardcoded)
    await inft.waitForDeployment();
    const inftAddress = await inft.getAddress();
    console.log('✅ PokerHandINFT deployed to:', inftAddress);

    // ========== 3. Setup Roles ==========
    console.log('\n--- Setting up roles ---');

    // Grant OPERATOR_ROLE on PokerGame0G to server wallet
    const OPERATOR_ROLE = await pokerGame.OPERATOR_ROLE();
    const serverWallet = process.env.ZEROG_SERVER_WALLET || deployer.address;
    
    if (serverWallet.toLowerCase() !== deployer.address.toLowerCase()) {
        console.log(`Granting OPERATOR_ROLE to ${serverWallet}...`);
        await pokerGame.grantRole(OPERATOR_ROLE, serverWallet);
        console.log('✅ OPERATOR_ROLE granted');
    }

    // Grant MINTER_ROLE on PokerHandINFT to PokerGame0G contract
    const MINTER_ROLE = await inft.MINTER_ROLE();
    console.log(`Granting MINTER_ROLE to PokerGame0G (${pokerGameAddress})...`);
    await inft.grantRole(MINTER_ROLE, pokerGameAddress);
    console.log('✅ MINTER_ROLE granted');

    // ========== 4. Save Deployment Info ==========
    const deploymentInfo = {
        network: hre.network.name,
        chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        contracts: {
            PokerGame0G: {
                address: pokerGameAddress,
                txHash: pokerGame.deploymentTransaction()?.hash || 'unknown'
            },
            PokerHandINFT: {
                address: inftAddress,
                txHash: inft.deploymentTransaction()?.hash || 'unknown'
            }
        },
        roles: {
            ADMIN: deployer.address,
            OPERATOR: serverWallet,
            MINTER: pokerGameAddress
        }
    };

    // Save to deployments directory
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const outFile = path.join(deploymentsDir, `zerog-${hre.network.name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log('\nSaved to:', outFile);
    console.log('\n⚠️  Update your .env.0g file with:');
    console.log(`   ZEROG_POKERGAME_ADDRESS=${pokerGameAddress}`);
    console.log(`   ZEROG_INFT_ADDRESS=${inftAddress}`);
    console.log('='.repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    });
