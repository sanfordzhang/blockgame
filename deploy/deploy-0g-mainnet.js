/**
 * Deploy 0G Smart Contracts to Mainnet (Direct ethers v6, bypasses Hardhat Node.js v24 issue)
 *
 * Deploys:
 *   1. PokerGame0G.sol - Game contract with AccessControl
 *   2. PokerHandINFT.sol - ERC-7857 Interactive NFT
 *   3. Role grants: OPERATOR -> server wallet, MINTER -> PokerGame0G
 *
 * Usage:
 *   ENV_FILE=.env.0g node deploy/deploy-0g-mainnet.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || '.env.0g' });

// Use ethers v6 (installed as 'ethers6')
let ethers;
try {
    ethers = require('ethers6');
} catch {
    // Fallback to ethers v6 if installed as default
    ethers = require('ethers');
}

async function loadArtifact(name) {
    const artifactPath = path.join(__dirname, '..', `artifacts/contracts/0g/${name}.sol/${name}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found: ${artifactPath}. Run npx hardhat compile first.`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

async function main() {
    console.log('='.repeat(60));
    console.log('Deploying 0G Smart Contracts to MAINNET');
    console.log('='.repeat(60));

    const RPC_URL = process.env.ZEROG_MAINNET_RPC_URL || 'https://evmrpc.0g.ai';
    const PRIVATE_KEY = process.env.ZEROG_MAINNET_PRIVATE_KEY || process.env.ZEROG_PRIVATE_KEY;
    const SERVER_WALLET = process.env.ZEROG_SERVER_WALLET;

    if (!PRIVATE_KEY) {
        throw new Error('Missing ZEROG_MAINNET_PRIVATE_KEY in .env.0g');
    }

    // Connect to 0G Mainnet
    console.log('\nConnecting to 0G Mainnet:', RPC_URL);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Verify network
    const network = await provider.getNetwork();
    console.log('Network:', network.name, '| Chain ID:', Number(network.chainId));

    if (Number(network.chainId) !== 16661) {
        throw new Error(`Expected Chain ID 16661, got ${network.chainId}`);
    }

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('\nDeployer:', wallet.address);
    console.log('Balance:', ethers.formatEther(balance), '0G');

    if (balance < ethers.parseEther('0.001')) {
        throw new Error(`Insufficient balance! Need >= 0.001 0G, have ${ethers.formatEther(balance)} 0G`);
    }

    // ========== Deploy PokerGame0G ==========
    console.log('\n--- [1/4] Deploying PokerGame0G ---');
    const pgArtifact = await loadArtifact('PokerGame0G');
    const pgFactory = new ethers.ContractFactory(pgArtifact.abi, pgArtifact.bytecode, wallet);

    console.log('Sending deployment transaction...');
    const pokerGame = await pgFactory.deploy(wallet.address); // initial admin = deployer
    console.log('Tx hash:', pokerGame.deploymentTransaction()?.hash || 'pending...');

    console.log('Waiting for confirmation...');
    await pokerGame.waitForDeployment();
    const pokerGameAddress = await pokerGame.getAddress();
    console.log('✅ PokerGame0G deployed to:', pokerGameAddress);

    // ========== Deploy PokerHandINFT ==========
    console.log('\n--- [2/4] Deploying PokerHandINFT ---');
    const inftArtifact = await loadArtifact('PokerHandINFT');
    const inftFactory = new ethers.ContractFactory(inftArtifact.abi, inftArtifact.bytecode, wallet);

    console.log('Sending deployment transaction...');
    const inft = await inftFactory.deploy(); // no constructor args

    console.log('Waiting for confirmation...');
    await inft.waitForDeployment();
    const inftAddress = await inft.getAddress();
    console.log('✅ PokerHandINFT deployed to:', inftAddress);

    // ========== Grant OPERATOR_ROLE on PokerGame0G ==========
    console.log('\n--- [3/4] Setting up Roles ---');

    const OPERATOR_ROLE = await pokerGame.OPERATOR_ROLE();
    const targetOperator = SERVER_WALLET || wallet.address;

    if (targetOperator.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`Granting OPERATOR_ROLE to ${targetOperator}...`);
        const opTx = await pokerGame.grantRole(OPERATOR_ROLE, targetOperator);
        await opTx.wait();
        console.log('✅ OPERATOR_ROLE granted to', targetOperator);
    } else {
        console.log('OPERATOR_ROLE: Deployer is server wallet (already has role)');
    }

    // ========== Grant MINTER_ROLE on PokerHandINFT ==========
    const MINTER_ROLE = await inft.MINTER_ROLE();
    console.log(`Granting MINTER_ROLE to PokerGame0G (${pokerGameAddress})...`);
    const mintTx = await inft.grantRole(MINTER_ROLE, pokerGameAddress);
    await mintTx.wait();
    console.log('✅ MINTER_ROLE granted to', pokerGameAddress);

    // ========== Save Deployment Record ==========
    console.log('\n--- [4/4] Saving deployment record ---');

    const deploymentInfo = {
        network: 'zerogMainnet',
        chainId: Number(network.chainId),
        deployer: wallet.address,
        deployedAt: new Date().toISOString(),
        rpcUrl: RPC_URL,
        contracts: {
            PokerGame0G: {
                address: pokerGameAddress,
                txHash: pokerGame.deploymentTransaction()?.hash || 'unknown',
                abiHash: require('crypto').createHash('sha256').update(JSON.stringify(pgArtifact.abi)).digest('hex').slice(0, 16)
            },
            PokerHandINFT: {
                address: inftAddress,
                txHash: inft.deploymentTransaction()?.hash || 'unknown',
                abiHash: require('crypto').createHash('sha256').update(JSON.stringify(inftArtifact.abi)).digest('hex').slice(0, 16)
            }
        },
        roles: {
            ADMIN: wallet.address,
            OPERATOR: targetOperator,
            MINTER: pokerGameAddress
        }
    };

    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    const outFile = path.join(deploymentsDir, 'zerog-zerogMainnet.json');
    fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Saved to:', outFile);

    // ========== Summary ==========
    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUMMARY - 0G MAINNET');
    console.log('='.repeat(60));
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log('\n⚠️  Update .env.0g:');
    console.log(`   ZEROG_POKERGAME_ADDRESS=${pokerGameAddress}`);
    console.log(`   ZEROG_INFT_ADDRESS=${inftAddress}`);
    console.log('\n🔗 Explorer links:');
    console.log(`   PokerGame0G: https://chainscan.0g.ai/address/${pokerGameAddress}`);
    console.log(`   PokerHandINFT: https://chainscan.0g.ai/address/${inftAddress}`);
    console.log('='.repeat(60));

    return deploymentInfo;
}

main()
    .then(info => { console.log('\n✅ Mainnet deployment complete!'); process.exit(0); })
    .catch(err => { console.error('\n❌ Deployment failed:', err.message); process.exit(1); });
