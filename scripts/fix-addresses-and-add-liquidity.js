/**
 * 转换地址格式并添加流动性
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

async function fixAddressesAndAddLiquidity() {
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY,
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
  });

  const deployer = tronWeb.address.fromPrivateKey(process.env.TESTNET_PRIVATE_KEY);
  tronWeb.setAddress(deployer);

  // 之前部署的 hex 地址
  const chipTokenHex = '413cc0e2d0749b723ee9c0e35adbca94072beaac60';
  const poolHex = '412a0c6d3c41602690efd845ed0328426d088e09a5';
  const routerHex = '41ee00631f088c7e20f8d84033bba8c6941477a200';
  
  // 转换为 TRON Base58 格式
  const chipTokenAddress = tronWeb.address.fromHex(chipTokenHex);
  const poolAddress = tronWeb.address.fromHex(poolHex);
  const routerAddress = tronWeb.address.fromHex(routerHex);
  
  console.log('========================================');
  console.log('地址转换');
  console.log('========================================\n');
  console.log('CHIP Token:');
  console.log(`  Hex: ${chipTokenHex}`);
  console.log(`  Base58: ${chipTokenAddress}\n`);
  console.log('AMM Pool:');
  console.log(`  Hex: ${poolHex}`);
  console.log(`  Base58: ${poolAddress}\n`);
  console.log('AMM Router:');
  console.log(`  Hex: ${routerHex}`);
  console.log(`  Base58: ${routerAddress}\n`);
  
  // 保存正确的部署信息
  const fs = require('fs');
  const deploymentInfo = {
    network: 'testnet',
    deployer: deployer,
    chipToken: chipTokenAddress,
    pool: poolAddress,
    router: routerAddress,
    initialSupply: 1_000_000 * 1e6,
    liquidity: {
      trx: 0,
      chip: 0
    },
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync('./deployments/chip-amm-testnet.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('✓ 部署信息已保存到 deployments/chip-amm-testnet.json\n');
  
  // 添加流动性
  const TRX_AMOUNT = 500 * 1e6;
  const CHIP_AMOUNT = 5000 * 1e6;
  
  console.log('========================================');
  console.log('添加流动性');
  console.log('========================================\n');
  
  const chipToken = await tronWeb.contract().at(chipTokenAddress);
  const pool = await tronWeb.contract().at(poolAddress);
  
  // 1. 检查当前池子状态
  const poolTrxBefore = await tronWeb.trx.getBalance(poolAddress);
  const poolChipBefore = await chipToken.balanceOf(poolAddress).call();
  
  console.log('当前池子状态:');
  console.log(`  TRX: ${Number(poolTrxBefore) / 1e6}`);
  console.log(`  CHIP: ${Number(poolChipBefore) / 1e6}\n`);
  
  // 2. 如果已经有 CHIP，先移除
  if (Number(poolChipBefore) > 0) {
    console.log('移除旧的 CHIP...');
    // 需要调用池子的管理员函数来移除 CHIP
    // 或者直接重新部署
    console.log('注意: 池子已有 CHIP，建议重新部署新合约');
    return;
  }
  
  // 3. Approve CHIP
  console.log('1. Approving CHIP...');
  const approveTx = await chipToken.approve(poolAddress, CHIP_AMOUNT).send({
    feeLimit: 100 * 1e6
  });
  console.log(`   ✓ ${approveTx}\n`);
  
  // 4. Transfer CHIP to pool
  console.log('2. Transferring CHIP to pool...');
  const transferTx = await chipToken.transfer(poolAddress, CHIP_AMOUNT).send({
    feeLimit: 100 * 1e6
  });
  console.log(`   ✓ ${transferTx}\n`);
  
  // 5. Mint LP tokens with TRX
  console.log('3. Minting LP tokens (sending TRX)...');
  const mintTx = await pool.mint(deployer).send({
    feeLimit: 100 * 1e6,
    callValue: TRX_AMOUNT
  });
  console.log(`   ✓ ${mintTx}\n`);
  
  // 6. Verify results
  const poolTrxAfter = await tronWeb.trx.getBalance(poolAddress);
  const poolChipAfter = await chipToken.balanceOf(poolAddress).call();
  const lpBalance = await pool.balanceOf(deployer).call();
  
  console.log('========================================');
  console.log('添加流动性结果');
  console.log('========================================');
  console.log(`池子 TRX: ${Number(poolTrxAfter) / 1e6}`);
  console.log(`池子 CHIP: ${Number(poolChipAfter) / 1e6}`);
  console.log(`你的 LP 代币: ${Number(lpBalance) / 1e18}\n`);
  
  // 更新部署信息
  deploymentInfo.liquidity.trx = Number(poolTrxAfter);
  deploymentInfo.liquidity.chip = Number(poolChipAfter);
  fs.writeFileSync('./deployments/chip-amm-testnet.json', JSON.stringify(deploymentInfo, null, 2));
  
  if (Number(poolTrxAfter) > 0 && Number(poolChipAfter) > 0) {
    console.log('✓ 流动性添加成功！');
    console.log('\n添加到 .env.testnet:');
    console.log(`CHIP_TOKEN_ADDRESS=${chipTokenAddress}`);
    console.log(`AMM_POOL_ADDRESS=${poolAddress}`);
    console.log(`AMM_ROUTER_ADDRESS=${routerAddress}`);
  } else {
    console.log('✗ 流动性添加失败');
  }
}

fixAddressesAndAddLiquidity()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
