/**
 * 检查注入流动性的详细情况
 */
const { TronWeb } = require('tronweb');

const POOL_ADDRESS = 'TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v';
const ROUTER_ADDRESS = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
const CHIP_TOKEN = 'TFWScXGFALnK9D79zf5Jrnw5on7aqJiaY3';
const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});
tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

async function debug() {
    console.log('=== 流动性注入调试 ===\n');
    
    try {
        const poolContract = await tronWeb.contract().at(POOL_ADDRESS);
        const chipContract = await tronWeb.contract().at(CHIP_TOKEN);
        
        // 1. Pool 储备量
        const reserves = await poolContract.getReserves().call();
        const reserveTRX = parseInt(reserves[0].toString()) / 1e6;
        const reserveCHIP = parseInt(reserves[1].toString()) / 1e6;
        
        console.log('--- Pool 储备量 ---');
        console.log(`TRX: ${reserveTRX.toFixed(4)}`);
        console.log(`CHIP: ${reserveCHIP.toFixed(4)}\n`);
        
        // 2. LP Token 余额
        const totalSupply = await poolContract.totalSupply().call();
        const player1LP = await poolContract.balanceOf(PLAYER1).call();
        const deployerLP = await poolContract.balanceOf('TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA').call();
        
        console.log('--- LP Token ---');
        console.log(`Total Supply: ${(parseInt(totalSupply.toString()) / 1e8).toFixed(4)}`);
        console.log(`PLAYER1: ${(parseInt(player1LP.toString()) / 1e8).toFixed(4)}`);
        console.log(`Deployer: ${(parseInt(deployerLP.toString()) / 1e8).toFixed(4)}\n`);
        
        // 3. PLAYER1 的 CHIP 余额
        const player1CHIP = await chipContract.balanceOf(PLAYER1).call();
        const player1TRX = await tronWeb.trx.getBalance(PLAYER1);
        
        console.log('--- PLAYER1 余额 ---');
        console.log(`TRX: ${(parseInt(player1TRX) / 1e6).toFixed(4)}`);
        console.log(`CHIP: ${(parseInt(player1CHIP.toString()) / 1e6).toFixed(4)}\n`);
        
        // 4. 检查最近的交易
        console.log('--- 查看 TronScan ---');
        console.log('PLAYER1 交易记录:');
        console.log(`https://nile.tronscan.org/#/address/${PLAYER1}/transfers\n`);
        
        // 5. 计算 LP Token
        console.log('--- LP Token 计算 ---');
        const player1LPRaw = parseInt(player1LP.toString());
        const totalSupplyRaw = parseInt(totalSupply.toString());
        
        if (player1LPRaw > 0) {
            const share = (player1LPRaw / totalSupplyRaw) * 100;
            const trxShare = reserveTRX * (player1LPRaw / totalSupplyRaw);
            const chipShare = reserveCHIP * (player1LPRaw / totalSupplyRaw);
            
            console.log(`PLAYER1 占比: ${share.toFixed(2)}%`);
            console.log(`对应 TRX: ${trxShare.toFixed(4)}`);
            console.log(`对应 CHIP: ${chipShare.toFixed(4)}\n`);
        }
        
        // 6. 分析
        console.log('--- 分析 ---');
        if (reserveTRX < 530) {
            console.log('⚠️ TRX 储备量没怎么增加，新注入可能失败或未确认');
            console.log('   请检查 TronLink 交易是否成功');
            console.log(`   或者访问: https://nile.tronscan.org/#/address/${PLAYER1}`);
        } else {
            console.log('✅ TRX 储备量已增加');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debug();
