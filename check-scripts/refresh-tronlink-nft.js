/**
 * 强制刷新TronLink NFT显示
 */

console.log('========================================');
console.log('🔄 TronLink NFT刷新指南');
console.log('========================================\n');

console.log('📱 在TronLink钱包中执行以下步骤:\n');

console.log('方法1: 移除并重新添加NFT');
console.log('  1. 打开TronLink → NFT收藏品');
console.log('  2. 找到PANFT合约，长按删除');
console.log('  3. 点击"添加NFT"');
console.log('  4. 输入合约地址: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
console.log('  5. 等待加载\n');

console.log('方法2: 清除TronLink缓存');
console.log('  1. TronLink设置 → 高级');
console.log('  2. 清除缓存');
console.log('  3. 重启TronLink');
console.log('  4. 重新查看NFT\n');

console.log('方法3: 切换网络刷新');
console.log('  1. 切换到主网');
console.log('  2. 再切换回Nile测试网');
console.log('  3. 查看NFT收藏品\n');

console.log('========================================');
console.log('⚠️  注意事项');
console.log('========================================\n');

console.log('如果cloudflared tunnel重启过，URL会变化！');
console.log('需要重新设置baseURI:\n');
console.log('  1. 查看cloudflared输出获取新URL');
console.log('  2. node set-nft-baseuri-public.js <新URL>/api/nft/metadata/\n');
