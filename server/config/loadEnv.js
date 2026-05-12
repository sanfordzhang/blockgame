const dotenv = require("dotenv");
const path = require("path");

function loadEnv() {
    const rootDir = path.resolve(__dirname, "../..");
    const envFile = process.env.ENV_FILE || '.env';
    const envPath = path.join(rootDir, envFile);
    dotenv.config({ path: envPath });
    console.log(`[loadEnv] Loaded config from: ${envFile} (full path: ${envPath})`);
}

module.exports = loadEnv;