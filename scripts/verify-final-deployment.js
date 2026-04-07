/**
 * 验证 AMM 部署状态
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

async function verifyAMM() {
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
  });

  const fs = require('fs');
  const deployment = JSON.parse(fs.readFileSync('./deployments/chip-amm-testnet.json', 'utf8'));
  
  const deployerPrivateKey = process.env.TESTNET_PRIVATE_KEY;
  const deployer = tronWeb.address.fromPrivateKey(deployerPrivateKey);
  tronWeb.setAddress(deployer);

  console.log('========================================');
  console.log('AMM 部署验证');
  console.log('========================================\n');
  
  // 连接合约
  const chipToken = await tronWeb.contract().at(deployment.chipToken);
  const pool = await tronWeb.contract().at(deployment.pool);
  const router = await tronWeb.contract().at(deployment.router);
  
  // 1. CHIP Token 状态
  console.log('=== CHIP Token ===');
  const totalSupply = await chipToken.totalSupply().call();
  const maxSupply = await chipToken.MAX_SUPPLY().call();
  const deployerChipBalance = await chipToken.balanceOf(deployer).call();
  
  console.log(`地址: ${deployment.chipToken}`);
  console.log(`总供应量: ${Number(totalSupply) / 1e6} CHIP`);
  console.log(`最大供应量: ${Number(maxSupply) / 1e6} CHIP`);
  console.log(`部署者余额: ${Number(deployerChipBalance) / 1e6} CHIP`);
  console.log('');
  
  // 2. Pool 状态
  console.log('=== AMM Pool ===');
  const poolTrxBalance = await tronWeb.trx.getBalance(deployment.pool);
  const poolChipBalance = await chipToken.balanceOf(deployment.pool).call();
  const lpTotalSupply = await pool.totalSupply().call();
  const deployerLpBalance = await pool.balanceOf(deployer).call();
  
  console.log(`地址: ${deployment.pool}`);
  console.log(`TRX 储备: ${Number(poolTrxBalance) / 1e6} TRX`);
  console.log(`CHIP 储备: ${Number(poolChipBalance) / 1e6} CHIP`);
  console.log(`LP 总供应量: ${Number(lpTotalSupply) / 1e18}`);
  console.log(`部署者 LP 余额: ${Number(deployerLpBalance) / 1e18}`);
  
  // 计算价格
  if (Number(poolTrxBalance) > 0 && Number(poolChipBalance) > 0) {
    const price = Number(poolChipBalance) / Number(poolTrxBalance);
    console.log(`价格: 1 TRX = ${price.toFixed(2)} CHIP`);
    console.log(`价格: 1 CHIP = ${(1/price).toFixed(4)} TRX`);
  }
  console.log('');
  
  // 3. Router 状态
  console.log('=== AMM Router ===');
  console.log(`地址: ${deployment.router}`);
  const routerPool = await router.pool().call();
  const routerToken = await router.token().call();
  console.log(`绑定的 Pool: ${tronWeb.address.fromHex(routerPool)}`);
  console.log(`绑定的 Token: ${tronWeb.address.fromHex(routerToken)}`);
  console.log('');
  
  // 4. 部署者状态
  console.log('=== 部署者 ===');
  console.log(`地址: ${deployer}`);
  const deployerTrxBalance = await tronWeb.trx.getBalance(deployer);
  console.log(`TRX 余额: ${Number(deployerTrxBalance) / 1e6} TRX`);
  console.log(`CHIP 余额: ${Number(deployerChipBalance) / 1e6} CHIP`);
  console.log(`LP 代币: ${Number(deployerLpBalance) / 1e18}`);
  console.log('');
  
  // 5. 验证结果
  console.log('========================================');
  console.log('验证结果');
  console.log('========================================');
  
  const checks = [
    { name: 'CHIP 最大供应量 = 100 万', pass: Number(maxSupply) === 1_000_000 * 1e6 },
    { name: 'Pool 有 TRX 储备', pass: Number(poolTrxBalance) > 0 },
    { name: 'Pool 有 CHIP 储备', pass: Number(poolChipBalance) > 0 },
    { name: '部署者有 LP 代币', pass: Number(deployerLpBalance) > 0 },
    { name: 'Router 配置正确', pass: tronWeb.address.fromHex(routerPool) === deployment.pool }
  ];
  
  checks.forEach(check => {
    console.log(`${check.pass ? '✓' : '✗'} ${check.name}`);
  });
  
  const allPassed = checks.every(c => c.pass);
  
  if (allPassed) {
    console.log('\n✓ 所有检查通过！AMM 部署成功！\n');
    console.log('添加到 .env.testnet:');
    console.log(`CHIP_TOKEN_ADDRESS=${deployment.chipToken}`);
    console.log(`AMM_POOL_ADDRESS=${deployment.pool}`);
    console.log(`AMM_ROUTER_ADDRESS=${deployment.router}`);
    console.log(`CHIP_DAILY_REWARD_LIMIT=5000`);
    console.log(`CHIP_RESERVE_TARGET=500000`);
  } else {
    console.log('\n✗ 部分检查未通过，请检查部署');
  }
}

verifyAMM()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
