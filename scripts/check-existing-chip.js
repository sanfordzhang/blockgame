/**
 * 检查现有 CHIP Token 合约状态
 */
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const CHIP_TOKEN_ADDRESS = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';

async function checkChipToken() {
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
  });

  // 设置默认地址
  const deployerPrivateKey = process.env.TESTNET_PRIVATE_KEY;
  const deployer = tronWeb.address.fromPrivateKey(deployerPrivateKey);
  tronWeb.setAddress(deployer);

  console.log('========================================');
  console.log('检查现有 CHIP Token 合约');
  console.log('========================================\n');
  console.log(`合约地址: ${CHIP_TOKEN_ADDRESS}\n`);

  try {
    // 连接合约
    const chipToken = await tronWeb.contract().at(CHIP_TOKEN_ADDRESS);

    // 获取基本信息
    const name = await chipToken.name().call();
    const symbol = await chipToken.symbol().call();
    const decimals = await chipToken.decimals().call();
    const totalSupply = await chipToken.totalSupply().call();
    const maxSupply = await chipToken.MAX_SUPPLY().call();
    
    console.log('合约信息:');
    console.log(`  名称: ${name}`);
    console.log(`  符号: ${symbol}`);
    console.log(`  精度: ${decimals}`);
    console.log(`  当前供应量: ${Number(totalSupply) / 1e6} CHIP`);
    console.log(`  最大供应量: ${Number(maxSupply) / 1e6} CHIP`);
    console.log('');

    // 检查部署者余额
    console.log(`部署者地址: ${deployer}`);
    const deployerBalance = await chipToken.balanceOf(deployer).call();
    console.log(`部署者余额: ${Number(deployerBalance) / 1e6} CHIP`);
    console.log('');

    // 检查是否需要优化
    const maxSupplyNum = Number(maxSupply);
    const isOptimized = maxSupplyNum === 1_000_000 * 1e6;
    
    console.log('========================================');
    console.log('优化状态检查');
    console.log('========================================');
    
    if (isOptimized) {
      console.log('✓ 供应量已优化 (100 万 CHIP)');
      console.log('✓ 无需重新部署 CHIP Token');
      console.log('\n可以直接部署 AMM Pool');
    } else {
      console.log('✗ 供应量未优化 (10 亿 CHIP)');
      console.log('✗ 需要部署新的 CHIP Token');
      console.log('\n建议:');
      console.log('1. 部署新的 CHIP Token (100 万供应量)');
      console.log('2. 部署 AMM Pool');
      console.log('3. 迁移 Staking 合约 (可选)');
    }

    return {
      isOptimized,
      maxSupply: Number(maxSupply) / 1e6,
      currentSupply: Number(totalSupply) / 1e6,
      deployerBalance: Number(deployerBalance) / 1e6
    };

  } catch (error) {
    console.error('检查失败:', error.message);
    throw error;
  }
}

checkChipToken()
  .then(result => {
    console.log('\n检查完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('错误:', error);
    process.exit(1);
  });
