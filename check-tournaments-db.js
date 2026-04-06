const mongoose = require('mongoose');
const { Schema } = mongoose;

const TournamentPlayerSchema = new Schema({
    address: { type: String, required: true, lowercase: true },
    socketId: { type: String, default: null },
    joinedAt: { type: Date, default: Date.now },
    finalPosition: { type: Number, default: null },
    prizeAmount: { type: Number, default: null },
    claimed: { type: Boolean, default: false }
}, { _id: false });

const RankingSchema = new Schema({
    address: { type: String, required: true, lowercase: true },
    position: { type: Number, required: true },
    prize: { type: Number, default: 0 }
}, { _id: false });

const tournamentSchema = new Schema({
    tournamentId: { type: String, required: true, unique: true },
    configId: { type: Number, default: 1 },
    status: { type: String, enum: ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'WAITING' },
    players: [TournamentPlayerSchema],
    rankings: [RankingSchema],
    buyIn: { type: Number, default: 100000000 },
    playerCount: { type: Number, default: 2 },
    prizePool: { type: Number, default: 0 },
    rakeAmount: { type: Number },
    mockGame: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    finishedAt: { type: Date }
});

const Tournament = mongoose.model('Tournament', tournamentSchema);

async function check() {
    await mongoose.connect('mongodb://localhost:27017/bridge-poker', { useNewUrlParser: true, useUnifiedTopology: true });
    
    console.log('Checking tournaments...');
    const count = await Tournament.countDocuments();
    console.log('Total tournaments:', count);
    
    const recent = await Tournament.find().sort({ createdAt: -1 }).limit(5);
    
    for (const t of recent) {
        console.log('\n---');
        console.log('Tournament ID:', t.tournamentId);
        console.log('Status:', t.status);
        console.log('Players:', t.players?.map(p => ({ addr: p.address?.substring(0,10), pos: p.finalPosition, prize: p.prizeAmount })));
        console.log('Rankings:', t.rankings);
        console.log('BuyIn:', t.buyIn);
        console.log('RakeAmount:', t.rakeAmount);
        console.log('Created:', t.createdAt);
        console.log('Finished:', t.finishedAt);
    }
    
    await mongoose.disconnect();
}

check().catch(console.error);
