/**
 * 检查部署状态
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

async function checkDeployment() {
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
  });

  const deployerPrivateKey = process.env.TESTNET_PRIVATE_KEY;
  const deployer = tronWeb.address.fromPrivateKey(deployerPrivateKey);
  tronWeb.setAddress(deployer);

  // 从部署文件读取地址
  const fs = require('fs');
  const deploymentPath = './deployments/chip-amm-testnet.json';
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('Deployment file not found');
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  console.log('========================================');
  console.log('部署状态检查');
  console.log('========================================\n');
  
  console.log('合约地址:');
  console.log(`  CHIP Token: ${deployment.chipToken}`);
  console.log(`  AMM Pool: ${deployment.pool}`);
  console.log(`  AMM Router: ${deployment.router}`);
  console.log('');
  
  // 检查 CHIP Token
  const chipToken = await tronWeb.contract().at(deployment.chipToken);
  const totalSupply = await chipToken.totalSupply().call();
  const maxSupply = await chipToken.MAX_SUPPLY().call();
  const deployerChipBalance = await chipToken.balanceOf(deployer).call();
  
  console.log('CHIP Token 状态:');
  console.log(`  总供应量: ${Number(totalSupply) / 1e6} CHIP`);
  console.log(`  最大供应量: ${Number(maxSupply) / 1e6} CHIP`);
  console.log(`  部署者余额: ${Number(deployerChipBalance) / 1e6} CHIP`);
  console.log('');
  
  // 检查池子状态
  const pool = await tronWeb.contract().at(deployment.pool);
  const poolTrxBalance = await tronWeb.trx.getBalance(deployment.pool);
  const poolChipBalance = await chipToken.balanceOf(deployment.pool).call();
  const lpTotalSupply = await pool.totalSupply().call();
  const deployerLpBalance = await pool.balanceOf(deployer).call();
  
  console.log('AMM Pool 状态:');
  console.log(`  TRX 余额: ${Number(poolTrxBalance) / 1e6} TRX`);
  console.log(`  CHIP 余额: ${Number(poolChipBalance) / 1e6} CHIP`);
  console.log(`  LP 总供应量: ${Number(lpTotalSupply) / 1e18}`);
  console.log(`  部署者 LP 余额: ${Number(deployerLpBalance) / 1e18}`);
  console.log('');
  
  // 检查价格
  try {
    const price = await pool.getCurrentPrice().call();
    console.log(`  当前价格: 1 TRX = ${Number(price) / 1e6} CHIP`);
  } catch (e) {
    console.log('  价格: 无法计算 (流动性不足)');
  }
  console.log('');
  
  // 检查部署者 TRX 余额
  const deployerTrxBalance = await tronWeb.trx.getBalance(deployer);
  console.log(`部署者 TRX 余额: ${Number(deployerTrxBalance) / 1e6} TRX`);
  console.log('');
  
  // 判断流动性是否正常
  if (Number(poolTrxBalance) > 0 && Number(poolChipBalance) > 0) {
    console.log('✓ 流动性正常');
  } else {
    console.log('✗ 流动性异常，需要重新添加');
  }
}

checkDeployment()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
