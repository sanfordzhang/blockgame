#!/usr/bin/env node
/**
 * fund-0g.js - 从服务器钱包向测试账户转 0G 代币
 * 
 * 用法:
 *   ENV_FILE=.env.0g node fund-0g.js <目标地址> [金额]
 * 
 * 示例:
 *   ENV_FILE=.env.0g node fund-0g.js 0xAbc123... 100
 *   ENV_FILE=.env.0g node fund-0g.js 0xAbc123...        (默认 100 0G)
 */

require('dotenv').config({ path: process.env.ENV_FILE || '.env.0g' });

const { ethers } = require('ethers6') || require('ethers');

const RPC_URL = process.env.ZEROG_RPC_URL || 'https://evmrpc-galileo.0g.ai';
const PRIVATE_KEY = process.env.ZEROG_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('[ERROR] ZEROG_PRIVATE_KEY not set in .env.0g');
  process.exit(1);
}

const TARGET_ADDRESS = process.argv[2];
const AMOUNT = parseFloat(process.argv[3] || '100'); // 默认 100 0G

if (!TARGET_ADDRESS) {
  console.error('用法: node fund-0g.js <目标地址> [金额]');
  console.error('示例: node fund-0g.js 0xAbc123... 100');
  process.exit(1);
}

if (!ethers.isAddress(TARGET_ADDRESS)) {
  console.error(`[ERROR] 无效地址: ${TARGET_ADDRESS}`);
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('=== 0G Testnet Fund 脚本 ===');
  console.log('RPC:', RPC_URL);
  console.log('服务器钱包:', wallet.address);

  // 查余额
  const serverBal = await provider.getBalance(wallet.address);
  console.log('服务器余额:', ethers.formatEther(serverBal), '0G');

  if (serverBal === 0n) {
    console.error('\n[ERROR] 服务器钱包余额为 0！请先通过水龙头获取 0G:');
    console.error('  https://faucet.0g.ai/');
    process.exit(1);
  }

  // 转账
  const amountWei = ethers.parseEther(AMOUNT.toString());
  console.log(`\n转账: ${AMOUNT} 0G → ${TARGET_ADDRESS}`);
  console.log('金额 (wei):', amountWei.toString());

  if (amountWei > serverBal) {
    console.error(`[ERROR] 余额不足！需要 ${AMOUNT} 0G，仅有 ${ethers.formatEther(serverBal)} 0G`);
    process.exit(1);
  }

  const tx = await wallet.sendTransaction({
    to: TARGET_ADDRESS,
    value: amountWei
  });

  console.log('\n交易已发送! TX Hash:', tx.hash);
  console.log('等待确认...');

  const receipt = await tx.wait();
  console.log('✅ 确认成功! Block:', receipt.blockNumber);

  // 转后余额
  const afterBal = await provider.getBalance(wallet.address);
  const targetBal = await provider.getBalance(TARGET_ADDRESS);
  console.log('\n--- 转后状态 ---');
  console.log('服务器余额:', ethers.formatEther(afterBal), '0G');
  console.log(`${TARGET_ADDRESS} 余额:`, ethers.formatEther(targetBal), '0G');
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
