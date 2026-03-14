/**
 * Test contract deposit directly
 */

const TronService = require('./server/blockchain/TronService');
const ContractService = require('./server/blockchain/ContractService');
const EventListener = require('./server/blockchain/EventListener');

async function testDeposit() {
    console.log('🧪 Testing contract deposit...\n');

    try {
        // Initialize services
        console.log('1️⃣ Initializing TronService...');
        await TronService.init('testnet');

        console.log('2️⃣ Initializing ContractService...');
        ContractService.init(TronService, 'testnet');

        console.log('3️⃣ Initializing EventListener...');
        EventListener.init(TronService, ContractService);
        EventListener.start();

        const contractAddress = ContractService.getContractAddress();
        console.log(`\n✅ Contract: ${contractAddress}\n`);

        // Wait and check for events
        console.log('⏳ Waiting 10 seconds to see polling logs...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log('\n📋 Now please deposit in browser and watch logs above');
        console.log('   Keeping script running for 2 minutes...\n');

        await new Promise(resolve => setTimeout(resolve, 120000));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testDeposit();
