/**
 * CHIP Token 和 AMM Pool 部署脚本
 * 
 * 优化方案：
 * - 总供应量: 1,000,000 CHIP (销毁 99.9%)
 * - 测试网流动性: 500 TRX + 5,000 CHIP
 * - 正式网 Demo: 500 TRX + 5,000 CHIP
 * - 正式网正式: 2,000-10,000 TRX (根据用户量扩展)
 */
const { TronWeb } = require('tronweb');
const fs = require('fs');
const path = require('path');

// 加载环境变量
const NETWORK = process.env.TRON_NETWORK || 'testnet';
require('dotenv').config({ path: `.env.${NETWORK}` });

const CONFIG = {
  testnet: {
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io',
    initialSupply: 1_000_000 * 1e6, // 1 million CHIP
    liquidity: {
      trxAmount: 500 * 1e6, // 500 TRX
      chipAmount: 5_000 * 1e6 // 5,000 CHIP
    }
  },
  mainnet: {
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io',
    initialSupply: 1_000_000 * 1e6, // 1 million CHIP
    liquidity: {
      trxAmount: 500 * 1e6, // 500 TRX (Demo)
      chipAmount: 5_000 * 1e6 // 5,000 CHIP (Demo)
    }
  }
};

const config = CONFIG[NETWORK];

/**
 * 编译合约
 */
async function compileContract(contractName, contractPath) {
  console.log(`\n=== Compiling ${contractName} ===`);
  
  const source = fs.readFileSync(contractPath, 'utf8');
  
  const input = {
    language: 'Solidity',
    sources: {
      [contractName]: { content: source }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };
  
  // 需要导入 OpenZeppelin 合约
  // 这里假设已经编译好，使用 artifacts 目录
  const artifactPath = path.join(__dirname, `../artifacts/${contractName.replace('.sol', '')}.json`);
  
  if (fs.existsSync(artifactPath)) {
    console.log(`Using pre-compiled artifact: ${artifactPath}`);
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  }
  
  // 如果没有预编译的 artifact，尝试编译
  console.log('Compiling from source...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    console.error('Compilation errors:', output.errors);
    throw new Error('Compilation failed');
  }
  
  const contract = output.contracts[contractName][contractName.replace('.sol', '')];
  
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  };
}

/**
 * 部署 CHIP Token
 */
async function deployChipToken(tronWeb, deployer) {
  console.log('\n=== Deploying CHIP Token ===');
  console.log(`Total Supply: ${config.initialSupply / 1e6} CHIP`);
  
  // 使用 Hardhat 编译好的 artifacts
  const artifactPath = path.join(__dirname, `../artifacts/contracts/ChipToken.sol/ChipToken.json`);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Please run 'npx hardhat compile' first.`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const contract = await tronWeb.contract().new({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    feeLimit: 1000 * 1e6, // 1000 TRX
    callValue: 0,
    userFeePercentage: 100,
    originEnergyLimit: 10 * 1e6,
    parameters: [config.initialSupply]
  });
  
  const chipTokenAddress = tronWeb.address.fromHex(contract.address);
  console.log(`✓ CHIP Token deployed at: ${chipTokenAddress}`);
  
  // 验证总供应量
  const totalSupply = await contract.totalSupply().call();
  console.log(`✓ Total Supply verified: ${Number(totalSupply) / 1e6} CHIP`);
  
  // 验证部署者余额
  const deployerBalance = await contract.balanceOf(deployer).call();
  console.log(`✓ Deployer balance: ${Number(deployerBalance) / 1e6} CHIP`);
  
  return chipTokenAddress;
}

/**
 * 部署 AMM Pool
 */
async function deployAmmPool(tronWeb, chipTokenAddress) {
  console.log('\n=== Deploying AMM Pool ===');
  
  // 使用 Hardhat 编译好的 artifacts
  const artifactPath = path.join(__dirname, `../artifacts/contracts/AMMPool.sol/AMMPool.json`);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Please run 'npx hardhat compile' first.`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const contract = await tronWeb.contract().new({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    feeLimit: 1000 * 1e6, // 1000 TRX
    callValue: 0,
    userFeePercentage: 100,
    originEnergyLimit: 10 * 1e6,
    parameters: [chipTokenAddress]
  });
  
  console.log(`✓ AMM Pool deployed at: ${contract.address}`);
  
  return contract.address;
}

/**
 * 部署 AMM Router
 */
async function deployAmmRouter(tronWeb, poolAddress, chipTokenAddress) {
  console.log('\n=== Deploying AMM Router ===');
  
  // 使用 Hardhat 编译好的 artifacts
  const artifactPath = path.join(__dirname, `../artifacts/contracts/AMMRouter.sol/AMMRouter.json`);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Please run 'npx hardhat compile' first.`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const contract = await tronWeb.contract().new({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    feeLimit: 1000 * 1e6, // 1000 TRX
    callValue: 0,
    userFeePercentage: 100,
    originEnergyLimit: 10 * 1e6,
    parameters: [poolAddress, chipTokenAddress]
  });
  
  console.log(`✓ AMM Router deployed at: ${contract.address}`);
  
  return contract.address;
}

/**
 * 添加初始流动性
 */
async function addInitialLiquidity(tronWeb, deployer, chipTokenAddress, poolAddress) {
  console.log('\n=== Adding Initial Liquidity ===');
  console.log(`TRX Amount: ${config.liquidity.trxAmount / 1e6} TRX`);
  console.log(`CHIP Amount: ${config.liquidity.chipAmount / 1e6} CHIP`);
  
  const chipToken = await tronWeb.contract().at(chipTokenAddress);
  const pool = await tronWeb.contract().at(poolAddress);
  
  // 1. Approve CHIP to pool
  console.log('Approving CHIP to pool...');
  const approveTx = await chipToken.approve(poolAddress, config.liquidity.chipAmount).send({
    feeLimit: 100 * 1e6
  });
  console.log(`✓ Approve tx: ${approveTx}`);
  
  // 2. Transfer CHIP to pool
  console.log('Transferring CHIP to pool...');
  const transferTx = await chipToken.transfer(poolAddress, config.liquidity.chipAmount).send({
    feeLimit: 100 * 1e6
  });
  console.log(`✓ Transfer CHIP tx: ${transferTx}`);
  
  // 3. Send TRX to pool and mint LP tokens
  console.log('Sending TRX to pool and minting LP tokens...');
  const mintTx = await pool.mint(deployer).send({
    feeLimit: 100 * 1e6,
    callValue: config.liquidity.trxAmount
  });
  console.log(`✓ Mint LP tokens tx: ${mintTx}`);
  
  // 4. Verify reserves
  const trxBalance = await tronWeb.trx.getBalance(poolAddress);
  const chipBalance = await chipToken.balanceOf(poolAddress).call();
  
  console.log(`\n✓ Pool TRX Balance: ${Number(trxBalance) / 1e6} TRX`);
  console.log(`✓ Pool CHIP Balance: ${Number(chipBalance) / 1e6} CHIP`);
  
  // 5. Check LP token balance
  const lpBalance = await pool.balanceOf(deployer).call();
  console.log(`✓ Your LP tokens: ${Number(lpBalance) / 1e18}`);
  
  return {
    trxBalance: Number(trxBalance),
    chipBalance: Number(chipBalance),
    lpTokens: Number(lpBalance)
  };
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log(`CHIP & AMM Deployment - ${NETWORK.toUpperCase()}`);
  console.log('========================================');
  
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
  
  const deployer = tronWeb.address.fromPrivateKey(privateKey);
  console.log(`Deployer: ${deployer}`);
  
  // 检查部署者余额
  const balance = await tronWeb.trx.getBalance(deployer);
  console.log(`Deployer TRX Balance: ${Number(balance) / 1e6} TRX`);
  
  // 需要约 1100 TRX: 部署 600 + 流动性 500
  const requiredBalance = 1100 * 1e6;
  if (Number(balance) < requiredBalance) {
    console.error('Insufficient TRX balance. Need at least 1100 TRX for deployment.');
    process.exit(1);
  }
  
  try {
    // 1. 部署 CHIP Token
    const chipTokenAddress = await deployChipToken(tronWeb, deployer);
    
    // 2. 部署 AMM Pool
    const poolAddress = await deployAmmPool(tronWeb, chipTokenAddress);
    
    // 3. 部署 AMM Router
    const routerAddress = await deployAmmRouter(tronWeb, poolAddress, chipTokenAddress);
    
    // 4. 添加初始流动性
    const liquidityResult = await addInitialLiquidity(tronWeb, deployer, chipTokenAddress, poolAddress);
    
    // 5. 保存部署信息
    const deploymentInfo = {
      network: NETWORK,
      deployer: deployer,
      chipToken: chipTokenAddress,
      pool: poolAddress,
      router: routerAddress,
      initialSupply: config.initialSupply,
      liquidity: {
        trx: liquidityResult.trxBalance,
        chip: liquidityResult.chipBalance
      },
      deployedAt: new Date().toISOString()
    };
    
    const deploymentPath = path.join(__dirname, `../deployments/chip-amm-${NETWORK}.json`);
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log('\n========================================');
    console.log('✓ Deployment Complete!');
    console.log('========================================');
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // 6. 输出环境变量配置
    console.log('\n========================================');
    console.log('Add to .env file:');
    console.log('========================================');
    console.log(`CHIP_TOKEN_ADDRESS=${chipTokenAddress}`);
    console.log(`AMM_POOL_ADDRESS=${poolAddress}`);
    console.log(`AMM_ROUTER_ADDRESS=${routerAddress}`);
    console.log(`CHIP_DAILY_REWARD_LIMIT=5000`);
    console.log(`CHIP_RESERVE_TARGET=500000`);
    
    return deploymentInfo;
    
  } catch (error) {
    console.error('\n========================================');
    console.error('✗ Deployment Failed!');
    console.error('========================================');
    console.error(error);
    throw error;
  }
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { main, deployChipToken, deployAmmPool, deployAmmRouter, addInitialLiquidity };
