/**
 * 合约验证脚本
 * 验证已部署的AMM合约
 */
const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');

async function verifyContracts(network = 'nile') {
    // 加载部署信息
    const deploymentPath = path.join(__dirname, `../deployments/amm-${network}.json`);
    
    if (!fs.existsSync(deploymentPath)) {
        console.error(`Deployment file not found: ${deploymentPath}`);
        process.exit(1);
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log('Deployment info:', deployment);
    
    // 初始化TronWeb
    const fullHost = network === 'mainnet' 
        ? 'https://api.trongrid.io'
        : 'https://nile.trongrid.io';
    
    const tronWeb = new TronWeb({ fullHost });
    
    try {
        // 验证Pool合约
        console.log('\n=== Verifying AMMPool ===');
        const poolContract = await tronWeb.contract().at(deployment.pool);
        
        const token = await poolContract.token().call();
        const owner = await poolContract.owner().call();
        const paused = await poolContract.paused().call();
        const totalSupply = await poolContract.totalSupply().call();
        
        console.log(`Token address: ${tronWeb.address.fromHex(token)}`);
        console.log(`Owner: ${tronWeb.address.fromHex(owner)}`);
        console.log(`Paused: ${paused}`);
        console.log(`Total Supply: ${totalSupply.toString()}`);
        
        // 验证储备量
        const reserves = await poolContract.getReserves().call();
        console.log(`Reserve TRX: ${reserves[0].toString()}`);
        console.log(`Reserve CHIP: ${reserves[1].toString()}`);
        
        // 验证Router合约
        console.log('\n=== Verifying AMMRouter ===');
        const routerContract = await tronWeb.contract().at(deployment.router);
        
        const pool = await routerContract.pool().call();
        const tokenRouter = await routerContract.token().call();
        
        console.log(`Pool address: ${tronWeb.address.fromHex(pool)}`);
        console.log(`Token address: ${tronWeb.address.fromHex(tokenRouter)}`);
        
        // 验证地址匹配
        console.log('\n=== Verification Results ===');
        
        const poolMatch = tronWeb.address.fromHex(pool) === deployment.pool;
        const tokenMatch = tronWeb.address.fromHex(token) === deployment.token;
        
        console.log(`Pool address match: ${poolMatch ? '✓' : '✗'}`);
        console.log(`Token address match: ${tokenMatch ? '✓' : '✗'}`);
        
        if (poolMatch && tokenMatch) {
            console.log('\n✓ All verifications passed!');
        } else {
            console.log('\n✗ Some verifications failed!');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Verification failed:', error);
        throw error;
    }
}

// 主函数
async function main() {
    const network = process.argv[2] || 'nile';
    console.log(`Verifying contracts on ${network}...`);
    await verifyContracts(network);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

module.exports = { verifyContracts };
