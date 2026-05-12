/**
 * 获取cloudflared隧道URL
 */

const { exec } = require('child_process');
const axios = require('axios');

async function getTunnelURL() {
    console.log('🔍 查找cloudflared隧道URL...\n');

    // 方法1: 检查进程日志
    return new Promise((resolve) => {
        exec('ps aux | grep cloudflared | grep -v grep', async (error, stdout) => {
            if (error || !stdout) {
                console.log('❌ cloudflared未运行');
                console.log('\n启动命令:');
                console.log('  cloudflared tunnel --url http://localhost:7778\n');
                resolve(null);
                return;
            }

            console.log('✅ cloudflared正在运行');
            console.log('\n请查看cloudflared终端输出，找到类似这样的URL:');
            console.log('  https://xxxxx-xxxx-xxxx.trycloudflare.com\n');
            console.log('然后运行:');
            console.log('  node set-nft-baseuri-public.js https://YOUR-URL/api/nft/metadata/\n');

            resolve(null);
        });
    });
}

getTunnelURL();
