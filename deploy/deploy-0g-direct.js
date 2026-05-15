/**
 * Deploy PokerGame0G with leaveTableSession to 0G testnet
 * Uses ethers v6 directly (bypasses hardhat-ethers Node.js v24 issue)
 *
 * Usage: ENV_FILE=.env.0g node deploy-0g-direct.js
 */

const ethers = require('ethers6');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || '.env.0g' });

// Read compiled artifact
const artifactPath = path.join(__dirname, '..', 'artifacts/contracts/0g/PokerGame0G.sol/PokerGame0G.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    console.log('='.repeat(60));
    console.log('Deploying PokerGame0G (with leaveTableSession) to 0G...');
    console.log('='.repeat(60));

    const RPC_URL = process.env.ZEROG_RPC_URL;
    const PRIVATE_KEY = process.env.ZEROG_PRIVATE_KEY;
    const SERVER_WALLET = process.env.ZEROG_SERVER_WALLET;

    if (!RPC_URL || !PRIVATE_KEY) {
        console.error('Missing ZEROG_RPC_URL or ZEROG_PRIVATE_KEY in .env.0g');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), '0G');

    if (balance === 0n) {
        console.error('ERROR: Deployer has 0 balance! Fund it first.');
        process.exit(1);
    }

    // Deploy
    console.log('\n[1] Deploying PokerGame0G...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(wallet.address); // feeRecipient = deployer
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log('✅ PokerGame0G deployed to:', address);

    // Grant OPERATOR_ROLE to server wallet
    if (SERVER_WALLET && SERVER_WALLET.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`\n[2] Granting OPERATOR_ROLE to ${SERVER_WALLET}...`);
        const OPERATOR_ROLE = await contract.OPERATOR_ROLE();
        const tx = await contract.grantRole(OPERATOR_ROLE, SERVER_WALLET);
        await tx.wait();
        console.log('✅ OPERATOR_ROLE granted');
    }

    // Verify leaveTableSession exists
    console.log('\n[3] Verifying leaveTableSession method...');
    const code = contract.interface.getFunction('leaveTableSession(uint256,uint256)') ? 'leaveTableSession' : null;
    if (code) {
        console.log('✅ leaveTableSession method confirmed in ABI');
    }

    // Save deployment info
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const info = {
        network: 'zerogTestnet',
        chainId: 16602,
        deployedAt: new Date().toISOString(),
        contracts: {
            PokerGame0G: { address },
            features: ['deposit', 'withdraw', 'joinTableFor', 'leaveTableFor', 'settleTournament', 'leaveTableSession', 'authorizeDelegate', 'executeDepositFor']
        }
    };

    const outFile = path.join(deploymentsDir, 'zerog-testnet-latest.json');
    fs.writeFileSync(outFile, JSON.stringify(info, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(JSON.stringify(info, null, 2));
    console.log('\n⚠️  Update your .env.0g:');
    console.log(`   ZEROG_POKERGAME_ADDRESS=${address}`);
    console.log('='.repeat(60));

    return address;
}

main()
    .then(addr => { console.log('\nDone! Contract at:', addr); process.exit(0); })
    .catch(err => { console.error('❌ Deployment failed:', err.message); process.exit(1); });
