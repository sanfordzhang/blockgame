require('./server/config/loadEnv')();
const TronService = require('./server/blockchain/TronService');
const ContractService = require('./server/blockchain/ContractService');

async function testEventFetch() {
    console.log('🧪 Testing event fetch...\n');

    await TronService.init('testnet');
    ContractService.init(TronService, 'testnet');

    const tronWeb = TronService.getTronWeb();
    const contractAddress = ContractService.getContractAddress();

    console.log('Contract:', contractAddress);
    console.log('\n1️⃣ Testing getEventResult()...');

    try {
        const events = await tronWeb.getEventResult(contractAddress, {
            size: 20
        });

        console.log('Raw result:', typeof events, events);

        if (Array.isArray(events) && events.length > 0) {
            console.log('\n✅ Found', events.length, 'events:');
            events.forEach((e, i) => {
                console.log(`${i + 1}. ${e.name} - Block: ${e.block}`);
            });
            console.log('\nLatest event:');
            console.log(JSON.stringify(events[0], null, 2));
        } else {
            console.log('\n⚠️  No events found or invalid response');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEventFetch().catch(console.error);
