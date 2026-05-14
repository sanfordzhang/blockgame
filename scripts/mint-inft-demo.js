const ethers = require("ethers6");
const fs = require("fs");
require("dotenv").config({ path: ".env.0g" });

const artifactPath = "artifacts/contracts/0g/PokerHandINFT.sol/PokerHandINFT.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.ZEROG_RPC_URL);
const wallet = new ethers.Wallet(process.env.ZEROG_PRIVATE_KEY, provider);

const INFT_ADDRESS = "0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5";
const PLAYER = "0x8808ff950b9bfddde445fd099262e80cee858eb5";
const inft = new ethers.Contract(INFT_ADDRESS, artifact.abi, wallet);

// Hand type definitions (matching TournamentTable.js)
const HAND_TYPES = [
  { name: "Royal Flush", cards: ["A\u2665","K\u2665","Q\u2665","J\u2665","10\u2665"], color: "#FFD700" },
  { name: "Straight Flush", cards: ["9\u2660","8\u2660","7\u2660","6\u2660","5\u2660"], color: "#E040FB" },
  { name: "Four of a Kind", cards: ["A\u2660","A\u2665","A\u2666","A\u2663","K\u2660"], color: "#42A5F5" },
  { name: "Full House", cards: ["K\u2663","K\u2666","K\u2665","Q\u2660","Q\u2665"], color: "#66BB6A" },
  { name: "Flush", cards: ["10\u2666","8\u2666","7\u2666","4\u2666","2\u2666"], color: "#26C6DA" },
  { name: "Straight", cards: ["5\u2660","4\u2665","3\u2666","2\u2663","A\u2660"], color: "#FF7043" },
  { name: "Three of a Kind", cards: ["J\u2660","J\u2665","J\u2666","7\u2663","3\u2660"], color: "#AB47BC" },
  { name: "Two Pair", cards: ["10\u2660","10\u2665","5\u2666","5\u2663","K\u2660"], color: "#FFCA28" },
  { name: "One Pair", cards: ["9\u2665","9\u2666","A\u2660","5\u2663","3\u2666"], color: "#78909C" }
];

function generatePokerHandSVG(ht) {
  const W = 300, H = 400, cw = 40, ch = 56, gap = 6;
  const cards = ht.cards;
  const totalW = cards.length * cw + (cards.length - 1) * gap;
  const startX = (W - totalW) / 2;

  function cardEl(c, x) {
    const sm = { "\u2665": "#D32F2F", "\u2666": "#D32F2F", "\u2660": "#212121", "\u2663": "#212121" };
    const s = c.slice(-1), r = c.slice(0, -1), sc = sm[s] || "#000";
    return `<rect x="${x}" y="95" width="${cw}" height="${ch}" rx="4" fill="#FFF" stroke="#ccc" stroke-width="1"/>` +
      `<text x="${x+5}" y="113" font-size="11" font-weight="bold" fill="${sc}" font-family="Arial">${r}</text>` +
      `<text x="${x+5}" y="124" font-size="10" fill="${sc}" font-family="Arial">${s}</text>` +
      `<text x="${x+cw/2}" y="135" font-size="16" text-anchor="middle" fill="${sc}" font-family="Arial">${s}</text>`;
  }

  let cs = "";
  cards.forEach((c, i) => { cs += cardEl(c, startX + i * (cw + gap)); });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs>` +
      `<linearGradient id="felt" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0d5c2e"/><stop offset="100%" stop-color="#084422"/></linearGradient>` +
      `<filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/></filter>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" rx="16" fill="#111827"/>` +
    `<rect x="12" y="60" width="${W-24}" height="${H-80}" rx="12" fill="url(#felt)" filter="url(#sh)"/>` +
    `<rect x="20" y="68" width="${W-40}" height="${H-96}" rx="8" fill="none" stroke="${ht.color}44" stroke-dasharray="4 3"/>` +
    cs +
    `<text x="${W/2}" y="78" text-anchor="middle" font-size="11" fill="${ht.color}" font-weight="bold" letter-spacing="2" font-family="Arial">POKER HAND</text>` +
    `<text x="${W/2}" y="180" text-anchor="middle" font-size="22" fill="#fff" font-weight="bold" font-family="Arial">${ht.name}</text>` +
    `<rect x="50" y="196" width="200" height="2" fill="${ht.color}" opacity="0.6" rx="1"/>` +
    `<text x="${W/2}" y="220" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="Arial">0G Poker Tournament</text>` +
    `<text x="${W/2}" y="238" text-anchor="middle" font-size="10" fill="#6b7280" font-family="Arial">ERC-7857 Interactive NFT</text>` +
    `</svg>`;
}

async function main() {
  // Mint Royal Flush as example
  const handType = HAND_TYPES[0]; // Royal Flush
  console.log("Minting:", handType.name, "...");

  const svgImage = generatePokerHandSVG(handType);
  const svgB64 = Buffer.from(unescape(encodeURIComponent(svgImage))).toString("base64");
  const metaObj = {
    name: handType.name + " INFT",
    description: "Achievement NFT for " + handType.name + " in 0G Poker Tournament",
    image: "data:image/svg+xml;base64," + svgB64,
    attributes: [
      { trait_type: "Hand Type", value: handType.name },
      { trait_type: "Standard", value: "ERC-7857" },
      { trait_type: "Game", value: "0G Poker" }
    ]
  };
  const metaB64 = Buffer.from(unescape(encodeURIComponent(JSON.stringify(metaObj)))).toString("base64");
  const metaURI = "data:application/json;base64," + metaB64;

  const tx = await inft.mint(PLAYER, handType.name, "0x0000000000000000000000000000000000000000000000000000000000000000", metaURI);
  const receipt = await tx.wait();
  const logEvt = receipt.logs?.find(l => { try { return inft.interface.parseLog(l).name === "PokerHandMinted"; } catch(e) { return false; } });
  const parsed = logEvt ? inft.interface.parseLog(logEvt) : null;
  
  console.log("MINTED! TX:", receipt.hash);
  console.log("  Token ID:", parsed?.args?.tokenId?.toString());
  console.log("  Hand:", handType.name);
}

main().catch(e => { console.error(e.message); process.exit(1); });
