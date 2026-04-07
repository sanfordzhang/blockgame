/**
 * 手动添加流动性到 AMM Pool
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

async function addLiquidityManual() {
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY,
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
  });

  const deployer = tronWeb.address.fromPrivateKey(process.env.TESTNET_PRIVATE_KEY);
  tronWeb.setAddress(deployer);

  // 从部署文件读取地址
  const fs = require('fs');
  const deployment = JSON.parse(fs.readFileSync('./deployments/chip-amm-testnet.json', 'utf8'));
  
  const CHIP_TOKEN_ADDRESS = deployment.chipToken;
  const POOL_ADDRESS = deployment.pool;
  
  const TRX_AMOUNT = 500 * 1e6; // 500 TRX
  const CHIP_AMOUNT = 5000 * 1e6; // 5000 CHIP
  
  console.log('========================================');
  console.log('手动添加流动性');
  console.log('========================================\n');
  console.log(`CHIP Token: ${CHIP_TOKEN_ADDRESS}`);
  console.log(`Pool: ${POOL_ADDRESS}`);
  console.log(`TRX: ${TRX_AMOUNT / 1e6}`);
  console.log(`CHIP: ${CHIP_AMOUNT / 1e6}\n`);
  
  const chipToken = await tronWeb.contract().at(CHIP_TOKEN_ADDRESS);
  const pool = await tronWeb.contract().at(POOL_ADDRESS);
  
  try {
    // 1. 检查当前状态
    const poolTrxBefore = await tronWeb.trx.getBalance(POOL_ADDRESS);
    const poolChipBefore = await chipToken.balanceOf(POOL_ADDRESS).call();
    
    console.log('当前池子状态:');
    console.log(`  TRX: ${Number(poolTrxBefore) / 1e6}`);
    console.log(`  CHIP: ${Number(poolChipBefore) / 1e6}\n`);
    
    // 2. Approve CHIP
    console.log('1. Approving CHIP...');
    const approveTx = await chipToken.approve(POOL_ADDRESS, CHIP_AMOUNT).send({
      feeLimit: 100 * 1e6
    });
    console.log(`   ✓ ${approveTx}\n`);
    
    // 3. Transfer CHIP to pool
    console.log('2. Transferring CHIP to pool...');
    const transferTx = await chipToken.transfer(POOL_ADDRESS, CHIP_AMOUNT).send({
      feeLimit: 100 * 1e6
    });
    console.log(`   ✓ ${transferTx}\n`);
    
    // 4. Send TRX directly to pool (not via mint)
    console.log('3. Sending TRX to pool...');
    const sendTx = await tronWeb.trx.sendTransaction(POOL_ADDRESS, TRX_AMOUNT);
    console.log(`   ✓ ${sendTx.txid}\n`);
    
    // 5. Check pool balance after transfers
    const poolTrxAfter = await tronWeb.trx.getBalance(POOL_ADDRESS);
    const poolChipAfter = await chipToken.balanceOf(POOL_ADDRESS).call();
    
    console.log('池子状态 (转账后):');
    console.log(`  TRX: ${Number(poolTrxAfter) / 1e6}`);
    console.log(`  CHIP: ${Number(poolChipAfter) / 1e6}\n`);
    
    // 6. Mint LP tokens
    console.log('4. Minting LP tokens...');
    const mintTx = await pool.mint(deployer).send({
      feeLimit: 100 * 1e6,
      callValue: 0 // No TRX sent with this call
    });
    console.log(`   ✓ ${mintTx}\n`);
    
    // 7. Verify results
    const lpBalance = await pool.balanceOf(deployer).call();
    const totalSupply = await pool.totalSupply().call();
    const finalPoolTrx = await tronWeb.trx.getBalance(POOL_ADDRESS);
    const finalPoolChip = await chipToken.balanceOf(POOL_ADDRESS).call();
    
    console.log('========================================');
    console.log('添加流动性结果');
    console.log('========================================');
    console.log(`池子 TRX: ${Number(finalPoolTrx) / 1e6}`);
    console.log(`池子 CHIP: ${Number(finalPoolChip) / 1e6}`);
    console.log(`LP 代币总数: ${Number(totalSupply) / 1e18}`);
    console.log(`你的 LP 代币: ${Number(lpBalance) / 1e18}`);
    console.log('');
    
    if (Number(finalPoolTrx) > 0 && Number(finalPoolChip) > 0 && Number(lpBalance) > 0) {
      console.log('✓ 流动性添加成功！');
    } else {
      console.log('✗ 流动性添加失败，请检查日志');
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

addLiquidityManual()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
