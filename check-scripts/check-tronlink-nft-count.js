/**
 * 获取 TronLink 钱包中的 NFT 收藏品数量
 * 
 * 方法1: 通过 CDP 和 tronWeb API
 * 方法2: 通过 TronScan API
 * 方法3: 通过 TronGrid API
 */
const CDP = require('chrome-remote-interface');
const axios = require('axios');
const { TronWeb } = require('tronweb');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

const PLAYER_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function getNFTViaTronWeb() {
    log('\n[方法1] 通过 CDP + tronWeb API 获取');
    
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime, Target } = client;
        await Page.enable();
        await Runtime.enable();

        // 找到游戏页面
        const { targetInfos } = await Target.getTargets();
        const gameTarget = targetInfos.find(t => t.url?.includes('127.0.0.1:3001'));
        
        if (gameTarget) {
            await Target.activateTarget({ targetId: gameTarget.targetId });
            await sleep(500);
        }

        const result = await new Promise((resolve, reject) => {
            Runtime.evaluate({
                expression: `(async function() {
                    if (!window.tronWeb) return { error: 'No tronWeb' };
                    
                    const address = window.tronWeb.defaultAddress?.base58;
                    const contractAddress = window.__NFT_CONTRACT_ONCHAIN || '${NFT_CONTRACT}';
                    
                    try {
                        const contract = await window.tronWeb.contract().at(contractAddress);
                        const balance = await contract.balanceOf(address).call();
                        
                        // 尝试获取部分 token URI
                        const tokenInfo = [];
                        const total = parseInt(balance.toString ? balance.toString() : balance);
                        
                        for (let i = 0; i < Math.min(total, 5); i++) {
                            try {
                                const tokenId = await contract.tokenOfOwnerByIndex(address, i).call();
                                const uri = await contract.tokenURI(tokenId).call();
                                tokenInfo.push({
                                    tokenId: tokenId.toString ? tokenId.toString() : tokenId,
                                    uri: uri.substring(0, 50) + '...'
                                });
                            } catch (_) {}
                        }
                        
                        return {
                            success: true,
                            address: address,
                            contract: contractAddress,
                            totalNFTs: total,
                            samples: tokenInfo
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                })()`,
                returnByValue: true,
                awaitPromise: true
            }, (err, result) => {
                if (err) reject(err);
                else resolve(result.result?.value);
            });
        });

        await client.close();
        return result;
    } catch (e) {
        return { error: e.message };
    }
}

async function getNFTViaTronGrid() {
    log('\n[方法2] 通过 TronGrid API 获取');
    
    try {
        // TronGrid API (Nile testnet)
        const url = `https://nile.trongrid.io/v1/accounts/${PLAYER_ADDRESS}/transactions/trc20?limit=20&contract_address=${NFT_CONTRACT}`;
        
        const response = await axios.get(url, {
            headers: { 'TRON-PRO-API-KEY': '' } // 可选
        });
        
        return {
            success: true,
            source: 'TronGrid API',
            data: response.data
        };
    } catch (e) {
        return { error: e.message };
    }
}

async function getNFTViaTronScan() {
    log('\n[方法3] 通过 TronScan API 获取');
    
    try {
        // TronScan API (Nile testnet)
        const url = `https://nileapi.tronscan.org/api/account/tokens?address=${PLAYER_ADDRESS}`;
        
        const response = await axios.get(url);
        const tokens = response.data?.trc721 || response.data?.data || [];
        
        // 找到我们的 NFT 合约
        const ourNFTs = tokens.filter(t => 
            t.tokenId === NFT_CONTRACT || 
            t.contract_address === NFT_CONTRACT
        );
        
        return {
            success: true,
            source: 'TronScan API',
            totalTRC721: tokens.length,
            ourContractNFTs: ourNFTs.length,
            allNFTs: tokens.map(t => ({
                name: t.name || t.tokenName,
                symbol: t.symbol,
                balance: t.balance,
                contract: t.tokenId || t.contract_address
            }))
        };
    } catch (e) {
        return { error: e.message };
    }
}

async function getNFTViaNodeJS() {
    log('\n[方法4] 通过 Node.js TronWeb 直接获取');
    
    try {
        const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
        
        const contract = await tronWeb.contract().at(NFT_CONTRACT);
        const balance = await contract.balanceOf(PLAYER_ADDRESS).call();
        const total = parseInt(balance.toString ? balance.toString() : balance);
        
        // 获取 token IDs
        const tokenIds = [];
        for (let i = 0; i < Math.min(total, 50); i++) {
            try {
                const tokenId = await contract.tokenOfOwnerByIndex(PLAYER_ADDRESS, i).call();
                tokenIds.push(tokenId.toString ? tokenId.toString() : tokenId);
            } catch (_) {
                break;
            }
        }
        
        return {
            success: true,
            source: 'Node.js TronWeb',
            address: PLAYER_ADDRESS,
            contract: NFT_CONTRACT,
            totalNFTs: total,
            tokenIds: tokenIds
        };
    } catch (e) {
        return { error: e.message };
    }
}

async function main() {
    log('========================================');
    log(' TronLink 钱包 NFT 收藏品查询');
    log('========================================');
    log(`钱包地址: ${PLAYER_ADDRESS}`);
    log(`NFT 合约: ${NFT_CONTRACT}`);
    
    // 方法1: CDP + tronWeb
    const result1 = await getNFTViaTronWeb();
    if (result1?.success) {
        log('\n----------------------------------------');
        log(`✅ 通过 tronWeb 查询成功`);
        log(`   地址: ${result1.address}`);
        log(`   NFT 收藏品数量: **${result1.totalNFTs} 个**`);
        if (result1.samples?.length > 0) {
            log(`   示例 Token IDs: ${result1.samples.map(s => s.tokenId).join(', ')}`);
        }
        log('----------------------------------------');
    } else {
        log(`方法1失败: ${result1?.error}`);
    }
    
    // 方法3: TronScan API
    const result3 = await getNFTViaTronScan();
    if (result3?.success) {
        log('\n----------------------------------------');
        log(`✅ 通过 TronScan API 查询成功`);
        log(`   TRC721 代币种类: ${result3.totalTRC721}`);
        if (result3.allNFTs?.length > 0) {
            log(`   所有 NFT 代币:`);
            result3.allNFTs.forEach(nft => {
                log(`     - ${nft.name} (${nft.symbol}): ${nft.balance} 个`);
            });
        }
        log('----------------------------------------');
    } else {
        log(`方法3失败: ${result3?.error}`);
    }
    
    // 方法4: Node.js TronWeb
    const result4 = await getNFTViaNodeJS();
    if (result4?.success) {
        log('\n----------------------------------------');
        log(`✅ 通过 Node.js TronWeb 查询成功`);
        log(`   地址: ${result4.address}`);
        log(`   NFT 收藏品数量: **${result4.totalNFTs} 个**`);
        log(`   Token IDs: ${result4.tokenIds?.slice(0, 10).join(', ')}${result4.tokenIds?.length > 10 ? '...' : ''}`);
        log('----------------------------------------');
    } else {
        log(`方法4失败: ${result4?.error}`);
    }
    
    log('\n========================================');
    log(' 查询完成');
    log('========================================');
    
    // 返回最终结果
    return {
        tronWeb: result1,
        tronScan: result3,
        nodeJS: result4
    };
}

main().catch(e => { console.error(e); process.exit(1); });
