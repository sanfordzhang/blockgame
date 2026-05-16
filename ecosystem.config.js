const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    });
    return env;
  } catch (e) {
    return {};
  }
}

const mainnetEnv = loadEnvFile('***REMOVED***');
const testnetEnv = loadEnvFile('.env.testnet');

module.exports = {
  apps: [
    {
      name: 'mainnet-server',
      script: 'server/server.js',
      cwd: '/home/ubuntu/game-core',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        ...mainnetEnv,
        ENV_FILE: '***REMOVED***',
        NODE_ENV: 'production',
        SERVER_PORT: 7777,
        MONGODB_URI: 'mongodb://localhost:27017/bridge-poker-mainnet',
        CORS_ORIGINS: 'http://43.163.114.175',
      }
    },
    {
      name: 'testnet-server',
      script: 'server/server.js',
      cwd: '/home/ubuntu/game-core',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        ...testnetEnv,
        ENV_FILE: '.env.testnet',
        NODE_ENV: 'production',
        SERVER_PORT: 7778,
        MONGODB_URI: 'mongodb://localhost:27017/bridge-poker-testnet',
        CORS_ORIGINS: 'http://43.163.114.175:3001',
      }
    }
  ]
};
