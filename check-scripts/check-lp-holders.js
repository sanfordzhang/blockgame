/**
 * 查询 LP Token 持有者
 */
const { TronWeb } = require('tronweb');

require('dotenv').config({ path: '.env.testnet' });

async function checkLPHolders() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io'
    });
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

    const poolAddress = process.env.AMM_POOL_ADDRESS;
    console.log('Pool Address:', poolAddress);

    try {
        const poolContract = await tronWeb.contract().at(poolAddress);
        
        // 查询总供应量
        const totalSupply = await poolContract.totalSupply().call();
        console.log('\nTotal LP Supply:', (parseInt(totalSupply._hex || totalSupply.toString()) / 1e8).toFixed(4));

        // 尝试查询一些已知地址的余额
        const knownAddresses = [
            'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv', // PLAYER1
            'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4', // PLAYER2
            'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA', // Deployer
            poolAddress // Pool 自身
        ];

        console.log('\n--- LP Token Balances ---');
        for (const addr of knownAddresses) {
            try {
                const balance = await poolContract.balanceOf(addr).call();
                const balanceNum = parseInt(balance._hex || balance.toString()) / 1e8;
                if (balanceNum > 0) {
                    console.log(`${addr}: ${balanceNum.toFixed(4)} LP Tokens`);
                }
            } catch (e) {
                console.log(`${addr}: Error - ${e.message}`);
            }
        }

        // 查询池的 owner
        const owner = await poolContract.owner().call();
        const ownerAddress = tronWeb.address.fromHex(owner);
        console.log('\nPool Owner:', ownerAddress);

        // 查询 owner 的 LP 余额
        const ownerBalance = await poolContract.balanceOf(ownerAddress).call();
        const ownerBalanceNum = parseInt(ownerBalance._hex || ownerBalance.toString()) / 1e8;
        console.log(`Owner LP Balance: ${ownerBalanceNum.toFixed(4)}`);

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

checkLPHolders()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
