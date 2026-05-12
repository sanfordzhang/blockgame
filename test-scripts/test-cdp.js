const CDP = require('chrome-remote-interface');

async function test() {
    try {
        const client = await CDP({ port: 9222 });
        console.log('✅ CDP connected');
        await client.close();
    } catch (e) {
        console.log('❌ CDP error:', e.message);
    }
}

test();
