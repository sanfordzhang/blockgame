// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/TRC721/TRC721.sol";
import "@openzeppelin/contracts/token/TRC721/extensions/TRC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AchievementNFT
 * @dev NFT Achievement system for Texas Hold'em Poker
 * Players earn NFTs by achieving specific hand types
 */
contract AchievementNFT is TRC721, TRC721URIStorage, Ownable, Pausable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;
    
    // ============ Enums ============
    
    enum AchievementType {
        ROYAL_FLUSH,        // 1 - LEGENDARY
        STRAIGHT_FLUSH,     // 2 - EPIC
        FOUR_OF_A_KIND,     // 3 - RARE
        FULL_HOUSE,         // 4 - RARE
        FLUSH,              // 5 - COMMON
        STRAIGHT            // 6 - COMMON
    }
    
    enum Rarity {
        COMMON,
        RARE,
        EPIC,
        LEGENDARY
    }
    
    // ============ Structs ============
    
    struct AchievementInfo {
        AchievementType achievementType;
        Rarity rarity;
        string name;
        string description;
        uint256 monthlyLimit;
        uint256 mintPrice;      // Price in SUN (TRX)
    }
    
    // ============ State Variables ============
    
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    
    address public signer;
    string public baseURI;
    
    uint256 public signatureValidity = 7 days;
    
    // Achievement type ID => Achievement info
    mapping(uint256 => AchievementInfo) public achievements;
    
    // YearMonth (YYYYMM) => AchievementType => Minted count
    mapping(uint256 => mapping(uint256 => uint256)) public monthlyMinted;
    
    // Claim record hash => used
    mapping(bytes32 => bool) public claimRecord;
    
    // Token ID => Achievement type
    mapping(uint256 => uint256) public tokenAchievementType;
    
    // ============ Events ============
    
    event AchievementMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint256 achievementTypeId,
        uint256 yearMonth
    );
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event BaseURIUpdated(string newBaseURI);
    
    // ============ Constructor ============
    
    constructor(address _signer, string memory _baseURI) 
        TRC721("Poker Achievement NFT", "PA NFT") 
        Ownable(msg.sender)
    {
        require(_signer != address(0), "AchievementNFT: invalid signer");
        signer = _signer;
        baseURI = _baseURI;
        
        _initializeAchievements();
    }
    
    // ============ Initialization ============
    
    function _initializeAchievements() internal {
        // 1: Royal Flush - LEGENDARY
        achievements[1] = AchievementInfo({
            achievementType: AchievementType.ROYAL_FLUSH,
            rarity: Rarity.LEGENDARY,
            name: "Royal Flush",
            description: "The ultimate hand: A-K-Q-J-10 of the same suit",
            monthlyLimit: 5,
            mintPrice: 5 * 1e6  // 5 TRX
        });
        
        // 2: Straight Flush - EPIC
        achievements[2] = AchievementInfo({
            achievementType: AchievementType.STRAIGHT_FLUSH,
            rarity: Rarity.EPIC,
            name: "Straight Flush",
            description: "Five consecutive cards of the same suit",
            monthlyLimit: 10,
            mintPrice: 5 * 1e6
        });
        
        // 3: Four of a Kind - RARE
        achievements[3] = AchievementInfo({
            achievementType: AchievementType.FOUR_OF_A_KIND,
            rarity: Rarity.RARE,
            name: "Four of a Kind",
            description: "Four cards of the same rank",
            monthlyLimit: 50,
            mintPrice: 5 * 1e6
        });
        
        // 4: Full House - RARE
        achievements[4] = AchievementInfo({
            achievementType: AchievementType.FULL_HOUSE,
            rarity: Rarity.RARE,
            name: "Full House",
            description: "Three of a kind plus a pair",
            monthlyLimit: 100,
            mintPrice: 5 * 1e6
        });
        
        // 5: Flush - COMMON
        achievements[5] = AchievementInfo({
            achievementType: AchievementType.FLUSH,
            rarity: Rarity.COMMON,
            name: "Flush",
            description: "Five cards of the same suit",
            monthlyLimit: 200,
            mintPrice: 5 * 1e6
        });
        
        // 6: Straight - COMMON
        achievements[6] = AchievementInfo({
            achievementType: AchievementType.STRAIGHT,
            rarity: Rarity.COMMON,
            name: "Straight",
            description: "Five consecutive cards",
            monthlyLimit: 300,
            mintPrice: 5 * 1e6
        });
    }
    
    // ============ Core Functions ============
    
    /**
     * @dev Claim NFT for an achievement
     * @param achievementTypeId The achievement type ID (1-6)
     * @param timestamp Server timestamp for signature validity
     * @param gameId Game session ID for uniqueness
     * @param v ECDSA signature component
     * @param r ECDSA signature component
     * @param s ECDSA signature component
     */
    function claimNFT(
        uint256 achievementTypeId,
        uint256 timestamp,
        string calldata gameId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) 
        external 
        payable 
        whenNotPaused 
        returns (uint256)
    {
        require(achievementTypeId >= 1 && achievementTypeId <= 6, "AchievementNFT: invalid type");
        
        AchievementInfo storage achievement = achievements[achievementTypeId];
        
        // Check mint price
        require(msg.value >= achievement.mintPrice, "AchievementNFT: insufficient payment");
        
        // Check timestamp validity
        require(block.timestamp <= timestamp + signatureValidity, "AchievementNFT: signature expired");
        require(block.timestamp >= timestamp - signatureValidity, "AchievementNFT: signature not yet valid");
        
        // Check monthly limit
        uint256 yearMonth = _getYearMonth();
        require(
            monthlyMinted[yearMonth][achievementTypeId] < achievement.monthlyLimit,
            "AchievementNFT: monthly limit reached"
        );
        
        // Verify signature
        bytes32 hash = keccak256(abi.encodePacked(
            msg.sender,
            achievementTypeId,
            timestamp,
            gameId
        ));
        
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        address recoveredSigner = ecrecover(ethSignedHash, v, r, s);
        
        require(recoveredSigner == signer, "AchievementNFT: invalid signature");
        
        // Check for replay attack
        bytes32 claimHash = keccak256(abi.encodePacked(msg.sender, gameId, achievementTypeId));
        require(!claimRecord[claimHash], "AchievementNFT: already claimed");
        claimRecord[claimHash] = true;
        
        // Mint NFT
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _safeMint(msg.sender, tokenId);
        tokenAchievementType[tokenId] = achievementTypeId;
        
        // Update monthly minted count
        monthlyMinted[yearMonth][achievementTypeId]++;
        
        // Refund excess payment
        if (msg.value > achievement.mintPrice) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - achievement.mintPrice}("");
            require(success, "AchievementNFT: refund failed");
        }
        
        emit AchievementMinted(msg.sender, tokenId, achievementTypeId, yearMonth);
        
        return tokenId;
    }
    
    /**
     * @dev Claim NFT with compact signature (65 bytes)
     */
    function claimNFTCompact(
        uint256 achievementTypeId,
        uint256 timestamp,
        string calldata gameId,
        bytes calldata signature
    ) 
        external 
        payable 
        whenNotPaused 
        returns (uint256)
    {
        require(signature.length == 65, "AchievementNFT: invalid signature length");
        
        uint8 v;
        bytes32 r;
        bytes32 s;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        return claimNFT(achievementTypeId, timestamp, gameId, v, r, s);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get remaining monthly mints for an achievement type
     */
    function getMonthlyRemaining(uint256 achievementTypeId) external view returns (uint256) {
        uint256 yearMonth = _getYearMonth();
        AchievementInfo storage achievement = achievements[achievementTypeId];
        uint256 minted = monthlyMinted[yearMonth][achievementTypeId];
        
        if (minted >= achievement.monthlyLimit) {
            return 0;
        }
        return achievement.monthlyLimit - minted;
    }
    
    /**
     * @dev Get achievement info
     */
    function getAchievementInfo(uint256 achievementTypeId) external view returns (
        AchievementType achievementType,
        Rarity rarity,
        string memory name,
        string memory description,
        uint256 monthlyLimit,
        uint256 mintPrice
    ) {
        AchievementInfo storage info = achievements[achievementTypeId];
        return (
            info.achievementType,
            info.rarity,
            info.name,
            info.description,
            info.monthlyLimit,
            info.mintPrice
        );
    }
    
    /**
     * @dev Get all achievements for a player
     */
    function getPlayerAchievements(address player) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(player);
        uint256[] memory tokens = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokens[i] = tokenOfOwnerByIndex(player, i);
        }
        
        return tokens;
    }
    
    /**
     * @dev Get current year-month in YYYYMM format
     */
    function getCurrentYearMonth() external pure returns (uint256) {
        return _getYearMonth();
    }
    
    // ============ Helper Functions ============
    
    /**
     * @dev Calculate year-month from timestamp
     * Simplified: returns block.timestamp's year and month
     */
    function _getYearMonth() internal view returns (uint256) {
        // Simplified calculation - in production use oracle or block.timestamp properly
        // Returns YYYYMM format
        uint256 timestamp = block.timestamp;
        
        // Days since Unix epoch (Jan 1, 1970)
        uint256 daysSinceEpoch = timestamp / 86400;
        
        // Simplified year calculation (not accounting for leap years accurately)
        // This is a rough approximation
        uint256 year = 1970 + (daysSinceEpoch * 400) / 146097; // Average days per year
        
        // Calculate month (very simplified)
        uint256 dayOfYear = daysSinceEpoch - ((year - 1970) * 365);
        uint256 month = (dayOfYear * 12) / 365 + 1;
        
        if (month > 12) {
            month = 12;
        }
        
        return year * 100 + month;
    }
    
    // ============ Admin Functions ============
    
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "AchievementNFT: invalid signer");
        address oldSigner = signer;
        signer = _signer;
        emit SignerUpdated(oldSigner, _signer);
    }
    
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }
    
    function setSignatureValidity(uint256 _validity) external onlyOwner {
        signatureValidity = _validity;
    }
    
    function updateAchievement(
        uint256 achievementTypeId,
        uint256 monthlyLimit,
        uint256 mintPrice
    ) external onlyOwner {
        require(achievementTypeId >= 1 && achievementTypeId <= 6, "AchievementNFT: invalid type");
        achievements[achievementTypeId].monthlyLimit = monthlyLimit;
        achievements[achievementTypeId].mintPrice = mintPrice;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw collected TRX
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "AchievementNFT: withdrawal failed");
    }
    
    // ============ TRC721 Overrides ============
    
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
    
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(TRC721, TRC721URIStorage) 
        returns (string memory) 
    {
        _requireOwned(tokenId);
        
        uint256 achievementType = tokenAchievementType[tokenId];
        string memory base = _baseURI();
        
        return string(abi.encodePacked(base, _toString(achievementType), "/", _toString(tokenId)));
    }
    
    // Helper to convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Required overrides
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(TRC721, TRC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // ============ Receive ============
    
    receive() external payable {}
    fallback() external payable {}
}
