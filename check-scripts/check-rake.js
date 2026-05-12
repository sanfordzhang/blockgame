const { TronWeb } = require('tronweb');
require('dotenv').config();

const CONTRACT_ADDRESS = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

async function checkRake() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    console.log('📊 查询抽水记录...');
    console.log('合约地址:', CONTRACT_ADDRESS);
    console.log('');

    try {
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);

        // 查询累积抽水
        const accumulatedRake = await contract.accumulatedRake().call();
        const rakeInTRX = Number(accumulatedRake) / 1e6;

        console.log('💰 累积抽水总额:', rakeInTRX, 'TRX');
        console.log('   (原始值:', accumulatedRake.toString(), 'SUN)');
        console.log('');

        // 查询抽水比例
        const rakeRate = await contract.rakeRate().call();
        console.log('📈 当前抽水比例:', Number(rakeRate) / 100, '%');
        console.log('');

        // 查询抽水接收地址
        const rakeRecipient = await contract.rakeRecipient().call();
        const recipientBase58 = tronWeb.address.fromHex(rakeRecipient);
        console.log('🏦 抽水接收地址:', recipientBase58);
        console.log('');

        // 查询 RakeCollected 事件
        console.log('📜 查询最近的抽水事件...');

        const result = await tronWeb.getEventResult(CONTRACT_ADDRESS, {
            eventName: 'RakeCollected',
            size: 20
        });

        const events = result.data || [];

        if (events.length > 0) {
            console.log(`找到 ${events.length} 条抽水记录：`);
            console.log('');

            let totalRake = 0;
            events.forEach((event, index) => {
                const player = tronWeb.address.fromHex('41' + event.result.player.slice(2));
                const rakeAmount = Number(event.result.rakeAmount) / 1e6;
                const recipient = tronWeb.address.fromHex('41' + event.result.recipient.slice(2));

                totalRake += rakeAmount;

                console.log(`${index + 1}. 玩家: ${player}`);
                console.log(`   抽水: ${rakeAmount} TRX`);
                console.log(`   接收: ${recipient}`);
                console.log(`   时间: ${new Date(event.timestamp).toLocaleString('zh-CN')}`);
                console.log('');
            });

            console.log('✅ 总抽水金额:', totalRake.toFixed(6), 'TRX');
        } else {
            console.log('暂无抽水记录');
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

checkRake();
