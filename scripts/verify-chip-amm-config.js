/**
 * 验证 CHIP Token 和 AMM 配置
 * 
 * 用法：
 * TRON_NETWORK=testnet node scripts/verify-chip-amm-config.js
 */
const fs = require('fs');
const path = require('path');

const NETWORK = process.env.TRON_NETWORK || 'testnet';

console.log('========================================');
console.log(`验证 CHIP & AMM 配置 - ${NETWORK.toUpperCase()}`);
console.log('========================================\n');

// 1. 检查环境变量
console.log('1. 检查环境变量...');
require('dotenv').config({ path: `.env.${NETWORK}` });

const envVars = {
  CHIP_TOKEN_ADDRESS: process.env.CHIP_TOKEN_ADDRESS,
  AMM_POOL_ADDRESS: process.env.AMM_POOL_ADDRESS,
  AMM_ROUTER_ADDRESS: process.env.AMM_ROUTER_ADDRESS,
  CHIP_DAILY_REWARD_LIMIT: process.env.CHIP_DAILY_REWARD_LIMIT,
  CHIP_RESERVE_TARGET: process.env.CHIP_RESERVE_TARGET,
  TESTNET_PRIVATE_KEY: process.env.TESTNET_PRIVATE_KEY ? '✓ (已设置)' : '✗ (未设置)',
  MAINNET_PRIVATE_KEY: process.env.MAINNET_PRIVATE_KEY ? '✓ (已设置)' : '✗ (未设置)'
};

console.log('环境变量状态:');
Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value || '✗ (未设置)'}`);
});
console.log('');

// 2. 检查部署文件
console.log('2. 检查部署文件...');
const deploymentPath = path.join(__dirname, `../deployments/chip-amm-${NETWORK}.json`);

if (fs.existsSync(deploymentPath)) {
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  console.log('部署信息:');
  console.log(`  CHIP Token: ${deploymentInfo.chipToken}`);
  console.log(`  AMM Pool: ${deploymentInfo.pool}`);
  console.log(`  AMM Router: ${deploymentInfo.router}`);
  console.log(`  初始供应量: ${deploymentInfo.initialSupply / 1e6} CHIP`);
  console.log(`  初始流动性:`);
  console.log(`    - TRX: ${deploymentInfo.liquidity.trx / 1e6}`);
  console.log(`    - CHIP: ${deploymentInfo.liquidity.chip / 1e6}`);
  console.log(`  部署时间: ${deploymentInfo.deployedAt}`);
} else {
  console.log(`✗ 部署文件不存在: ${deploymentPath}`);
  console.log('  请先运行: node scripts/deploy-chip-amm.js');
}
console.log('');

// 3. 验证合约代码
console.log('3. 验证合约代码...');

// 检查 ChipToken.sol
const chipTokenPath = path.join(__dirname, '../contracts/ChipToken.sol');
const chipTokenCode = fs.readFileSync(chipTokenPath, 'utf8');

const maxSupplyMatch = chipTokenCode.match(/MAX_SUPPLY = ([\d_]+) \* 1e6/);
if (maxSupplyMatch) {
  const maxSupply = parseInt(maxSupplyMatch[1].replace(/_/g, ''));
  console.log(`  CHIP 最大供应量: ${maxSupply.toLocaleString()} CHIP`);
  if (maxSupply === 1_000_000) {
    console.log('  ✓ 供应量已优化（从 10 亿减少到 100 万）');
  } else {
    console.log('  ✗ 供应量未优化（应为 1,000,000）');
  }
} else {
  console.log('  ✗ 无法解析最大供应量');
}

// 检查 VIP 阈值
const vipThresholdMatch = chipTokenCode.match(/vipThreshold = ([\d_]+) \* 1e6/);
const superVipThresholdMatch = chipTokenCode.match(/superVipThreshold = ([\d_]+) \* 1e6/);

if (vipThresholdMatch && superVipThresholdMatch) {
  const vipThreshold = parseInt(vipThresholdMatch[1].replace(/_/g, ''));
  const superVipThreshold = parseInt(superVipThresholdMatch[1].replace(/_/g, ''));
  console.log(`  VIP 阈值: ${vipThreshold.toLocaleString()} CHIP`);
  console.log(`  Super VIP 阈值: ${superVipThreshold.toLocaleString()} CHIP`);
}
console.log('');

// 4. 验证服务配置
console.log('4. 验证服务配置...');

const chipServicePath = path.join(__dirname, '../server/services/ChipService.js');
const chipServiceCode = fs.readFileSync(chipServicePath, 'utf8');

// 检查每日奖励上限
if (chipServiceCode.includes('dailyRewardLimit = 5000')) {
  console.log('  ✓ 每日奖励上限: 5,000 CHIP');
} else {
  console.log('  ✗ 每日奖励上限未设置');
}

// 检查储备目标
if (chipServiceCode.includes('reserveTarget = 500000')) {
  console.log('  ✓ 储备目标: 500,000 CHIP');
} else {
  console.log('  ✗ 储备目标未设置');
}

// 检查动态调整
if (chipServiceCode.includes('getAdjustedRewardRate')) {
  console.log('  ✓ 动态调整机制已实现');
} else {
  console.log('  ✗ 动态调整机制未实现');
}

// 检查储备检查
if (chipServiceCode.includes('getTreasuryBalance')) {
  console.log('  ✓ 储备余额检查已实现');
} else {
  console.log('  ✗ 储备余额检查未实现');
}
console.log('');

// 5. 总结
console.log('========================================');
console.log('验证总结');
console.log('========================================');

const checks = [
  { name: '环境变量', pass: !!envVars.CHIP_TOKEN_ADDRESS },
  { name: '部署文件', pass: fs.existsSync(deploymentPath) },
  { name: '供应量优化', pass: chipTokenCode.includes('MAX_SUPPLY = 1_000_000') },
  { name: '奖励限制', pass: chipServiceCode.includes('dailyRewardLimit') },
  { name: '动态调整', pass: chipServiceCode.includes('getAdjustedRewardRate') }
];

const passed = checks.filter(c => c.pass).length;
const total = checks.length;

checks.forEach(check => {
  console.log(`  ${check.pass ? '✓' : '✗'} ${check.name}`);
});

console.log(`\n通过: ${passed}/${total}`);

if (passed === total) {
  console.log('\n✓ 所有检查通过！配置正确。');
} else {
  console.log('\n✗ 部分检查未通过，请检查配置。');
}
