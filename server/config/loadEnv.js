const dotenv = require("dotenv");
const path = require("path");

function loadEnv() {
    const rootDir = path.resolve(__dirname, "../..");
    const envFile = process.env.ENV_FILE || '.env';
    dotenv.config({ path: path.join(rootDir, envFile) });
}

module.exports = loadEnv;