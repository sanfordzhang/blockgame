/**
 * 为已部署的 AMM Pool 添加流动性
 * 
 * 用法：
 * - 测试网：TRON_NETWORK=testnet node scripts/add-liquidity.js
 * - 正式网：TRON_NETWORK=mainnet node scripts/add-liquidity.js
 */
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

// 配置
const NETWORK = process.env.TRON_NETWORK || 'testnet';

const CONFIG = {
  testnet: {
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io',
    liquidity: {
      trxAmount: 500 * 1e6, // 500 TRX
      chipAmount: 5_000 * 1e6 // 5,000 CHIP
    }
  },
  mainnet: {
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io',
    liquidity: {
      trxAmount: 500 * 1e6, // 500 TRX (Demo)
      chipAmount: 5_000 * 1e6 // 5,000 CHIP (Demo)
    }
  }
};

const config = CONFIG[NETWORK];

async function addLiquidity() {
  console.log('========================================');
  console.log(`Add Liquidity - ${NETWORK.toUpperCase()}`);
  console.log('========================================');
  
  // 加载部署信息
  const deploymentPath = path.join(__dirname, `../deployments/chip-amm-${NETWORK}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment info not found: ${deploymentPath}`);
    console.error('Please run deploy-chip-amm.js first');
    process.exit(1);
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  console.log('Deployment Info:');
  console.log(`  CHIP Token: ${deploymentInfo.chipToken}`);
  console.log(`  AMM Pool: ${deploymentInfo.pool}`);
  console.log(`  AMM Router: ${deploymentInfo.router}`);
  
  // 获取私钥
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || 
                     (NETWORK === 'testnet' ? process.env.TESTNET_PRIVATE_KEY : process.env.MAINNET_PRIVATE_KEY);
  
  if (!privateKey) {
    console.error(`Please set ${NETWORK === 'testnet' ? 'TESTNET_PRIVATE_KEY' : 'MAINNET_PRIVATE_KEY'} environment variable`);
    process.exit(1);
  }
  
  // 初始化 TronWeb
  const tronWeb = new TronWeb({
    fullHost: config.fullNode,
    privateKey: privateKey
  });
  
  const provider = tronWeb.address.fromPrivateKey(privateKey);
  console.log(`\nProvider: ${provider}`);
  
  // 检查余额
  const trxBalance = await tronWeb.trx.getBalance(provider);
  console.log(`TRX Balance: ${Number(trxBalance) / 1e6} TRX`);
  
  if (Number(trxBalance) < config.liquidity.trxAmount) {
    console.error(`Insufficient TRX. Need ${config.liquidity.trxAmount / 1e6} TRX`);
    process.exit(1);
  }
  
  // 连接合约
  const chipToken = await tronWeb.contract().at(deploymentInfo.chipToken);
  const pool = await tronWeb.contract().at(deploymentInfo.pool);
  
  // 检查 CHIP 余额
  const chipBalance = await chipToken.balanceOf(provider).call();
  console.log(`CHIP Balance: ${Number(chipBalance) / 1e6} CHIP`);
  
  if (Number(chipBalance) < config.liquidity.chipAmount) {
    console.error(`Insufficient CHIP. Need ${config.liquidity.chipAmount / 1e6} CHIP`);
    process.exit(1);
  }
  
  console.log('\n========================================');
  console.log('Adding Liquidity');
  console.log('========================================');
  console.log(`TRX: ${config.liquidity.trxAmount / 1e6}`);
  console.log(`CHIP: ${config.liquidity.chipAmount / 1e6}`);
  
  // 1. Approve CHIP to pool
  console.log('\n1. Approving CHIP to pool...');
  const approveTx = await chipToken.approve(deploymentInfo.pool, config.liquidity.chipAmount).send({
    feeLimit: 100 * 1e6
  });
  console.log(`✓ Approve tx: ${approveTx}`);
  
  // 2. Add liquidity
  console.log('\n2. Adding liquidity to pool...');
  const addLiquidityTx = await pool.addLiquidity(config.liquidity.chipAmount).send({
    feeLimit: 100 * 1e6,
    callValue: config.liquidity.trxAmount
  });
  console.log(`✓ Add liquidity tx: ${addLiquidityTx}`);
  
  // 3. 验证储备
  console.log('\n3. Verifying reserves...');
  const poolTrxBalance = await tronWeb.trx.getBalance(deploymentInfo.pool);
  const poolChipBalance = await chipToken.balanceOf(deploymentInfo.pool).call();
  
  console.log(`✓ Pool TRX: ${Number(poolTrxBalance) / 1e6} TRX`);
  console.log(`✓ Pool CHIP: ${Number(poolChipBalance) / 1e6} CHIP`);
  
  // 4. 获取 LP token 余额
  const lpBalance = await pool.balanceOf(provider).call();
  console.log(`✓ Your LP tokens: ${Number(lpBalance) / 1e6}`);
  
  console.log('\n========================================');
  console.log('✓ Liquidity Added Successfully!');
  console.log('========================================');
  
  return {
    trxBalance: Number(poolTrxBalance),
    chipBalance: Number(poolChipBalance),
    lpTokens: Number(lpBalance)
  };
}

// 执行
addLiquidity()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

module.exports = { addLiquidity };
