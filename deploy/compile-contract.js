const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.resolve(__dirname, 'contracts', 'AchievementNFTOnChain.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'AchievementNFTOnChain.sol': { content: source }
    },
    settings: {
        outputSelection: {
            '*': { '*': ['abi', 'evm.bytecode'] }
        }
    }
};

console.log('🔨 编译合约...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach(err => {
        if (err.severity === 'error') {
            console.error('❌', err.formattedMessage);
        }
    });
}

const contract = output.contracts['AchievementNFTOnChain.sol']['AchievementNFTOnChain'];
if (!contract) {
    console.error('❌ 编译失败');
    process.exit(1);
}

fs.writeFileSync('build/AchievementNFTOnChain.json', JSON.stringify({
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
}, null, 2));

console.log('✅ 编译成功');
console.log('ABI 和 bytecode 已保存到 build/AchievementNFTOnChain.json');
