## TronLink NFT显示修复 - 最终步骤

### 问题原因
cloudflared隧道指向错误端口（7778），但服务运行在7777端口

### 解决步骤

**1. 在新终端启动cloudflared:**
```bash
cloudflared tunnel --url http://localhost:7777
```

**2. 等待输出显示新URL（如 `https://xxx.trycloudflare.com`）**

**3. 更新合约baseURI:**
```bash
node set-baseuri-simple.js https://YOUR-NEW-URL/api/nft/metadata/
```

**4. 验证:**
```bash
node fix-and-verify.js
```

**5. TronLink操作:**
- 删除PANFT合约（长按）
- 重新添加: `TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC`
- 查看NFT #10属性，应显示Cards: `10h 9d 8c 7s 6h`
