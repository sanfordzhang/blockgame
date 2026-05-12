const axios = require('axios');

async function test() {
    const url = 'http://localhost:7777/api/nft/metadata/6/10';
    console.log('Testing:', url);
    const res = await axios.get(url);
    console.log('\nAttributes:');
    res.data.attributes.forEach(a => {
        console.log(`  ${a.trait_type}: ${a.value}`);
    });
}

test().catch(console.error);
