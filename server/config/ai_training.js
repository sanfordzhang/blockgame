/**
 * AI Training Configuration
 * Controls data collection, training triggers, and model versioning
 */
module.exports = {
  // AI feature toggle
  enabled: process.env.AI_ENABLED !== 'false',

  // Data collection settings
  dataCollection: {
    enabled: process.env.AI_DATA_COLLECTION === 'true',
    anonymize: true,
    sampleRate: 1.0,
    outputPath: './ai_engine/training_data/'
  },

  // Training trigger conditions
  trainingTrigger: {
    minSamples: 10000,
    retrainInterval: 7 * 24 * 3600000, // 7 days
    performanceThreshold: 0.55
  },

  // Model versioning
  modelVersioning: {
    keepVersions: 5,
    rollbackThreshold: 0.5
  },

  // Default AI settings
  defaults: {
    difficulty: 'medium',
    maxHands: 100,
    decisionTimeoutMs: 5000,
    thinkingDelayMs: { min: 500, max: 2000 }
  }
};
