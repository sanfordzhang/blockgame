/**
 * 检查用户质押情况和奖励发放问题
 */

const { TronWeb } = require('tronweb');

const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
const OLD_STAKING = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';  // 旧合约
const NEW_STAKING = 'TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc';  // 新合约

const PRIVATE_KEY = 'b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: PRIVATE_KEY
});

function formatChip(amount) {
    return (Number(amount) / 1e6).toFixed(2) + ' CHIP';
}

async function main() {
    console.log('========================================');
    console.log('检查质押合约状态');
    console.log('========================================\n');
    
    // 测试账户
    const testAccount = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    console.log('测试账户:', testAccount);
    
    // 获取CHIP合约
    const chipContract = await tronWeb.contract().at(CHIP_TOKEN_ADDRESS);
    
    // 检查各地址的CHIP余额
    console.log('\n----------------------------------------');
    console.log('CHIP余额');
    console.log('----------------------------------------');
    
    const userChipBalance = await chipContract.balanceOf(testAccount).call();
    console.log('用户CHIP余额:', formatChip(userChipBalance));
    
    const oldStakingBalance = await chipContract.balanceOf(OLD_STAKING).call();
    console.log('旧质押合约CHIP余额:', formatChip(oldStakingBalance));
    
    const newStakingBalance = await chipContract.balanceOf(NEW_STAKING).call();
    console.log('新质押合约CHIP余额:', formatChip(newStakingBalance));
    
    // 检查旧质押合约状态
    console.log('\n----------------------------------------');
    console.log('旧质押合约状态 (TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs)');
    console.log('----------------------------------------');
    
    try {
        const oldContract = await tronWeb.contract().at(OLD_STAKING);
        
        // 检查合约配置
        try {
            const oldChipToken = await oldContract.chipToken().call();
            console.log('CHIP Token地址:', tronWeb.address.fromHex(oldChipToken));
        } catch (e) {
            console.log('chipToken方法不存在，可能是旧版本合约');
        }
        
        // 检查用户质押信息
        try {
            const userStake = await oldContract.stakes(testAccount).call();
            console.log('用户质押金额:', formatChip(userStake.amount || userStake[0]));
            console.log('是否激活:', userStake.isActive || userStake[4]);
            
            if (userStake.amount > 0n || userStake[0] > 0n) {
                const amount = userStake.amount || userStake[0];
                console.log('\n⬆️ 用户在旧合约有质押！');
                
                // 获取待领取奖励
                try {
                    const pending = await oldContract.getPendingReward(testAccount).call();
                    console.log('待领取奖励:', formatChip(pending));
                } catch (e) {
                    console.log('无法获取待领取奖励:', e.message);
                }
            }
        } catch (e) {
            console.log('获取质押信息失败:', e.message);
        }
        
        // 检查全局状态
        try {
            const totalStaked = await oldContract.totalStaked().call();
            console.log('总质押金额:', formatChip(totalStaked));
        } catch (e) {}
        
        try {
            const totalRewardsClaimed = await oldContract.totalRewardsClaimed().call();
            console.log('已发放奖励总额:', formatChip(totalRewardsClaimed));
        } catch (e) {}
        
        try {
            const largestStake = await oldContract.largestStake().call();
            console.log('最大质押金额:', formatChip(largestStake));
        } catch (e) {
            console.log('(旧合约没有largestStake变量)');
        }
        
    } catch (e) {
        console.log('连接旧合约失败:', e.message);
    }
    
    // 检查新质押合约状态
    console.log('\n----------------------------------------');
    console.log('新质押合约状态 (TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc)');
    console.log('----------------------------------------');
    
    try {
        const newContract = await tronWeb.contract().at(NEW_STAKING);
        
        const newChipToken = await newContract.chipToken().call();
        console.log('CHIP Token地址:', tronWeb.address.fromHex(newChipToken));
        
        const userStakeNew = await newContract.stakes(testAccount).call();
        console.log('用户质押金额:', formatChip(userStakeNew.amount));
        console.log('是否激活:', userStakeNew.isActive);
        
        const totalStakedNew = await newContract.totalStaked().call();
        console.log('总质押金额:', formatChip(totalStakedNew));
        
        const largestStakeNew = await newContract.largestStake().call();
        console.log('最大质押金额:', formatChip(largestStakeNew));
        
        const pendingNew = await newContract.getPendingReward(testAccount).call();
        console.log('待领取奖励:', formatChip(pendingNew));
        
    } catch (e) {
        console.log('连接新合约失败:', e.message);
    }
    
    console.log('\n========================================');
    console.log('问题诊断');
    console.log('========================================');
    console.log('1. 前端 CHIPWallet.js 硬编码了旧合约地址');
    console.log('   需要修改为使用后端API返回的合约地址');
    console.log('2. 如果用户在旧合约有质押，需要迁移到新合约');
}

main().catch(console.error);
