const mongoose = require('mongoose');
const ChipTransaction = require('./server/models/ChipTransaction');

mongoose.connect('mongodb://localhost:27017/poker', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const walletAddress = 'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv';
    
    // Create initial balance
    const tx = await ChipTransaction.createTransaction({
      walletAddress,
      type: 'reward',
      amount: 10000,
      description: 'Initial CHIP balance for testing'
    });
    
    console.log('Created initial balance:', tx);
    
    // Calculate total balance
    const result = await ChipTransaction.aggregate([
      { $match: { walletAddress: walletAddress.toLowerCase() } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    console.log('Total balance:', result.length > 0 ? result[0].total : 0);
    
    mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
