const { override } = require('customize-cra');

module.exports = override(
    (config) => {
        // Fix: ethers v6 uses ES2022 private class fields (#field)
        // react-scripts 3.x babel-loader cannot parse them.
        // Solution: exclude ethers* packages from babel-loader so webpack handles them natively.
        const oneOfRule = config.module.rules.find(rule => rule.oneOf);
        if (oneOfRule) {
            const babelRule = oneOfRule.oneOf.find(
                rule => rule.loader && rule.loader.includes('babel-loader') && rule.test && rule.test.toString().includes('js')
            );
            if (babelRule) {
                // Exclude ethers v6 from babel transpilation
                if (!babelRule.exclude) {
                    babelRule.exclude = /node_modules\/(?!ethers6|ethers)/;
                } else if (typeof babelRule.exclude === 'string' || babelRule.exclude instanceof RegExp) {
                    const origExclude = babelRule.exclude;
                    babelRule.exclude = (filepath) => {
                        // Always exclude ethers* from babel processing
                        if (/node_modules[\\/]ethers/.test(filepath)) return true;
                        if (typeof origExclude === 'function') return origExclude(filepath);
                        if (origExclude instanceof RegExp) return origExclude.test(filepath);
                        return false;
                    };
                }
                console.log('[config-overrides] Excluded ethers v6 from babel-loader');
            }
        }

        if (config.optimization) {
            config.optimization.runtimeChunk = 'single';
            config.optimization.splitChunks = {
                chunks: 'all',
                minSize: 30000,
                maxInitialRequests: 10,
                maxAsyncRequests: 20,
                cacheGroups: {
                    reactVendor: {
                        test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|prop-types)[\\/]/,
                        name: 'vendor-react',
                        chunks: 'all',
                        priority: 40,
                        enforce: true
                    },
                    ethersVendor: {
                        test: /[\\/]node_modules[\\/](ethers|ethers6|@ethersproject)[\\/]/,
                        name: 'vendor-ethers',
                        chunks: 'all',
                        priority: 35,
                        enforce: true
                    },
                    socketVendor: {
                        test: /[\\/]node_modules[\\/](socket.io-client|socket.io-parser|engine.io-client|engine.io-parser)[\\/]/,
                        name: 'vendor-socket',
                        chunks: 'all',
                        priority: 34,
                        enforce: true
                    },
                    uiVendor: {
                        test: /[\\/]node_modules[\\/](bootstrap|react-bootstrap|styled-components|sweetalert2|lodash|axios)[\\/]/,
                        name: 'vendor-ui',
                        chunks: 'all',
                        priority: 30,
                        enforce: true
                    },
                    tronVendor: {
                        test: /[\\/]node_modules[\\/](tronweb|ethereumjs-util|bn.js|elliptic|js-sha3|crypto-js)[\\/]/,
                        name: 'vendor-chain',
                        chunks: 'all',
                        priority: 25,
                        enforce: true
                    },
                    miscVendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendor-misc',
                        chunks: 'all',
                        priority: 10,
                        enforce: false
                    }
                }
            };
        }

        console.log('[config-overrides] Webpack config patched for ethers v6 compatibility');
        return config;
    }
);
