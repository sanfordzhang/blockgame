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

    // Check balance
    const balance = await tronWeb.trx.getBalance(deployer);
    console.log('Balance:', balance / 1e6, 'TRX');

    // Load compiled contract
    const contractJson = JSON.parse(fs.readFileSync('./build/contracts/ChipToken.json', 'utf8'));
    const bytecode = contractJson.bytecode;
    const abi = contractJson.abi;

    // Initial supply: 1 billion CHIP with 6 decimals
    const initialSupply = '100000000000000000';

    console.log('\nDeploying ChipToken...');
    console.log('Initial supply:', initialSupply);

    try {
        // Deploy contract
        const contract = await tronWeb.contract().new({
            abi: abi,
            bytecode: bytecode,
            parameters: [initialSupply],
            feeLimit: 1000 * 1e6, // 1000 TRX
            callValue: 0,
            userFeePercentage: 100,
            originEnergyLimit: 10_000_000
        });

        console.log('\n✅ ChipToken deployed successfully!');
        console.log('Contract address:', contract.address);

        // Save to deployment file
        const deploymentInfo = {
            chipTokenContract: contract.address,
            chipTokenDeployedAt: new Date().toISOString(),
            deployer: deployer
        };

        fs.writeFileSync('./deployments/nile.json', JSON.stringify(deploymentInfo, null, 2));
        console.log('\nDeployment info saved to deployments/nile.json');

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        if (error.output) {
            console.error('Output:', error.output);
        }
    }
}

main().catch(console.error);
