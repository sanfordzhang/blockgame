const { override } = require('customize-cra');

module.exports = override(
    (config) => {
        console.log('[config-overrides] Webpack config patched for ethers v5 compatibility');
        return config;
    }
);
