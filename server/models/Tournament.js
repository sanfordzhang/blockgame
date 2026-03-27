/**
 * Tournament Model - 内存存储版本 (无需MongoDB)
 * 用于测试和开发环境
 */

// 内存存储
const tournaments = new Map();
let idCounter = Date.now();

class TournamentModel {
    constructor(data) {
        this.tournamentId = data.tournamentId || String(++idCounter);
        this.configId = data.configId || 1;
        this.status = data.status || 'WAITING';
        this.players = data.players || [];
        this.txHash = data.txHash || null;
        this.config = data.config || {
            playerCount: 6,
            buyIn: 100000000,
            rakeRate: 500,
            initialChips: 10000000,
            prizeDistribution: [50, 30, 20],
            tournamentType: 'SNG',
            startMode: 'INSTANT',
            name: '6人赛 (100 TRX)'
        };
        this.buyIn = data.buyIn || this.config.buyIn;
        this.playerCount = data.playerCount || this.config.playerCount;
        this.rakeRate = data.rakeRate || this.config.rakeRate;
        this.prizePool = data.prizePool || 0;
        this.createdAt = data.createdAt || new Date();
        this.startedAt = data.startedAt || null;
        this.endedAt = data.endedAt || null;
    }

    addPlayer(address, socketId = null) {
        const existingPlayer = this.players.find(p => p.address === address.toLowerCase());
        if (existingPlayer) {
            return false;
        }
        this.players.push({
            address: address.toLowerCase(),
            socketId,
            joinedAt: new Date(),
            finalPosition: null,
            prizeAmount: null,
            claimed: false
        });
        return true;
    }

    removePlayer(address) {
        const index = this.players.findIndex(p => p.address === address.toLowerCase());
        if (index === -1) return false;
        this.players.splice(index, 1);
        return true;
    }

    start() {
        this.status = 'IN_PROGRESS';
        this.startedAt = new Date();
        return this;
    }

    finish(rankings, prizeDistribution, rakeRate) {
        this.status = 'COMPLETED';
        this.endedAt = new Date();
        
        const totalBuyIn = this.players.length * this.buyIn;
        this.rakeAmount = Math.floor(totalBuyIn * rakeRate / 10000);
        this.prizePool = totalBuyIn - this.rakeAmount;
        
        rankings.forEach((address, index) => {
            const player = this.players.find(p => p.address === address.toLowerCase());
            if (player && prizeDistribution[index]) {
                player.finalPosition = index + 1;
                player.prizeAmount = Math.floor(this.prizePool * prizeDistribution[index] / 100);
            }
        });
        
        return this;
    }

    async save() {
        tournaments.set(this.tournamentId, this);
        return this;
    }

    toJSON() {
        return {
            tournamentId: this.tournamentId,
            configId: this.configId,
            status: this.status,
            players: this.players,
            config: this.config,
            buyIn: this.buyIn,
            playerCount: this.playerCount,
            rakeRate: this.rakeRate,
            prizePool: this.prizePool,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            endedAt: this.endedAt,
            txHash: this.txHash
        };
    }

    // Static methods
    static find(query = {}) {
        let results = Array.from(tournaments.values());
        
        if (query.status) {
            results = results.filter(t => t.status === query.status);
        }
        
        // Sort by createdAt descending
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return {
            sort: (sortObj) => {
                // Already sorted
                return {
                    then: (resolve) => resolve(results)
                };
            },
            then: (resolve) => resolve(results)
        };
    }

    static findOne(query) {
        let result = null;
        
        if (query.tournamentId) {
            result = tournaments.get(query.tournamentId);
        } else if (query.status) {
            for (const t of tournaments.values()) {
                if (t.status === query.status) {
                    result = t;
                    break;
                }
            }
        }
        
        return {
            then: (resolve) => resolve(result || null)
        };
    }

    static findActive() {
        const results = Array.from(tournaments.values())
            .filter(t => t.status === 'WAITING' || t.status === 'IN_PROGRESS')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return {
            then: (resolve) => resolve(results)
        };
    }

    static findWaiting() {
        const results = Array.from(tournaments.values())
            .filter(t => t.status === 'WAITING')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return {
            then: (resolve) => resolve(results)
        };
    }

    static findByPlayer(address) {
        const addr = address.toLowerCase();
        const results = Array.from(tournaments.values())
            .filter(t => t.players.some(p => p.address === addr))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return {
            then: (resolve) => resolve(results)
        };
    }

    // Clear all tournaments (for testing)
    static clearAll() {
        tournaments.clear();
    }
}

module.exports = TournamentModel;
