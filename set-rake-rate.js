const { TronWeb } = require('tronweb');
require('dotenv').config();

const CONTRACT_ADDRESS = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';
const NEW_RAKE_RATE = 1000; // 10%

async function setRakeRate() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    console.log('🔧 Setting rake rate to 10% (1000 basis points)...');
    console.log('Contract:', CONTRACT_ADDRESS);

    try {
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);

        const tx = await contract.setRakeRate(NEW_RAKE_RATE).send({
            feeLimit: 100_000_000,
            shouldPollResponse: true
        });

        console.log('✅ Rake rate updated!');
        console.log('Transaction:', tx);

        // Verify
        const currentRate = await contract.rakeRate().call();
        console.log('Current rake rate:', currentRate.toString(), 'basis points');
        console.log('Percentage:', (currentRate / 100).toString() + '%');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

setRakeRate();
