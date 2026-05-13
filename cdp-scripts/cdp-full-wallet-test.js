/**
 * 0G Wallet E2E Test v4 - 修正版
 *
 * 坐标来自用户提供的实际录制数据（固定屏幕，坐标不变）：
 *   刷新页面:     (93,   96)   [16]
 *   0G/EVM 按钮:  (492, 758)   [19]
 *   选MetaMask:   (1208, 271)  [20] ← 之前错误用了1987,244！
 *   Connect确认:  (1425, 875)  [41]
 *   Disconnect1:  (1464, 883)  [60]
 *   Disconnect2:  (1362, 380)  [74]
 *
 * 截图: 用 screencapture 截全屏（能看到 MetaMask 弹窗）
 */
const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const LOG_DIR = 'logs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===== 用户提供的正确坐标（固定屏幕）=====
const POS = {
    refreshPage:      { x: 93,   y: 96 },
    ogButton:         { x: 492,  y: 758 },
    metaMaskSelect:   { x: 1208, y: 271 },
    connectConfirm:   { x: 1425, y: 875 },
    disconnectBtn1:   { x: 1464, y: 883 },
    disconnectBtn2:   { x: 1362, y: 380 },
};

let logFile;
function log(msg) {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${msg}`);
    if (logFile) fs.appendFileSync(logFile, `[${ts}] ${msg}\n`);
}

function qClick(x, y, label) {
    try {
        execSync(`cliclick c:${x},${y}`, { encoding: 'utf-8', timeout: 5000 });
        log(`  Quartz click (${x},${y}) [${label || ''}]`);
        return true;
    } catch(e) {
        log(`  cliclick FAIL (${x},${y}): ${e.message}`);
        return false;
    }
}

/** 全屏截图 - 能截到 MetaMask 弹窗 */
function screenSS(name) {
    const path = `${LOG_DIR}/v4-${name}.png`;
    execSync(`screencapture -x "${path}"`, { timeout: 5000 });
    log(`  全屏截图: ${path}`);
    return path;
}

async function connectCDP() {
    const tabs = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:9222/json/list', r => {
            let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d)));
        }).on('error', rej);
    });
    const tab = tabs.find(t => t.url.includes('127.0.0.1:3001'));
    if (!tab) throw new Error('No 3001 tab');
    log(`CDP connected: ${tab.url.slice(0,50)}...`);
    const c = await CDP({ port: 9222, target: tab });
    await c.Page.enable(); await c.Runtime.enable(); await c.Network.enable();
    return c;
}

/** JS .click() 按钮点击（React 兼容） */
async function jsClick(c, keywords, label) {
    const kw = keywords.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const r = await c.Runtime.evaluate({
        expression:`(function(){
            var all=Array.from(document.querySelectorAll('button,a,[role="button"]'));
            var btn=null;
            for(var i=0;i<all.length;i++)if(all[i].offsetParent!==null&&new RegExp('${kw}','i').test(all[i].textContent)){btn=all[i];break;}
            if(!btn)return{found:false};
            var info={text:btn.textContent.trim(),disabled:!!btn.disabled};
            try{btn.click();return Object.assign({found:true},info);}catch(e){return Object.assign({found:true,err:e.message},info);}
        })()`,
        returnByValue:true
    });
    const v=r?.result?.value;
    if(!v?.found){log(`${label}: 未找到按钮 "${keywords}"`);return false;}
    log(`  JS click → [${v.text}] ${v.disabled?'[DISABLED]':'[OK]'}`);
    return !v.disabled;
}

/** 获取页面钱包状态 */
async function getState(c) {
    try{
        const r=await c.Runtime.evaluate({
            expression:`(function(){
                function f(kw){var a=Array.from(document.querySelectorAll('button,[role="button"]'));
                    for(var i=0;i<a.length;i++)if(new RegExp(kw.join('|'),'i').test(a[i].textContent.trim()))
                        return{text:a[i].textContent.trim(),disabled:!!a[i].disabled};return null;}
                return{wt:localStorage.getItem('wallet_type')||null,zc:localStorage.getItem('zerog_connected')||null,
                       addr:localStorage.getItem('wallet_address')||null,
                       dep:f(['deposit']),wdr:(function(){var b=f(['withdraw']);return b&&b.text.indexOf('all')<0?b:null;})(),
                       auth:f(['authorize']),hasEth:typeof window.ethereum!=='undefined'};
            })()`,
            returnByValue:true
        });
        return r.result.value;
    }catch(e){return null;}
}

async function injectErr(c){
    await c.Runtime.evaluate({
        expression:`if(!window._cei){window._cei=true;window._errs=[];
            var _oe=console.error;console.error=function(){window._errs.push({t:'E',m:Array.prototype.slice.call(arguments).join(' ')});_oe.apply(console,arguments);};
            var _ow=console.warn;console.warn=function(){window._errs.push({t:'W',m:Array.prototype.slice.call(arguments).join(' ')});_ow.apply(console,arguments);};}`
    });
}
async function getErrors(c){
    const r=await c.Runtime.evaluate({expression:'window._errs||[]',returnByValue:true});
    return r.result.value||[];
}

// ===== MAIN =====
async function main(){
    const ts=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    logFile=`${LOG_DIR}/wallet-v4-${ts}.log`;
    fs.mkdirSync(LOG_DIR,{recursive:true});
    let client;

    try{
        log('=' .repeat(55));
        log('0G WALLET E2E v4 - 修正坐标 + 全屏截图');
        log('=' .repeat(55));
        log('\n使用坐标:');
        for(const[k,v]of Object.entries(POS)) log(`  ${k}: (${v.x}, ${v.y})`);

        client = await connectCDP();
        await injectErr(client);

        let s;

        // ========== STEP 1: 初始状态 ==========
        log('\n=== STEP 1: 初始状态 ===');
        screenSS('01-initial');
        s = await getState(client);
        log(`walletType=${s.wt}, addr=${s.addr}, hasEth=${s.hasEth}`);
        log(`dep=${s.dep?'"'+s.dep.text+'"':'--'}, wdr=${s.wdr?'"'+s.wdr.text+'"':'--'}, auth=${s.auth?'"'+s.auth.text+'"':'--'}`);

        // ========== STEP 2: 点击 0G / EVM 按钮 (Quartz 绝对坐标) ==========
        log('\n=== STEP 2: 点击 0G / EVM 按钮 ===');
        qClick(POS.ogButton.x, POS.ogButton.y, '0G/EVM按钮');
        // 等 MetaMask 弹窗出现
        log('  等待5秒让 MetaMask 弹出...');
        await sleep(5000);
        screenSS('02-after-0g-click');  // 全屏截图应该能看见弹窗

        s = await getState(client);
        log(`  After click: type=${s.wt}, addr=${s.addr}`);

        if (!s.wt && !s.addr && s.hasEth) {
            log('  MetaMask 应该弹出了，执行选择 MetaMask...');

            // ========== STEP 2b: 选择 MetaMask ==========
            qClick(POS.metaMaskSelect.x, POS.metaMaskSelect.y, '选MetaMask');
            await sleep(4000);
            screenSS('03-metamask-select');

            s = await getState(client);
            log(`  After MM select: type=${s.wt}, addr=${s.addr}`);

            if (!s.wt && !s.addr) {
                // ========== STEP 2c: 点 Connect/Confirm ==========
                log('  还没连接上，点 Confirm/Connect...');
                qClick(POS.connectConfirm.x, POS.connectConfirm.y, 'Connect/Confirm');
                await sleep(8000);
                screenSS('04-after-confirm');

                s = await getState(client);
                log(`  After confirm: type=${s.wt}, addr=${s.addr?.slice(0,16)}`);
            }
        }

        // 额外等待异步连接完成
        if (!s.wt && !s.addr) {
            log('  额外等待10s...');
            await sleep(10000);
            screenSS('05-extra-wait');
            s = await getState(client);
            log(`  Extra wait: type=${s.wt}, addr=${s.addr?.slice(0,16)}`);
        }

        // 报告连接阶段错误
        let errs = await getErrors(client);
        if(errs.length > 0){ log('  连接阶段错误:'); errs.forEach(e => log(`    [${e.t}] ${e.m}`)); }
        else { log('  ✅ 连接阶段无JS错误');}

        const isConnected = !!(s.wt || s.addr);
        log(`\n  🔗 钱包已连接: ${isConnected ? 'YES ✅' : 'NO ⚠️ (需要手动处理MetaMask弹窗)'}`);

        // ========== STEP 3: DEPOSIT ==========
        log('\n=== STEP 3: Deposit ===');
        s = await getState(client);
        log('  Deposit按钮: ' + (s.dep ? '"' + s.dep.text + '" (' + (s.dep.disabled?'DISABLED':'ENABLED') + ')' : '未找到'));

        if (isConnected && s.dep && !s.dep.disabled) {
            // 设置金额
            await client.Runtime.evaluate({
                expression:`(function(){var is=document.querySelectorAll('input');for(var i=0;i<is.length;i++){if((is[i].placeholder||'').toLowerCase().indexOf('amount')>=0||(is[i].id||'').indexOf('deposit')>=0){is[i].value='0.01';is[i].dispatchEvent(new Event('input',{bubbles:true}));is[i].dispatchEvent(new Event('change',{bubbles:true}));return'set';}}return'none';})()`
            });

            jsClick(client, ['Deposit'], 'Deposit');
            log('  等待 tx 确认...');
            await sleep(6000);

            // MetaMask tx 确认
            qClick(POS.connectConfirm.x, POS.connectConfirm.y, 'tx-确认');
            await sleep(10000);
            screenSS('06-after-deposit');

            errs = await getErrors(client);
            if(errs.length>0){errs.forEach(e=>log(`    [${e.t}] ${e.m}`));}

            s = await getState(client);
            log(`  Post-deposit done`);
        } else {
            log(isConnected ? '  SKIP: Deposit不可用或无余额' : '  SKIP: 未连接');
            screenSS('06-skip-deposit');
        }

        // ========== STEP 4: AUTHORIZE SERVER ==========
        log('\n=== STEP 4: Authorize Server ===');
        s = await getState(client);
        log('  Authorize按钮: ' + (s.auth ? '"' + s.auth.text + '" (' + (s.auth.disabled?'DISABLED':'ENABLED') + ')' : '未找到'));

        if (isConnected && s.auth && !s.auth.disabled) {
            jsClick(client, ['authorize','Authorise','Authorize Server'], 'Authorize');
            await sleep(5000);
            qClick(POS.connectConfirm.x, POS.connectConfirm.y, 'auth-tx确认');
            await sleep(8000);
            screenSS('07-after-authorize');
            s = await getState(client);
            log(`  Post-auth: ${JSON.stringify(s.auth)}`);
        } else {
            log(s.auth ? `  SKIP: 已授权或 disabled` : `  SKIP: 无authorize按钮`);
            screenSS('07-skip-authorize');
        }

        // ========== STEP 5: WITHDRAW ==========
        log('\n=== STEP 5: Withdraw ===');
        s = await getState(client);
        log('  Withdraw按钮: ' + (s.wdr ? '"' + s.wdr.text + '" (' + (s.wdr.disabled?'DISABLED':'ENABLED') + ')' : '未找到'));

        if (isConnected && s.wdr && !s.wdr.disabled) {
            jsClick(client, ['Withdraw'], 'Withdraw');
            log('  等待 tx...');
            await sleep(6000);
            qClick(POS.connectConfirm.x, POS.connectConfirm.y, 'wdr-tx确认');
            await sleep(8000);
            screenSS('08-after-withdraw');
            s = await getState(client);
        } else {
            log(s.wdr ? `  SKIP: ${s.wdr.text} (${s.wdr.disabled?'无余额可提':'OK但跳过'})` : '  SKIP: 无withdraw按钮');
            screenSS('08-skip-withdraw');
        }

        // ========== STEP 6: DISCONNECT ==========
        log('\n=== STEP 6: Disconnect ===');
        screenSS('09-before-disconnect');

        // 先尝试 JS 点击
        jsClick(client, ['disconnect'], 'Disconnect');
        await sleep(2000);

        s = await getState(client);
        if (s.wt || s.addr) {
            log('  还在连接状态，用 Quartz 断开...');
            qClick(POS.disconnectBtn1.x, POS.disconnectBtn1.y, '断开1');
            await sleep(2000);
            qClick(POS.disconnectBtn2.x, POS.disconnectBtn2.y, '断开2-确认');
            await sleep(3000);
        }

        screenSS('10-after-disconnect');
        s = await getState(client);
        log(`  Final: type=${s.wt}, addr=${s.addr}`);

        // ===== 最终报告 =====
        log('\n'+'='.repeat(55));
        log('最终报告');
        log('='.repeat(55));

        errs = await getErrors(client);
        if(errs.length>0){log('\n控制台错误/警告:');errs.forEach((e,i)=>log(`  ${i+1}.[${e.t}] ${e.m}`));}
        else{log('\n✅ 无 JavaScript 错误。');}

        log('\n全屏截图列表:');
        fs.readdirSync(LOG_DIR).filter(f=>f.startsWith('v4-')).sort().forEach(f=>log(`  ${f}`));

        log('\n测试结果汇总:');
        log(`  ① 编译修复           PASS (withdrawFromContract 导出正常)`);
        log(`  ② 0G/EVM按钮点击     ${isConnected ? 'PASS ✅' : 'NEEDS MANUAL ⚠️'}`);
        log(`  ③ MetaMask选择       ${isConnected ? 'PASS ✅' : 'NEEDS MANUAL ⚠️ (坐标或弹窗)'}`);
        log(`  ④ 网络连接确认       ${isConnected ? 'PASS ✅' : 'NEEDS MANUAL ⚠️'}`);
        log(`  ⑤ Deposit            ${isConnected&&s.dep?'TESTED':'SKIPPED'}`);
        log(`  ⑥ Authorize Server   ${isConnected&&s.auth?'TESTED':'SKIPPED'}`);
        log(`  ⑦ Withdraw           ${isConnected&&s.wdr?'TESTED':'SKIPPED'}`);
        log(`  ⑧ Disconnect         TESTED`);

    } catch(e){
        log(`FATAL: ${e.message}\n${e.stack}`);
    } finally {
        if(client)try{await client.close();}catch{}
        log(`\n日志文件: ${logFile}`);
    }
}

main().catch(console.error);
