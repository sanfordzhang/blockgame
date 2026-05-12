/**
 * 验证锦标赛结算 - 数据库记录
 * 检查双人赛是否正确分配 100% 给第一名
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;

const RankingSchema = new Schema({
    address: { type: String, required: true, lowercase: true },
    position: { type: Number, required: true },
    prize: { type: Number, default: 0 }
}, { _id: false });

const tournamentSchema = new Schema({
    tournamentId: { type: String, required: true, unique: true },
    status: { type: String },
    players: [],
    rankings: [RankingSchema],
    buyIn: { type: Number, default: 100000000 },
    playerCount: { type: Number, default: 2 },
    rakeAmount: { type: Number },
    createdAt: { type: Date, default: Date.now },
    finishedAt: { type: Date }
});

const Tournament = mongoose.model('Tournament', tournamentSchema);

async function verify() {
    await mongoose.connect('mongodb://localhost:27017/bridge-poker', { useNewUrlParser: true, useUnifiedTopology: true });
    
    console.log('=== 锦标赛结算验证 ===\n');
    
    // Get recent completed tournaments (2-player)
    const tournaments = await Tournament.find({ 
        status: 'COMPLETED',
        playerCount: 2 
    }).sort({ finishedAt: -1 }).limit(5);
    
    console.log(`找到 ${tournaments.length} 个已完成的双人锦标赛\n`);
    
    for (const t of tournaments) {
        const prizePool = 2 * t.buyIn - (t.rakeAmount || 10000000); // 200 - 10 = 190 TRX
        const expectedWinnerPrize = prizePool; // 100% to winner
        
        console.log(`锦标赛 #${t.tournamentId}`);
        console.log(`  BuyIn: ${t.buyIn / 1e6} TRX`);
        console.log(`  Rake: ${(t.rakeAmount || 10000000) / 1e6} TRX`);
        console.log(`  奖池: ${prizePool / 1e6} TRX`);
        console.log(`  预期第一名奖金: ${expectedWinnerPrize / 1e6} TRX`);
        
        if (t.rankings && t.rankings.length > 0) {
            for (const r of t.rankings) {
                const isCorrect = r.position === 1 && r.prize === expectedWinnerPrize;
                const status = isCorrect ? '✅' : '❌';
                console.log(`  ${status} #${r.position}: ${r.address?.substring(0,10)}... 奖金: ${(r.prize || 0) / 1e6} TRX`);
            }
        }
        console.log('');
    }
    
    await mongoose.disconnect();
}

verify().catch(console.error);
