/**
 * TronLink NFT Cards显示诊断
 * 快速检查API和数据库状态
 */

const mongoose = require('mongoose');
const axios = require('axios');
const NFTClaim = require('./server/models/NFTClaim');

const TUNNEL_URL = 'https://absolute-lightweight-miscellaneous-linda.trycloudflare.com';

async function diagnose() {
    console.log('========================================');
    console.log('🔍 TronLink NFT Cards显示诊断');
    console.log('========================================\n');

    try {
        // 1. 检查数据库
        console.log('📊 步骤1: 检查数据库中的NFT');
        console.log('----------------------------------------');
        
        await mongoose.connect('mongodb://localhost:27017/bridge-poker');
        
        const nfts = await NFTClaim.find({}).sort({ tokenId: 1 }).limit(15);
        
        console.log(`找到 ${nfts.length} 个NFT:\n`);
        
        nfts.forEach(nft => {
            const cardsStr = nft.cards && nft.cards.length > 0 
                ? nft.cards.map(c => `${c.rank}${c.suit}`).join(' ')
                : '无Cards数据';
            console.log(`  Token #${nft.tokenId}: ${nft.achievementType} - Cards: ${cardsStr}`);
        });

        // 2. 测试API
        console.log('\n\n🌐 步骤2: 测试API访问');
        console.log('----------------------------------------');
        
        const testTokens = [1, 10, 11];
        
        for (const tokenId of testTokens) {
            console.log(`\n测试 Token #${tokenId}:`);
            
            try {
                const response = await axios.get(`${TUNNEL_URL}/api/nft/metadata/${tokenId}`, {
                    timeout: 5000
                });
                
                const metadata = response.data;
                const cardsAttr = metadata.attributes?.find(a => a.trait_type === 'Cards');
                
                if (cardsAttr) {
                    console.log(`  ✅ Cards: ${cardsAttr.value}`);
                } else {
                    console.log(`  ❌ 无Cards信息`);
                }
                
                // 检查双参数路由
                const response2 = await axios.get(`${TUNNEL_URL}/api/nft/metadata/6/${tokenId}`, {
                    timeout: 5000
                });
                
                const metadata2 = response2.data;
                const cardsAttr2 = metadata2.attributes?.find(a => a.trait_type === 'Cards');
                
                if (cardsAttr2) {
                    console.log(`  ✅ 双参数路由 Cards: ${cardsAttr2.value}`);
                } else {
                    console.log(`  ❌ 双参数路由无Cards信息`);
                }
                
            } catch (error) {
                console.log(`  ❌ API错误: ${error.message}`);
            }
        }

        // 3. 检查服务器日志
        console.log('\n\n📝 步骤3: 检查服务器日志');
        console.log('----------------------------------------');
        
        const fs = require('fs');
        const logFile = '/Users/yingfengzhang/1JackSource/blockchain/game-core/server-tunnel-fixed.log';
        
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8').split('\n').slice(-20);
            const recentLogs = logs.filter(l => l.includes('NFT API') || l.includes('Metadata'));
            
            if (recentLogs.length > 0) {
                console.log('最近的NFT API请求:');
                recentLogs.forEach(log => {
                    console.log('  ', log);
                });
            } else {
                console.log('未找到NFT API请求日志');
            }
        }

        // 4. 解决方案
        console.log('\n\n========================================');
        console.log('💡 解决方案');
        console.log('========================================\n');
        
        console.log('如果TronLink钱包没有显示Cards信息，请尝试:\n');
        
        console.log('方案1: 清除TronLink缓存');
        console.log('  1. 打开TronLink钱包');
        console.log('  2. 进入设置 → 高级 → 清除缓存');
        console.log('  3. 重新打开NFT页面\n');
        
        console.log('方案2: 重新添加NFT合约');
        console.log('  1. 进入NFT收藏品');
        console.log('  2. 找到合约: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
        console.log('  3. 点击删除/移除');
        console.log('  4. 重新添加合约地址');
        console.log('  5. 等待加载完成\n');
        
        console.log('方案3: 强制刷新NFT');
        console.log('  1. 点击NFT卡片');
        console.log('  2. 下拉刷新页面');
        console.log('  3. 等待几秒钟让元数据加载\n');
        
        console.log('方案4: 使用测试脚本验证');
        console.log('  node test-tronlink-cards.js\n');
        
        console.log('========================================');
        console.log('✅ 诊断完成');
        console.log('========================================');

        await mongoose.disconnect();
        
    } catch (error) {
        console.error('\n❌ 诊断失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnose();
