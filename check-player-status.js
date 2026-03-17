const { TronWeb } = require('tronweb');
require('dotenv').config();

const CONTRACT_ADDRESS = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

async function checkPlayerStatus() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    console.log('👤 查询玩家状态...');
    console.log('');

    // 输入玩家地址（从之前的日志中看到的）
    const playerAddress = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

    try {
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        const playerInfo = await contract.getPlayerInfo(playerAddress).call();

        const balance = Number(playerInfo.balance) / 1e6;
        const locked = Number(playerInfo.lockedAmount) / 1e6;
        const isRegistered = playerInfo.isRegistered;

        console.log('玩家地址:', playerAddress);
        console.log('注册状态:', isRegistered ? '✅ 已注册' : '❌ 未注册');
        console.log('可用余额:', balance, 'TRX');
        console.log('锁定金额:', locked, 'TRX');
        console.log('');

        if (locked > 0) {
            console.log('💡 玩家还在桌子上，资金已锁定');
            console.log('   需要点击 "Leave" 按钮离开桌子才会结算抽水');
        } else if (balance > 0) {
            console.log('✅ 玩家已离开桌子，余额已返还');
        } else {
            console.log('⚠️  玩家余额为 0');
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

checkPlayerStatus();
