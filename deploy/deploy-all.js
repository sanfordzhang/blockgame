const { TronWeb } = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

async function main() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    const deployer = tronWeb.address.fromPrivateKey(process.env.NILE_PRIVATE_KEY);
    console.log('Deployer:', deployer);

    // Load existing deployment info
    const deploymentFile = './deployments/nile.json';
    let deploymentInfo = {};
    if (fs.existsSync(deploymentFile)) {
        deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    }

    const chipTokenAddress = deploymentInfo.chipTokenContract;
    console.log('ChipToken address:', chipTokenAddress);

    // 1. Deploy Tournament
    console.log('\n========== Deploying Tournament ==========');
    const tournamentJson = JSON.parse(fs.readFileSync('./build/contracts/Tournament.json', 'utf8'));
    
    try {
        const tournament = await tronWeb.contract().new({
            abi: tournamentJson.abi,
            bytecode: tournamentJson.bytecode,
            parameters: [deployer, chipTokenAddress],
            feeLimit: 2000 * 1e6,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000
        });
        console.log('✅ Tournament deployed:', tournament.address);
        deploymentInfo.tournamentContract = tournament.address;
        deploymentInfo.tournamentDeployedAt = new Date().toISOString();
    } catch (error) {
        console.error('❌ Tournament failed:', error.message);
    }

    // 2. Deploy Staking
    console.log('\n========== Deploying Staking ==========');
    const stakingJson = JSON.parse(fs.readFileSync('./build/contracts/Staking.json', 'utf8'));
    
    try {
        const staking = await tronWeb.contract().new({
            abi: stakingJson.abi,
            bytecode: stakingJson.bytecode,
            parameters: [chipTokenAddress],
            feeLimit: 1000 * 1e6,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000
        });
        console.log('✅ Staking deployed:', staking.address);
        deploymentInfo.stakingContract = staking.address;
        deploymentInfo.stakingDeployedAt = new Date().toISOString();
    } catch (error) {
        console.error('❌ Staking failed:', error.message);
    }

    // 3. Deploy Governance
    console.log('\n========== Deploying Governance ==========');
    const governanceJson = JSON.parse(fs.readFileSync('./build/contracts/Governance.json', 'utf8'));
    
    const votingPeriod = 3 * 24 * 60 * 60; // 3 days
    const proposalThreshold = '100000000000'; // 1000 CHIP with 6 decimals
    const quorumNumerator = 100; // 10%
    
    try {
        const governance = await tronWeb.contract().new({
            abi: governanceJson.abi,
            bytecode: governanceJson.bytecode,
            parameters: [chipTokenAddress, votingPeriod, proposalThreshold, quorumNumerator],
            feeLimit: 1500 * 1e6,
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000
        });
        console.log('✅ Governance deployed:', governance.address);
        deploymentInfo.governanceContract = governance.address;
        deploymentInfo.governanceDeployedAt = new Date().toISOString();
    } catch (error) {
        console.error('❌ Governance failed:', error.message);
    }

    // Save deployment info
    deploymentInfo.lastDeploymentAt = new Date().toISOString();
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log('\n========== Deployment Summary ==========');
    console.log(JSON.stringify(deploymentInfo, null, 2));
}

main().catch(console.error);
