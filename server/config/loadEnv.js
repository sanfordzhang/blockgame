const dotenv = require("dotenv");
const path = require("path");

function loadEnv() {
    const rootDir = path.resolve(__dirname, "../..");
    
    //Load .env (base config)
    dotenv.config({ path: path.join(rootDir, ".env") });

    //Load .env.local (local overrides, higher priority)
    dotenv.config({ path: path.join(rootDir, ".env.local") });
}

module.exports = loadEnv;