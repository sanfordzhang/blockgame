const { override, addBabelPlugins, useBabelRc } = require('customize-cra');

module.exports = override(
    // Allow babel to process node_modules for specific packages
    (config) => {
        // Find the oneOf rule that contains babel-loader
        const oneOfRule = config.module.rules.find(rule => 
            rule.oneOf && Array.isArray(rule.oneOf)
        );
        
        if (oneOfRule) {
            // Find the babel-loader rule
            const babelRule = oneOfRule.oneOf.find(rule => 
                rule.loader && rule.loader.includes('babel-loader')
            );
            
            if (babelRule) {
                // Exclude nothing - let babel process everything including node_modules for specific packages
                // Or we can create a new rule specifically for ethers
                const originalExclude = babelRule.exclude;
                
                // Process ethers package with babel
                babelRule.exclude = (modulePath) => {
                    // If it's in node_modules/ethers, don't exclude (allow babel to process)
                    if (modulePath.includes('node_modules/ethers')) {
                        return false;
                    }
                    // Otherwise use original exclude logic
                    if (typeof originalExclude === 'function') {
                        return originalExclude(modulePath);
                    }
                    return /node_modules/.test(modulePath);
                };
            }
        }
        
        return config;
    }
);
