// Search for .values() method calls (not Object.values) in src/
const fs = require('fs');
const path = require('path');
const dir = '/Users/yingfengzhang/1JackSource/blockchain/game-core/src';

function searchDir(d) {
    fs.readdirSync(d).forEach(f => {
        const p = path.join(d, f);
        try {
            const s = fs.statSync(p);
            if (s.isDirectory() && f !== 'node_modules' && f !== '.git') searchDir(p);
            else if (/\.(js|jsx|ts|tsx)$/.test(f)) {
                const c = fs.readFileSync(p, 'utf8');
                let idx = -1;
                while ((idx = c.indexOf('.values(', idx + 1)) >= 0) {
                    const before = c.substring(Math.max(0, idx - 12), idx);
                    // Skip Object.values( and things like ).values(
                    if (!/\bObject\s*$/.test(before) && !/\)$/.test(before.trim())) {
                        const lineNum = c.substring(0, idx).split('\n').length;
                        console.log(p + ':' + lineNum + ': ...' + c.substring(Math.max(0, idx - 80), idx + 60));
                    }
                }
            }
        } catch(e) {}
    });
}
searchDir(dir);
