/**
 * 分析 LP Token 计算和持有者问题
 */
const { TronWeb } = require('tronweb');

// 配置
const POOL_ADDRESS = 'TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v';
const CHIP_TOKEN = 'TFWScXGFALnK9D79zf5Jrnw5on7aqJiaY3';
const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2 = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const DEPLOYER = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});
tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

async function analyze() {
    console.log('=== LP Token 分析 ===\n');
    
    try {
        const poolContract = await tronWeb.contract().at(POOL_ADDRESS);
        
        // 1. 查询储备量（原始值）
        const reserves = await poolContract.getReserves().call();
        const reserveTRXRaw = reserves[0].toString();
        const reserveCHIPRaw = reserves[1].toString();
        
        console.log('--- 储备量（原始值）---');
        console.log(`TRX Reserve (raw): ${reserveTRXRaw}`);
        console.log(`CHIP Reserve (raw): ${reserveCHIPRaw}`);
        
        // 2. 查询 totalSupply（原始值）
        const totalSupplyResult = await poolContract.totalSupply().call();
        const totalSupplyRaw = totalSupplyResult._hex || totalSupplyResult.toString();
        const totalSupplyNum = parseInt(totalSupplyRaw);
        
        console.log('\n--- LP Token 总供应量 ---');
        console.log(`Total Supply (raw hex): ${totalSupplyRaw}`);
        console.log(`Total Supply (number): ${totalSupplyNum}`);
        console.log(`Total Supply (human, 18 decimals): ${(totalSupplyNum / 1e18).toFixed(18)}`);
        
        // 3. 计算 sqrt(TRX * CHIP)
        const sqrtK = Math.sqrt(BigInt(reserveTRXRaw) * BigInt(reserveCHIPRaw));
        console.log('\n--- 计算验证 ---');
        console.log(`sqrt(TRX * CHIP) ≈ ${sqrtK.toString()}`);
        console.log(`LP Token 应该 ≈ sqrt - 1000 = ${(sqrtK - 1000n).toString()}`);
        
        // 4. 检查 LP Token 持有者
        console.log('\n--- LP Token 持有者 ---');
        
        const balanceDeployer = await poolContract.balanceOf(DEPLOYER).call();
        const balancePlayer1 = await poolContract.balanceOf(PLAYER1).call();
        const balancePlayer2 = await poolContract.balanceOf(PLAYER2).call();
        const balanceZero = await poolContract.balanceOf('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb').call();
        
        console.log(`Deployer (${DEPLOYER}):`);
        console.log(`  Raw: ${balanceDeployer.toString()}`);
        console.log(`  Human: ${(parseInt(balanceDeployer.toString()) / 1e18).toFixed(18)}`);
        
        console.log(`\nPLAYER1 (${PLAYER1}):`);
        console.log(`  Raw: ${balancePlayer1.toString()}`);
        console.log(`  Human: ${(parseInt(balancePlayer1.toString()) / 1e18).toFixed(18)}`);
        
        console.log(`\nPLAYER2 (${PLAYER2}):`);
        console.log(`  Raw: ${balancePlayer2.toString()}`);
        console.log(`  Human: ${(parseInt(balancePlayer2.toString()) / 1e18).toFixed(18)}`);
        
        // 5. 查看最近添加流动性的交易
        console.log('\n--- 链上交易分析 ---');
        console.log('查看 Pool 合约交易历史：');
        console.log(`https://nile.tronscan.org/#/contract/${POOL_ADDRESS}/transactions`);
        
        // 6. 检查合约 owner
        const owner = await poolContract.owner().call();
        console.log('\n--- 合约信息 ---');
        console.log(`Pool Owner: ${owner}`);
        
        // 7. 计算首次注入时需要的数量
        console.log('\n--- LP Token 数量解释 ---');
        console.log(`当前 LP Token 总量: ${totalSupplyNum} (wei)`);
        console.log(`如果首次注入 500 TRX + 9500 CHIP:`);
        console.log(`  sqrt(500 * 1e6 * 9500 * 1e6) = sqrt(4.75e15) ≈ 68,920,243`);
        console.log(`  LP Token = 68,920,243 - 1,000 = 68,919,243 (wei)`);
        console.log(`  转换为显示: 0.0000689... （非常小）`);
        
        // 实际计算
        const calcSqrt = Math.sqrt(500 * 1e6 * 9500 * 1e6);
        console.log(`\n  实际计算: sqrt = ${calcSqrt}`);
        
        // 反推：如果 LP = 22.36... (显示值)，原始值是多少？
        const lpDisplay = 22.3607;
        const lpRaw = lpDisplay * 1e18;
        console.log(`\n--- 反推验证 ---`);
        console.log(`如果 LP Token 显示为 ${lpDisplay}，原始值为 ${lpRaw}`);
        console.log(`当前 totalSupply 原始值: ${totalSupplyNum}`);
        console.log(`差距: ${totalSupplyNum / lpRaw} 倍`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyze();
