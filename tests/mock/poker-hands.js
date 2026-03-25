/**
 * NFT牌型模拟数据
 * 用于测试成就检测和NFT铸造功能
 * 
 * 牌编码说明:
 * s = Spades (黑桃)
 * h = Hearts (红桃)
 * d = Diamonds (方块)
 * c = Clubs (梅花)
 * 
 * A = Ace, K = King, Q = Queen, J = Jack
 * T = Ten (10)
 * 2-9 = 对应数字
 */

const AchievementTypes = {
  ROYAL_FLUSH: {
    id: 1,
    name: 'Royal Flush',
    nameCN: '皇家同花顺',
    rarity: 'LEGENDARY',
    monthlyLimit: 5,
    description: 'A-K-Q-J-10 同花色的最大牌型'
  },
  STRAIGHT_FLUSH: {
    id: 2,
    name: 'Straight Flush',
    nameCN: '同花顺',
    rarity: 'EPIC',
    monthlyLimit: 10,
    description: '五张连续同花色牌'
  },
  FOUR_OF_A_KIND: {
    id: 3,
    name: 'Four of a Kind',
    nameCN: '四条',
    rarity: 'RARE',
    monthlyLimit: 50,
    description: '四张相同点数的牌'
  },
  FULL_HOUSE: {
    id: 4,
    name: 'Full House',
    nameCN: '葫芦',
    rarity: 'RARE',
    monthlyLimit: 100,
    description: '三条加一对'
  },
  FLUSH: {
    id: 5,
    name: 'Flush',
    nameCN: '同花',
    rarity: 'COMMON',
    monthlyLimit: 200,
    description: '五张同花色牌'
  },
  STRAIGHT: {
    id: 6,
    name: 'Straight',
    nameCN: '顺子',
    rarity: 'COMMON',
    monthlyLimit: 300,
    description: '五张连续牌'
  }
};

/**
 * 牌型解析工具
 */
function parseCard(cardStr) {
  const rank = cardStr.slice(0, -1);
  const suit = cardStr.slice(-1).toLowerCase();
  
  const rankMap = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
  };
  
  const suitMap = {
    's': 'spades',
    'h': 'hearts', 
    'd': 'diamonds',
    'c': 'clubs'
  };
  
  return {
    rank: rank,
    rankValue: rankMap[rank],
    suit: suit,
    suitName: suitMap[suit],
    toString: () => cardStr
  };
}

/**
 * 完整牌型测试数据
 * 每个牌型包含：玩家手牌、公共牌、预期结果
 */
const PokerHandTestData = {
  // ==================== 皇家同花顺 (Royal Flush) ====================
  royal_flush: [
    {
      name: '红桃皇家同花顺',
      holeCards: ['Ah', 'Kh'],
      board: ['Qh', 'Jh', 'Th', '2c', '3d'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 红桃皇家同花顺',
      rarity: 'LEGENDARY'
    },
    {
      name: '黑桃皇家同花顺',
      holeCards: ['As', 'Ks'],
      board: ['Qs', 'Js', 'Ts', '4c', '5d'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 黑桃皇家同花顺',
      rarity: 'LEGENDARY'
    },
    {
      name: '梅花皇家同花顺',
      holeCards: ['Ac', 'Kc'],
      board: ['Qc', 'Jc', 'Tc', '6h', '7d'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 梅花皇家同花顺',
      rarity: 'LEGENDARY'
    },
    {
      name: '方块皇家同花顺',
      holeCards: ['Ad', 'Kd'],
      board: ['Qd', 'Jd', 'Td', '8h', '9s'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 方块皇家同花顺',
      rarity: 'LEGENDARY'
    },
    {
      name: '公共牌皇家同花顺(手牌参与)',
      holeCards: ['Ah', 'Qh'],
      board: ['Kh', 'Jh', 'Th', '2c', '3d'],
      expectedType: 'ROYAL_FLUSH',
      description: '手牌A-Q配合公共牌K-J-T',
      rarity: 'LEGENDARY'
    }
  ],

  // ==================== 同花顺 (Straight Flush) ====================
  straight_flush: [
    {
      name: '红桃9高同花顺',
      holeCards: ['5h', '6h'],
      board: ['7h', '8h', '9h', '2c', '3d'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '5-6-7-8-9 红桃同花顺',
      rarity: 'EPIC'
    },
    {
      name: '黑桃K高同花顺',
      holeCards: ['9s', 'Ts'],
      board: ['Js', 'Qs', 'Ks', '2c', '3d'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '9-T-J-Q-K 黑桃同花顺',
      rarity: 'EPIC'
    },
    {
      name: '梅花6高同花顺',
      holeCards: ['2c', '3c'],
      board: ['4c', '5c', '6c', 'Kh', 'Ad'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '2-3-4-5-6 梅花同花顺',
      rarity: 'EPIC'
    },
    {
      name: '车轮同花顺(A-2-3-4-5)',
      holeCards: ['Ad', '2d'],
      board: ['3d', '4d', '5d', 'Kh', 'Qs'],
      expectedType: 'STRAIGHT_FLUSH',
      description: 'A-2-3-4-5 方块同花顺(最小同花顺)',
      rarity: 'EPIC'
    },
    {
      name: '方块Q高同花顺',
      holeCards: ['8d', '9d'],
      board: ['Td', 'Jd', 'Qd', 'Ac', 'Ks'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '8-9-T-J-Q 方块同花顺',
      rarity: 'EPIC'
    }
  ],

  // ==================== 四条 (Four of a Kind) ====================
  four_of_a_kind: [
    {
      name: '四条A(口袋对)',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Ac', 'Kh', '2c', '3d'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条A + K踢脚',
      rarity: 'RARE'
    },
    {
      name: '四条K(口袋对)',
      holeCards: ['Kh', 'Kd'],
      board: ['Ks', 'Kc', 'Ah', '2c', '3d'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条K + A踢脚',
      rarity: 'RARE'
    },
    {
      name: '四条2(最小四条)',
      holeCards: ['2h', '2d'],
      board: ['2s', '2c', 'Ah', 'Kc', 'Qd'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条2 + A踢脚',
      rarity: 'RARE'
    },
    {
      name: '四条J',
      holeCards: ['Jh', 'Jd'],
      board: ['Js', 'Jc', 'Ah', 'Kc', 'Qd'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条J + A踢脚',
      rarity: 'RARE'
    },
    {
      name: '四条7(公共牌三张)',
      holeCards: ['7h', 'Kd'],
      board: ['7s', '7c', '7d', 'Ac', 'Qd'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '手牌一张配合公共牌三张',
      rarity: 'RARE'
    }
  ],

  // ==================== 葫芦 (Full House) ====================
  full_house: [
    {
      name: 'A葫芦K',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Kh', 'Kc', '2c', '3d'],
      expectedType: 'FULL_HOUSE',
      description: '三条A + 对子K',
      rarity: 'RARE'
    },
    {
      name: 'K葫芦Q',
      holeCards: ['Kh', 'Kd'],
      board: ['Ks', 'Qh', 'Qc', '2c', '3d'],
      expectedType: 'FULL_HOUSE',
      description: '三条K + 对子Q',
      rarity: 'RARE'
    },
    {
      name: '2葫芦3(最小葫芦)',
      holeCards: ['2h', '2d'],
      board: ['2s', '3h', '3c', 'Ac', 'Kd'],
      expectedType: 'FULL_HOUSE',
      description: '三条2 + 对子3',
      rarity: 'RARE'
    },
    {
      name: 'J葫芦T',
      holeCards: ['Jh', 'Jd'],
      board: ['Js', 'Th', 'Tc', 'Ac', 'Kd'],
      expectedType: 'FULL_HOUSE',
      description: '三条J + 对子T',
      rarity: 'RARE'
    },
    {
      name: '公共牌葫芦(手牌参与)',
      holeCards: ['Ah', 'Kd'],
      board: ['As', 'Ad', 'Ks', 'Kc', 'Qd'],
      expectedType: 'FULL_HOUSE',
      description: '公共牌两对+手牌各一张凑成葫芦',
      rarity: 'RARE'
    }
  ],

  // ==================== 同花 (Flush) ====================
  flush: [
    {
      name: '红桃A高同花',
      holeCards: ['Ah', '2h'],
      board: ['5h', '7h', '9h', 'Kc', 'Qd'],
      expectedType: 'FLUSH',
      description: 'A-9-7-5-2 红桃同花',
      rarity: 'COMMON'
    },
    {
      name: '黑桃K高同花',
      holeCards: ['Ks', '2s'],
      board: ['4s', '6s', '8s', 'Ah', 'Qd'],
      expectedType: 'FLUSH',
      description: 'K-8-6-4-2 黑桃同花',
      rarity: 'COMMON'
    },
    {
      name: '梅花Q高同花',
      holeCards: ['Qc', '3c'],
      board: ['5c', '7c', 'Tc', 'Kh', 'Ad'],
      expectedType: 'FLUSH',
      description: 'Q-T-7-5-3 梅花同花',
      rarity: 'COMMON'
    },
    {
      name: '方块J高同花',
      holeCards: ['Jd', '4d'],
      board: ['6d', '8d', 'Td', 'Ah', 'Ks'],
      expectedType: 'FLUSH',
      description: 'J-T-8-6-4 方块同花',
      rarity: 'COMMON'
    },
    {
      name: '红桃最小同花',
      holeCards: ['2h', '3h'],
      board: ['4h', '5h', '7h', 'Ac', 'Ks'],
      expectedType: 'FLUSH',
      description: '7-5-4-3-2 红桃同花',
      rarity: 'COMMON'
    }
  ],

  // ==================== 顺子 (Straight) ====================
  straight: [
    {
      name: 'A高顺子(Broadway)',
      holeCards: ['Ah', 'Kh'],
      board: ['Qc', 'Jd', 'Ts', '2c', '3d'],
      expectedType: 'STRAIGHT',
      description: 'A-K-Q-J-T 最大顺子',
      rarity: 'COMMON'
    },
    {
      name: '车轮顺子(A-2-3-4-5)',
      holeCards: ['Ah', '2h'],
      board: ['3c', '4d', '5s', 'Kc', 'Qd'],
      expectedType: 'STRAIGHT',
      description: 'A-2-3-4-5 最小顺子',
      rarity: 'COMMON'
    },
    {
      name: '9高顺子',
      holeCards: ['5h', '6h'],
      board: ['7c', '8d', '9s', 'Kc', 'Ad'],
      expectedType: 'STRAIGHT',
      description: '5-6-7-8-9 顺子',
      rarity: 'COMMON'
    },
    {
      name: 'K高顺子',
      holeCards: ['9h', 'Th'],
      board: ['Jc', 'Qd', 'Ks', '2c', '3d'],
      expectedType: 'STRAIGHT',
      description: '9-T-J-Q-K 顺子',
      rarity: 'COMMON'
    },
    {
      name: '6高顺子',
      holeCards: ['2h', '3h'],
      board: ['4c', '5d', '6s', 'Ac', 'Kd'],
      expectedType: 'STRAIGHT',
      description: '2-3-4-5-6 顺子',
      rarity: 'COMMON'
    }
  ],

  // ==================== 非成就牌型(用于负向测试) ====================
  non_achievement: [
    {
      name: '三条(非成就)',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Kc', 'Qd', '2c', '3d'],
      expectedType: null,
      description: '三条A，不属于成就牌型'
    },
    {
      name: '两对(非成就)',
      holeCards: ['Ah', 'Ad'],
      board: ['Kc', 'Kd', 'Qs', '2c', '3d'],
      expectedType: null,
      description: '两对A-K，不属于成就牌型'
    },
    {
      name: '一对(非成就)',
      holeCards: ['Ah', 'Ad'],
      board: ['Kc', 'Qd', 'Js', '2c', '3d'],
      expectedType: null,
      description: '一对A，不属于成就牌型'
    },
    {
      name: '高牌(非成就)',
      holeCards: ['Ah', 'Kd'],
      board: ['Qc', 'Js', '9d', '2c', '3d'],
      expectedType: null,
      description: '高牌A-K，不属于成就牌型'
    },
    {
      name: '两对(较大)',
      holeCards: ['Ah', 'Ad'],
      board: ['Kc', 'Kd', 'Qs', 'Qc', '3d'],
      expectedType: null,
      description: '两对A-K-Q，不属于成就牌型'
    }
  ],

  // ==================== 边界测试用例 ====================
  edge_cases: [
    {
      name: '同花顺误判为同花',
      holeCards: ['5h', '6h'],
      board: ['7h', '8h', '9h', '2c', '3d'],
      expectedType: 'STRAIGHT_FLUSH', // 不是FLUSH
      description: '应识别为同花顺而非同花',
      rarity: 'EPIC'
    },
    {
      name: '葫芦误判为三条',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Kh', 'Kc', '2c', '3d'],
      expectedType: 'FULL_HOUSE', // 不是THREE_OF_A_KIND
      description: '应识别为葫芦而非三条',
      rarity: 'RARE'
    },
    {
      name: '公共牌皇家同花顺',
      holeCards: ['2c', '3d'],
      board: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'],
      expectedType: 'ROYAL_FLUSH',
      description: '公共牌皇家同花顺，玩家参与',
      rarity: 'LEGENDARY'
    }
  ]
};

/**
 * 获取所有测试用例（扁平化）
 */
function getAllTestCases() {
  const all = [];
  
  for (const [category, cases] of Object.entries(PokerHandTestData)) {
    cases.forEach(testCase => {
      all.push({
        ...testCase,
        category
      });
    });
  }
  
  return all;
}

/**
 * 获取成就牌型测试用例
 */
function getAchievementTestCases() {
  const achievementTypes = ['royal_flush', 'straight_flush', 'four_of_a_kind', 'full_house', 'flush', 'straight'];
  
  const all = [];
  achievementTypes.forEach(type => {
    PokerHandTestData[type].forEach(testCase => {
      all.push({
        ...testCase,
        category: type
      });
    });
  });
  
  return all;
}

/**
 * 获取负向测试用例
 */
function getNegativeTestCases() {
  return PokerHandTestData.non_achievement.map(tc => ({
    ...tc,
    category: 'non_achievement'
  }));
}

module.exports = {
  AchievementTypes,
  PokerHandTestData,
  parseCard,
  getAllTestCases,
  getAchievementTestCases,
  getNegativeTestCases
};
