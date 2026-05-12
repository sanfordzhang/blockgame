const mongoose = require('mongoose');
const ChipTransaction = require('./server/models/ChipTransaction');

mongoose.connect('mongodb://localhost:27017/bridge-poker', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const walletAddress = 'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv';
    
    // Delete ALL transactions for this wallet
    const deleteResult = await ChipTransaction.deleteMany({ walletAddress });
    console.log(`Deleted ${deleteResult.deletedCount} existing transactions for wallet`);
    
    // Create fresh test data
    const now = new Date();
    
    // Initial balance - large amount first
    await ChipTransaction.createTransaction({
      walletAddress,
      type: 'reward',
      amount: 10000,
      description: 'Initial CHIP airdrop',
      timestamp: new Date(now - 3600000 * 48)
    });
    
    // Add some reasonable transactions
    const testTxs = [
      { type: 'reward', amount: 200, description: 'Game reward - Straight', gameId: 'game-001' },
      { type: 'reward', amount: 150, description: 'Tournament reward', tournamentId: 'tournament-001' },
      { type: 'reward', amount: 300, description: 'Game reward - Flush', gameId: 'game-002' },
      { type: 'stake', amount: -500, description: 'Staked for 30 days', lockDays: 30 },
      { type: 'claim', amount: 50, description: 'Claimed staking reward' },
      { type: 'transfer', amount: -100, description: 'Transfer to TX27...', toAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' },
      { type: 'receive', amount: 200, description: 'Received from TX27...', fromAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' },
      { type: 'vip_discount', amount: 30, description: 'VIP discount applied' },
    ];
    
    for (let i = 0; i < testTxs.length; i++) {
      const txData = testTxs[i];
      await ChipTransaction.createTransaction({
        walletAddress,
        ...txData,
        timestamp: new Date(now - (i * 3600000))
      });
    }
    
    // Calculate final balance
    const result = await ChipTransaction.aggregate([
      { $match: { walletAddress: walletAddress.toLowerCase() } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalBalance = result.length > 0 ? result[0].total : 0;
    console.log(`\nFinal total balance: ${totalBalance} CHIP`);
    console.log(`Wallet page should show: ${totalBalance} CHIP`);
    
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
