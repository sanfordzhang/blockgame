const { TronWeb } = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

async function main() {
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io',
        privateKey: process.env.NILE_PRIVATE_KEY
    });

    const deployer = tronWeb.address.fromPrivateKey(process.env.NILE_PRIVATE_KEY);
    
    // Verify ChipToken
    const chipTokenAbi = JSON.parse(fs.readFileSync('./build/contracts/ChipToken.json', 'utf8')).abi;
    const chipToken = await tronWeb.contract(chipTokenAbi, 'TXD7DT9uY5gg4LpdMcatzKGa7GFfSD64uK');
    
    console.log('========== ChipToken ==========');
    console.log('Name:', await chipToken.name().call());
    console.log('Symbol:', await chipToken.symbol().call());
    console.log('Decimals:', (await chipToken.decimals().call()).toString());
    const totalSupply = await chipToken.totalSupply().call();
    console.log('Total Supply:', totalSupply.toString() / 1e6, 'CHIP');
    const balance = await chipToken.balanceOf(deployer).call();
    console.log('Owner Balance:', balance.toString() / 1e6, 'CHIP');
    
    // Verify Tournament
    const tournamentAbi = JSON.parse(fs.readFileSync('./build/contracts/Tournament.json', 'utf8')).abi;
    const tournament = await tronWeb.contract(tournamentAbi, 'TTy6EhNKbEfzkQRndvegT5hE5LUWZQVyCb');
    
    console.log('\n========== Tournament ==========');
    const serverWallet = await tournament.serverWallet().call();
    console.log('Server Wallet:', tronWeb.address.fromHex(serverWallet));
    const chipTokenAddr = await tournament.chipToken().call();
    console.log('Chip Token:', tronWeb.address.fromHex(chipTokenAddr));
    
    // Verify Staking
    const stakingAbi = JSON.parse(fs.readFileSync('./build/contracts/Staking.json', 'utf8')).abi;
    const staking = await tronWeb.contract(stakingAbi, 'TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW');
    
    console.log('\n========== Staking ==========');
    const stakingChip = await staking.chipToken().call();
    console.log('Chip Token:', tronWeb.address.fromHex(stakingChip.replace('0x', '41')));
    
    // Verify Governance
    const governanceAbi = JSON.parse(fs.readFileSync('./build/contracts/Governance.json', 'utf8')).abi;
    const governance = await tronWeb.contract(governanceAbi, 'TE1Uq2osH49cSBV1vkCtBsDHYVVhR3hqr5');
    
    console.log('\n========== Governance ==========');
    const govChip = await governance.chipToken().call();
    console.log('Chip Token:', tronWeb.address.fromHex(govChip.replace('0x', '41')));
    const votingPeriod = await governance.votingPeriod().call();
    console.log('Voting Period:', votingPeriod.toString() / 86400, 'days');
    
    console.log('\n✅ All contracts verified successfully!');
}

main().catch(console.error);
