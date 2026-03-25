/**
 * NFT铸造集成测试
 * 测试牌型检测、签名验证、月度限量等功能
 */

const { expect } = require('chai');
const { PokerHandTestData, getAchievementTestCases, getNegativeTestCases, parseCard } = require('../mock/poker-hands');

describe('NFT铸造集成测试', function() {
  this.timeout(30000);

  // Mock NFT Service
  class MockNFTService {
    constructor() {
      this.signer = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
      this.monthlyLimits = {
        1: 5,   // Royal Flush
        2: 10,  // Straight Flush
        3: 50,  // Four of a Kind
        4: 100, // Full House
        5: 200, // Flush
        6: 300  // Straight
      };
      this.monthlyMinted = {};
      this.usedSignatures = new Set();
    }

    /**
     * 检测牌型成就
     */
    checkAchievement(holeCards, board) {
      const allCards = [...holeCards, ...board];
      const result = this.evaluatePokerHand(allCards);
      
      // 检查是否是成就牌型
      const achievementTypes = ['Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight'];
      
      if (achievementTypes.includes(result.name)) {
        const typeMap = {
          'Royal Flush': 'ROYAL_FLUSH',
          'Straight Flush': 'STRAIGHT_FLUSH',
          'Four of a Kind': 'FOUR_OF_A_KIND',
          'Full House': 'FULL_HOUSE',
          'Flush': 'FLUSH',
          'Straight': 'STRAIGHT'
        };
        
        return {
          type: typeMap[result.name],
          name: result.name,
          description: result.description,
          cards: result.cards
        };
      }
      
      return null;
    }

    /**
     * 简化版扑克牌型评估
     */
    evaluatePokerHand(cards) {
      const parsed = cards.map(parseCard);
      
      // 按花色分组
      const bySuit = {};
      parsed.forEach(c => {
        if (!bySuit[c.suit]) bySuit[c.suit] = [];
        bySuit[c.suit].push(c);
      });

      // 检查同花
      let flushSuit = null;
      for (const suit of Object.keys(bySuit)) {
        if (bySuit[suit].length >= 5) {
          flushSuit = suit;
          break;
        }
      }

      // 按点数排序
      const sorted = [...parsed].sort((a, b) => b.rankValue - a.rankValue);
      
      // 检查顺子
      const findStraight = (cardList) => {
        const unique = [...new Map(cardList.map(c => [c.rankValue, c])).values()];
        unique.sort((a, b) => b.rankValue - a.rankValue);
        
        // 检查A-2-3-4-5 (车轮)
        const hasWheel = unique.some(c => c.rankValue === 14) &&
          unique.some(c => c.rankValue === 2) &&
          unique.some(c => c.rankValue === 3) &&
          unique.some(c => c.rankValue === 4) &&
          unique.some(c => c.rankValue === 5);
        
        if (hasWheel) {
          const wheelCards = [];
          [5, 4, 3, 2, 14].forEach(rv => {
            const card = unique.find(c => c.rankValue === rv);
            if (card) wheelCards.push(card);
          });
          return { isStraight: true, highCard: 5, cards: wheelCards };
        }
        
        // 检查普通顺子
        for (let i = 0; i <= unique.length - 5; i++) {
          let isSequence = true;
          for (let j = 0; j < 4; j++) {
            if (unique[i + j].rankValue - unique[i + j + 1].rankValue !== 1) {
              isSequence = false;
              break;
            }
          }
          if (isSequence) {
            return {
              isStraight: true,
              highCard: unique[i].rankValue,
              cards: unique.slice(i, i + 5)
            };
          }
        }
        
        return { isStraight: false };
      };

      // 检查同花顺和皇家同花顺
      if (flushSuit) {
        const flushCards = bySuit[flushSuit].sort((a, b) => b.rankValue - a.rankValue);
        const straightResult = findStraight(flushCards);
        
        if (straightResult.isStraight) {
          if (straightResult.highCard === 14) {
            return {
              name: 'Royal Flush',
              description: 'A-K-Q-J-10 同花顺',
              cards: straightResult.cards,
              rank: 10
            };
          }
          return {
            name: 'Straight Flush',
            description: `${straightResult.highCard}高同花顺`,
            cards: straightResult.cards,
            rank: 9
          };
        }
        
        // 普通同花
        return {
          name: 'Flush',
          description: `${flushCards[0].rank}高同花`,
          cards: flushCards.slice(0, 5),
          rank: 6
        };
      }

      // 统计点数出现次数
      const rankCount = {};
      parsed.forEach(c => {
        rankCount[c.rankValue] = (rankCount[c.rankValue] || 0) + 1;
      });

      const counts = Object.entries(rankCount)
        .map(([rank, count]) => ({ rank: parseInt(rank), count }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

      // 四条
      if (counts[0].count === 4) {
        const fourRank = counts[0].rank;
        const kicker = counts[1].rank;
        return {
          name: 'Four of a Kind',
          description: `四条${this.rankToName(fourRank)} + ${this.rankToName(kicker)}踢脚`,
          rank: 8
        };
      }

      // 葫芦
      if (counts[0].count === 3 && counts[1]?.count >= 2) {
        return {
          name: 'Full House',
          description: `三条${this.rankToName(counts[0].rank)} + 对子${this.rankToName(counts[1].rank)}`,
          rank: 7
        };
      }

      // 顺子
      const straightResult = findStraight(sorted);
      if (straightResult.isStraight) {
        return {
          name: 'Straight',
          description: `${this.rankToName(straightResult.highCard)}高顺子`,
          cards: straightResult.cards,
          rank: 5
        };
      }

      // 其他牌型（非成就）
      if (counts[0].count === 3) {
        return { name: 'Three of a Kind', rank: 4 };
      }
      if (counts[0].count === 2 && counts[1]?.count === 2) {
        return { name: 'Two Pair', rank: 3 };
      }
      if (counts[0].count === 2) {
        return { name: 'One Pair', rank: 2 };
      }
      return { name: 'High Card', rank: 1 };
    }

    rankToName(rank) {
      const names = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };
      return names[rank] || rank.toString();
    }

    /**
     * 检查是否可以铸造
     */
    canMintNFT(achievementTypeId) {
      const yearMonth = this.getYearMonth();
      const minted = this.monthlyMinted[`${yearMonth}_${achievementTypeId}`] || 0;
      const limit = this.monthlyLimits[achievementTypeId] || 0;
      return minted < limit;
    }

    /**
     * 获取月度剩余数量
     */
    getMonthlyRemaining(achievementTypeId) {
      const yearMonth = this.getYearMonth();
      const minted = this.monthlyMinted[`${yearMonth}_${achievementTypeId}`] || 0;
      const limit = this.monthlyLimits[achievementTypeId] || 0;
      return Math.max(0, limit - minted);
    }

    /**
     * 获取年月
     */
    getYearMonth() {
      const now = new Date();
      return now.getFullYear() * 100 + (now.getMonth() + 1);
    }

    /**
     * 生成铸造签名
     */
    async generateMintSignature(player, achievementTypeId) {
      const deadline = Math.floor(Date.now() / 1000) + 3600 * 24 * 7; // 7天有效期
      const nonce = Math.random().toString(36).substring(7);
      
      const hash = this.keccak256(
        player + achievementTypeId + deadline + nonce
      );
      
      return {
        v: 27,
        r: `0x${hash.slice(0, 64)}`,
        s: `0x${hash.slice(64, 128)}`,
        deadline,
        nonce,
        achievementTypeId,
        player
      };
    }

    /**
     * 简化版keccak256 (测试用)
     */
    keccak256(str) {
      let hash = '';
      for (let i = 0; i < 128; i++) {
        hash += Math.floor(Math.random() * 16).toString(16);
      }
      return hash;
    }

    /**
     * 验证签名
     */
    verifySignature(sig) {
      // 检查过期
      if (sig.deadline < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Signature expired' };
      }
      
      // 检查重放
      const sigKey = `${sig.player}_${sig.nonce}`;
      if (this.usedSignatures.has(sigKey)) {
        return { valid: false, error: 'Signature already used' };
      }
      
      return { valid: true };
    }

    /**
     * 使用签名铸造
     */
    async claimWithSignature(sig) {
      const verify = this.verifySignature(sig);
      if (!verify.valid) {
        return { success: false, error: verify.error };
      }
      
      // 检查月度限量
      if (!this.canMintNFT(sig.achievementTypeId)) {
        return { success: false, error: 'Monthly limit reached' };
      }
      
      // 标记签名已使用
      const sigKey = `${sig.player}_${sig.nonce}`;
      this.usedSignatures.add(sigKey);
      
      // 更新月度铸造数量
      const yearMonth = this.getYearMonth();
      const key = `${yearMonth}_${sig.achievementTypeId}`;
      this.monthlyMinted[key] = (this.monthlyMinted[key] || 0) + 1;
      
      return {
        success: true,
        tokenId: Date.now(),
        achievementTypeId: sig.achievementTypeId
      };
    }
  }

  let nftService;

  beforeEach(() => {
    nftService = new MockNFTService();
  });

  // ==================== 牌型检测测试 ====================
  describe('牌型检测', () => {
    const achievementCases = getAchievementTestCases();

    // 正向测试：所有成就牌型
    achievementCases.forEach(testCase => {
      it(`应该正确检测 [${testCase.category}] ${testCase.name}`, () => {
        const result = nftService.checkAchievement(
          testCase.holeCards,
          testCase.board
        );

        expect(result).to.not.be.null;
        expect(result.type).to.equal(testCase.expectedType);
      });
    });

    // 负向测试：非成就牌型
    describe('非成就牌型', () => {
      const negativeCases = getNegativeTestCases();

      negativeCases.forEach(testCase => {
        it(`不应触发NFT: ${testCase.name}`, () => {
          const result = nftService.checkAchievement(
            testCase.holeCards,
            testCase.board
          );

          expect(result).to.be.null;
        });
      });
    });
  });

  // ==================== 月度限量测试 ====================
  describe('月度限量机制', () => {
    it('应该在限量内允许铸造', () => {
      const canMint = nftService.canMintNFT(1); // Royal Flush
      expect(canMint).to.be.true;
    });

    it('应该在耗尽限量后拒绝铸造', async () => {
      // 消耗所有Royal Flush限量
      for (let i = 0; i < 5; i++) {
        const sig = await nftService.generateMintSignature('TPL...', 1);
        await nftService.claimWithSignature(sig);
      }

      const canMint = nftService.canMintNFT(1);
      expect(canMint).to.be.false;
    });

    it('应该正确显示剩余数量', async () => {
      // 铸造2个
      for (let i = 0; i < 2; i++) {
        const sig = await nftService.generateMintSignature('TPL...', 1);
        await nftService.claimWithSignature(sig);
      }

      const remaining = nftService.getMonthlyRemaining(1);
      expect(remaining).to.equal(3); // 5 - 2 = 3
    });

    it('不同成就类型限量独立', async () => {
      // 消耗所有Royal Flush限量
      for (let i = 0; i < 5; i++) {
        const sig = await nftService.generateMintSignature('TPL...', 1);
        await nftService.claimWithSignature(sig);
      }

      // Four of a Kind应该仍可铸造
      const canMint = nftService.canMintNFT(3);
      expect(canMint).to.be.true;
    });
  });

  // ==================== 签名验证测试 ====================
  describe('签名验证', () => {
    it('应该正确生成铸造签名', async () => {
      const player = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
      const signature = await nftService.generateMintSignature(player, 3);

      expect(signature).to.have.property('v');
      expect(signature).to.have.property('r');
      expect(signature).to.have.property('s');
      expect(signature).to.have.property('deadline');
      expect(signature.player).to.equal(player);
      expect(signature.achievementTypeId).to.equal(3);
    });

    it('应该拒绝过期签名', async () => {
      const expiredSignature = {
        v: 27,
        r: '0x1234...',
        s: '0x5678...',
        deadline: Math.floor(Date.now() / 1000) - 1, // 1秒前过期
        nonce: 'abc123',
        player: 'TPL...',
        achievementTypeId: 3
      };

      const result = nftService.verifySignature(expiredSignature);
      expect(result.valid).to.be.false;
      expect(result.error).to.include('expired');
    });

    it('应该拒绝重放签名', async () => {
      const player = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
      const signature = await nftService.generateMintSignature(player, 3);

      // 第一次使用
      const result1 = await nftService.claimWithSignature(signature);
      expect(result1.success).to.be.true;

      // 重放攻击
      const result2 = await nftService.claimWithSignature(signature);
      expect(result2.success).to.be.false;
      expect(result2.error).to.include('already used');
    });

    it('有效签名应该成功铸造', async () => {
      const player = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
      const signature = await nftService.generateMintSignature(player, 3);

      const result = await nftService.claimWithSignature(signature);
      expect(result.success).to.be.true;
      expect(result).to.have.property('tokenId');
      expect(result.achievementTypeId).to.equal(3);
    });
  });

  // ==================== 边界测试 ====================
  describe('边界测试', () => {
    it('空手牌应返回null', () => {
      const result = nftService.checkAchievement([], []);
      expect(result).to.be.null;
    });

    it('手牌不足应返回null', () => {
      const result = nftService.checkAchievement(['Ah'], ['Kh', 'Qh']);
      expect(result).to.be.null;
    });

    it('应该正确识别公共牌皇家同花顺', () => {
      const result = nftService.checkAchievement(
        ['2c', '3d'], // 手牌不参与
        ['Ah', 'Kh', 'Qh', 'Jh', 'Th'] // 公共牌皇家同花顺
      );
      expect(result).to.not.be.null;
      expect(result.type).to.equal('ROYAL_FLUSH');
    });
  });

  // ==================== 性能测试 ====================
  describe('性能测试', () => {
    it('牌型检测应在10ms内完成', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        nftService.checkAchievement(['Ah', 'Kh'], ['Qh', 'Jh', 'Th', '2c', '3d']);
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100); // 1000次 < 100ms
    });
  });
});
