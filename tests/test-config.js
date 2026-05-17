/**
 * 测试用玩家配置 - 私钥从环境变量读取，不要硬编码
 *
 * 使用方式：
 *   export PLAYER1_PRIVATE_KEY='your-key-here'
 *   export PLAYER2_PRIVATE_KEY='your-key-here'
 *   node your-test-script.js
 */
const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';

function getPlayerConfig() {
  const p1Key = process.env.PLAYER1_PRIVATE_KEY || '';
  const p2Key = process.env.PLAYER2_PRIVATE_KEY || '';

  if (!p1Key && !p2Key) {
    console.warn('[test-config] WARNING: PLAYER1_PRIVATE_KEY / PLAYER2_PRIVATE_KEY not set');
  }

  return {
    PLAYER1: {
      address: PLAYER1_ADDRESS,
      privateKey: p1Key,
    },
    PLAYER2: {
      address: PLAYER2_ADDRESS,
      privateKey: p2Key,
    },
    // 0G EVM 地址
    PLAYER1_0G_ADDRESS: '0xe6e729f4cf0dfb5f4b558a7c6f09e83863bcc527',
    PLAYER2_0G_ADDRESS: '0xc7457b452780a641ff4c5c922034accd6e6b9b79',
  };
}

module.exports = { getPlayerConfig, PLAYER1_ADDRESS, PLAYER2_ADDRESS };
