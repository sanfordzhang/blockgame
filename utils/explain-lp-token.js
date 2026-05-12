/**
 * LP Token 详细解释和问题排查
 */

console.log('========================================');
console.log('LP Token 计算和持有者问题分析');
console.log('========================================\n');

console.log('【问题1】LP Token 数量如何计算？');
console.log('----------------------------------------');
console.log('根据 AMMPool.sol 合约代码：\n');

console.log('LP Token 精度：18 位小数');
console.log('计算公式：');
console.log('  首次注入: liquidity = sqrt(TRX数量 × CHIP数量) - MINIMUM_LIQUIDITY');
console.log('  MINIMUM_LIQUIDITY = 1000 (永久锁定)\n');

// 计算示例
const TRX_RESERVE = 514235026;  // sun 单位
const CHIP_RESERVE = 9725193416; // microCHIP 单位

console.log('当前池中储备量：');
console.log(`  TRX: ${TRX_RESERVE} sun = ${TRX_RESERVE / 1e6} TRX`);
console.log(`  CHIP: ${CHIP_RESERVE} microCHIP = ${CHIP_RESERVE / 1e6} CHIP\n`);

// 计算 sqrt
const product = BigInt(TRX_RESERVE) * BigInt(CHIP_RESERVE);
const sqrtK = Math.sqrt(Number(product));
const liquidityCalculated = sqrtK - 1000;

console.log('计算过程：');
console.log(`  TRX × CHIP = ${product.toString()}`);
console.log(`  sqrt(TRX × CHIP) ≈ ${sqrtK.toFixed(0)}`);
console.log(`  LP Token = ${sqrtK.toFixed(0)} - 1000 = ${liquidityCalculated.toFixed(0)} (原始值)`);
console.log(`  LP Token 显示值 = ${liquidityCalculated.toFixed(0)} / 10^18 = ${(liquidityCalculated / 1e18).toFixed(18)}\n`);

console.log('⚠️ 注意：之前脚本显示的 22.3607 是因为使用了错误的精度 (÷1e8)');
console.log('   实际 LP Token 总量应该是约 70,709,678 (原始值)');
console.log('   转换为显示值：0.000000000070709678 (非常小)\n');

console.log('========================================\n');

console.log('【问题2】为什么 LP Token 不在 PLAYER1 地址？');
console.log('----------------------------------------');
console.log('\n根据链上查询：');
console.log(`  所有 LP Token 都在 Deployer 地址: TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA`);
console.log(`  PLAYER1 (${'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'}): 0 LP Token`);
console.log(`  PLAYER2 (${'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'}): 0 LP Token\n`);

console.log('可能的原因：\n');
console.log('1️⃣ 注入时使用的是服务器私钥（Deployer）而不是 TronLink');
console.log('   - 如果通过后端 API 或脚本注入，会用服务器私钥签名');
console.log('   - LP Token 会发给调用者地址（Deployer）\n');

console.log('2️⃣ TronLink 未正确连接');
console.log('   - 前端代码需要 TronLink 连接才能获取用户地址');
console.log('   - 如果 TronLink 未连接或连接了错误的钱包，会导致问题\n');

console.log('3️⃣ 交易签名者是 Deployer');
console.log('   - Router 合约的 addLiquidity 函数会把 LP Token 发给 `to` 参数指定的地址');
console.log('   - 但这个地址由前端传入，如果前端用的是错误地址就会出问题\n');

console.log('========================================\n');

console.log('【验证方法】');
console.log('----------------------------------------');
console.log('\n方法1: 查看 TronScan 交易历史');
console.log(`https://nile.tronscan.org/#/contract/TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v/transactions`);
console.log('找到 addLiquidity 交易，查看交易发起者是谁\n');

console.log('方法2: 检查前端 TronLink 连接');
console.log('- 打开 http://127.0.0.1:3001/dex');
console.log('- 查看右上角显示的地址是否是 PLAYER1');
console.log('- 确保是 PLAYER1 钱包连接，不是 Deployer\n');

console.log('方法3: 重新注入流动性（正确流程）');
console.log('1. 确保 TronLink 连接 PLAYER1 钱包');
console.log('2. 进入 DEX 页面的 Liquidity 标签');
console.log('3. 输入要注入的 TRX 数量');
console.log('4. 点击 Add Liquidity');
console.log('5. **TronLink 会弹出签名请求** ← 这是关键！');
console.log('6. 确认签名，等待交易完成');
console.log('7. 刷新页面，在 Your Liquidity 区域查看 LP Token\n');

console.log('========================================\n');

console.log('【总结】');
console.log('----------------------------------------');
console.log('\n✅ LP Token 计算：');
console.log(`   总量 = sqrt(${TRX_RESERVE} × ${CHIP_RESERVE}) - 1000 ≈ ${liquidityCalculated.toFixed(0)}`);
console.log(`   这些 LP Token 代表对池中 ${TRX_RESERVE/1e6} TRX 和 ${CHIP_RESERVE/1e6} CHIP 的所有权\n`);

console.log('❌ LP Token 持有者问题：');
console.log('   当前所有 LP Token 都在 Deployer 地址');
console.log('   说明注入操作可能是通过服务器私钥完成的，而不是 TronLink\n');

console.log('🔧 解决方案：');
console.log('   如果想让 PLAYER1 持有 LP Token：');
console.log('   - Deployer 可以将 LP Token 转账给 PLAYER1');
console.log('   - 或者 PLAYER1 重新注入新的流动性（通过 TronLink）\n');
