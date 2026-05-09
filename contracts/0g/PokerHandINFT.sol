// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IERC7857 - Intelligent NFT Interface
 * @notice Standard interface for AI-enabled NFTs with encrypted metadata
 */
interface IERC7857 {
    /// @notice Transfer NFT with encrypted metadata
    /// @param to Recipient address
    /// @param encryptedMetadata Encrypted metadata payload
    function encryptedTransfer(address to, bytes calldata encryptedMetadata) external;
    
    /// @notice Clone INFT structure to new owner
    /// @param owner Address of the clone's owner
    /// @return tokenId The newly created token ID
    function clone(address owner) external returns (uint256);
    
    /// @notice Bind an AI Agent to this INFT
    /// @param agent Address of the AI agent
    function bindAgent(address agent) external;
    
    /// @notice Unbind the AI Agent from this INFT
    function unbindAgent() external;
}

/**
 * @title PokerHandINFT
 * @notice ERC-7857 compliant Intelligent NFT for poker hand achievements on 0G
 * @dev Stores poker achievement data with references to 0G Storage for images/metadata.
 *      Supports encrypted transfer, cloning, and AI Agent binding.
 */
contract PokerHandINFT is ERC721, AccessControl, IERC7857 {
    // ============ Roles ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============ Resolve supportsInterface conflict between ERC721 + AccessControl ============
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ============ Events ============
    event PokerHandMinted(
        uint256 indexed tokenId, 
        string handType, 
        address indexed to,
        string storageRootHash
    );
    event EncryptedTransferEvent(
        uint256 indexed tokenId, 
        address indexed from, 
        address indexed to
    );
    event Cloned(
        uint256 indexed originalTokenId, 
        uint256 indexed newTokenId, 
        address indexed owner
    );
    event AgentBound(uint256 indexed tokenId, address indexed agentAddress);
    event AgentUnbound(uint256 indexed tokenId);

    // ============ Data Structures ============
    struct PokerHandData {
        string handType;          // e.g., "Royal Flush", "Straight Flush"
        string[] cards;           // e.g., ["Ah", "Kh", "Qh", "Jh", "Th"]
        string storageRootHash;   // 0G Storage root hash for image file
        string metadataURI;       // Full JSON metadata URI
        uint256 timestamp;        // Unix timestamp when minted
        address aiAgent;          // Bound AI Agent address (address(0) if none)
        bool isEncrypted;         // Whether metadata is encrypted
    }

    struct HandTypeInfo {
        string name;
        uint8 rarityLevel;         // 0=Legendary, 1=Epic, 2=Rare, 3=Common
        uint256 monthlyLimit;      // Max mints per month
        bool isClonable;           // Can this type be cloned?
    }

    // ============ State Variables ============
    uint256 private _nextTokenId = 1;
    
    mapping(uint256 => PokerHandData) internal _pokerData;
    mapping(bytes32 => uint256[]) internal _typeToTokens; // keccak256(handType) => tokenIds
    
    // Monthly mint tracking: monthKey (YYYY-MM as number) => typeId => count
    mapping(uint256 => mapping(uint256 => uint256)) public monthlyMintCount;
    
    // Encrypted metadata storage
    mapping(uint256 => bytes) internal _encryptedMetadata;

    // Hand type definitions
    mapping(uint256 => HandTypeInfo) internal _handTypes; // typeId => HandTypeInfo

    // ============ Constants ============
    uint256 public constant TYPE_ROYAL_FLUSH = 0;
    uint256 public constant TYPE_STRAIGHT_FLUSH = 1;
    uint256 public constant TYPE_FOUR_OF_A_KIND = 2;
    uint256 public constant TYPE_FULL_HOUSE = 3;
    uint256 public constant TYPE_FLUSH = 4;
    uint256 public constant TYPE_STRAIGHT = 5;

    // ============ Constructor ============
    constructor() ERC721("0G Poker Hand INFT", "0GPoker") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Initialize hand types with rarity and limits
        _handTypes[TYPE_ROYAL_FLUSH] = HandTypeInfo({
            name: "Royal Flush",
            rarityLevel: 0,           // Legendary
            monthlyLimit: 10,
            isClonable: false         // Legendary cannot be cloned
        });
        _handTypes[TYPE_STRAIGHT_FLUSH] = HandTypeInfo({
            name: "Straight Flush",
            rarityLevel: 1,           // Epic
            monthlyLimit: 50,
            isClonable: true
        });
        _handTypes[TYPE_FOUR_OF_A_KIND] = HandTypeInfo({
            name: "Four of a Kind",
            rarityLevel: 2,           // Rare
            monthlyLimit: 200,
            isClonable: true
        });
        _handTypes[TYPE_FULL_HOUSE] = HandTypeInfo({
            name: "Full House",
            rarityLevel: 3,           // Common
            monthlyLimit: 500,
            isClonable: true
        });
        _handTypes[TYPE_FLUSH] = HandTypeInfo({
            name: "Flush",
            rarityLevel: 3,           // Common
            monthlyLimit: 1000,
            isClonable: true
        });
        _handTypes[TYPE_STRAIGHT] = HandTypeInfo({
            name: "Straight",
            rarityLevel: 3,           // Common
            monthlyLimit: 2000,
            isClonable: true
        });
    }

    // ============ Minting ============

    /**
     * @notice Mint a new Poker Hand INFT
     * @dev Only callable by MINTER_ROLE
     * @param to Recipient address
     * @param handType Name of the poker hand achieved (must match predefined types)
     * @param storageRootHash Root hash from 0G Storage where image is stored
     * @param metadataURI URI to full JSON metadata
     * @return tokenId The newly minted token ID
     */
    function mint(
        address to,
        string calldata handType,
        string calldata storageRootHash,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(handType).length > 0, "Invalid hand type");
        
        uint256 typeId = _getTypeIdByName(handType);
        require(typeId != type(uint256).max, "Unknown hand type");

        // Check monthly limit
        uint256 monthKey = _getCurrentMonth();
        monthlyMintCount[monthKey][typeId]++;
        require(
            monthlyMintCount[monthKey][typeId] <= _handTypes[typeId].monthlyLimit,
            "Monthly limit reached for this hand type"
        );

        // Mint token
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        // Store poker data
        _pokerData[tokenId] = PokerHandData({
            handType: handType,
            cards: new string[](0),
            storageRootHash: storageRootHash,
            metadataURI: metadataURI,
            timestamp: block.timestamp,
            aiAgent: address(0),
            isEncrypted: false
        });

        // Track tokens by type
        _typeToTokens[keccak256(bytes(handType))].push(tokenId);

        // Auto-bind AI Agent for Legendary (Royal Flush)
        if (typeId == TYPE_ROYAL_FLUSH) {
            // Note: actual agent address would be passed or configured separately
            // This is a placeholder for the auto-bind feature
        }

        emit PokerHandMinted(tokenId, handType, to, storageRootHash);
        return tokenId;
    }

    /**
     * @notice Mint with explicit card data
     */
    function mintWithCards(
        address to,
        uint256 typeId,
        string[] calldata cards,
        string calldata storageRootHash,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(typeId <= TYPE_STRAIGHT, "Invalid type ID");
        require(cards.length >= 2 && cards.length <= 7, "Invalid card count");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        string memory typeName = _handTypes[typeId].name;
        
        _pokerData[tokenId] = PokerHandData({
            handType: typeName,
            cards: cards,
            storageRootHash: storageRootHash,
            metadataURI: metadataURI,
            timestamp: block.timestamp,
            aiAgent: address(0),
            isEncrypted: false
        });

        _typeToCards[tokenId] = cards;
        _typeToTokens[keccak256(bytes(typeName))].push(tokenId);

        uint256 monthKey = _getCurrentMonth();
        monthlyMintCount[monthKey][typeId]++;

        emit PokerHandMinted(tokenId, typeName, to, storageRootHash);
        return tokenId;
    }

    // ============ IERC7857 Implementation ============

    /**
     * @notice Transfer NFT with encrypted metadata payload
     * @dev Only token holder can call
     * @param to Recipient address
     * @param encryptedMetadata AES-encrypted metadata bytes
     */
    function encryptedTransfer(address to, bytes calldata encryptedMetadata) external override {
        require(balanceOf(_msgSender()) > 0, "Not token holder"); // Check caller holds any token
        require(to != address(0), "Invalid recipient");

        // Find first token owned by sender (for simplicity; could specify tokenId)
        uint256 tokenId = _tokenOfOwnerByIndex(_msgSender(), 0); // Requires Enumerable
        
        // Store encrypted metadata for the recipient
        _encryptedMetadata[tokenId] = encryptedMetadata;
        _pokerData[tokenId].isEncrypted = true;

        safeTransferFrom(_msgSender(), to, tokenId);
        emit EncryptedTransferEvent(tokenId, _msgSender(), to);
    }

    /**
     * @notice Clone INFT to create a copy for new owner
     * @dev Original holder pays for cloning;Legendary cannot be cloned
     * @param newOwner Owner of the cloned token
     * @return newTokenId The cloned token's ID
     */
    function clone(address newOwner) external override returns (uint256) {
        require(newOwner != address(0), "Invalid owner");
        
        // Find caller's first token
        uint256 originalId = _tokenOfOwnerByIndex(_msgSender(), 0);
        PokerHandData memory original = _pokerData[originalId];
        
        uint256 typeId = _getTypeIdByName(original.handType);
        require(_handTypes[typeId].isClonable, "This type cannot be cloned");

        // Clone fee: small amount to prevent spam (can be customized)
        uint256 newTokenId = _nextTokenId++;
        _safeMint(newOwner, newTokenId);

        _pokerData[newTokenId] = PokerHandData({
            handType: original.handType,
            cards: original.cards,
            storageRootHash: original.storageRootHash,
            metadataURI: original.metadataURI,
            timestamp: block.timestamp,
            aiAgent: address(0),  // Cloned tokens don't inherit agent binding
            isEncrypted: false
        });

        _typeToTokens[keccak256(bytes(original.handType))].push(newTokenId);

        emit Cloned(originalId, newTokenId, newOwner);
        return newTokenId;
    }

    /**
     * @notice Bind an AI Agent to this INFT
     * @param agent Address of the AI agent to bind
     */
    function bindAgent(address agent) external override {
        require(agent != address(0), "Invalid agent address");
        require(balanceOf(_msgSender()) > 0, "Caller must own a token");
        
        uint256 tokenId = _tokenOfOwnerByIndex(_msgSender(), 0);
        require(ownerOf(tokenId) == _msgSender(), "Not token owner");

        _pokerData[tokenId].aiAgent = agent;
        emit AgentBound(tokenId, agent);
    }

    /**
     * @notice Unbind the AI Agent from this INFT
     */
    function unbindAgent() external override {
        require(balanceOf(_msgSender()) > 0, "Caller must own a token");
        
        uint256 tokenId = _tokenOfOwnerByIndex(_msgSender(), 0);
        require(ownerOf(tokenId) == _msgSender(), "Not token owner");
        require(_pokerData[tokenId].aiAgent != address(0), "No agent bound");

        address prevAgent = _pokerData[tokenId].aiAgent;
        _pokerData[tokenId].aiAgent = address(0);
        emit AgentUnbound(tokenId);
    }

    // ============ View Functions ============

    /**
     * @notice Get full poker data for a token
     * @param tokenId Token ID to query
     * @return handType Type of poker hand
     * @return storageRootHash 0G Storage root hash
     * @return metadataURI Metadata URI
     * @return timestamp Minting timestamp
     * @return aiAgent Bound AI Agent address
     * @return isEncrypted Whether metadata is encrypted
     */
    function getPokerData(uint256 tokenId) external view returns (
        string memory handType,
        string memory storageRootHash,
        string memory metadataURI,
        uint256 timestamp,
        address aiAgent,
        bool isEncrypted
    ) {
        require(_exists(tokenId), "Token does not exist");
        PokerHandData memory data = _pokerData[tokenId];
        return (
            data.handType,
            data.storageRootHash,
            data.metadataURI,
            data.timestamp,
            data.aiAgent,
            data.isEncrypted
        );
    }

    /**
     * @notice Get encrypted metadata for a token (only accessible by owner)
     */
    function getEncryptedMetadata(uint256 tokenId) external view returns (bytes memory) {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        return _encryptedMetadata[tokenId];
    }

    /**
     * @notice Get current month count for a hand type
     */
    function getCurrentMonthMintCount(uint256 typeId) external view returns (uint256) {
        return monthlyMintCount[_getCurrentMonth()][typeId];
    }

    /**
     * @notice Get hand type info
     */
    function getHandTypeInfo(uint256 typeId) external view returns (
        string memory name,
        uint8 rarityLevel,
        uint256 monthlyLimit,
        bool isClonable
    ) {
        HandTypeInfo memory info = _handTypes[typeId];
        return (info.name, info.rarityLevel, info.monthlyLimit, info.isClonable);
    }

    // ============ Internal Helpers ============

    function _getTypeIdByName(string memory name) internal view returns (uint256) {
        for (uint256 i = 0; i <= TYPE_STRAIGHT; i++) {
            if (keccak256(bytes(_handTypes[i].name)) == keccak256(bytes(name))) {
                return i;
            }
        }
        return type(uint256).max; // Not found
    }

    function _getCurrentMonth() internal view returns (uint256) {
        (uint256 year, uint256 month, ) = (
            block.timestamp / 31536000 + 1970,
            (block.timestamp % 31536000) / 259200 + 1,
            0
        );
        return year * 100 + month;
    }

    // Required for clone/encryptedTransfer to find owned tokens
    // In production, consider making this ERC721Enumerable
    function _tokenOfOwnerByIndex(address owner, uint256 index) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i < _nextTokenId; i++) {
            if (ownerOf(i) == owner) {
                if (count == index) return i;
                count++;
            }
        }
        revert("Token not found at index");
    }

    // Card storage for detailed display
    mapping(uint256 => string[]) internal _typeToCards;
    
    function getTokenCards(uint256 tokenId) external view returns (string[] memory) {
        return _typeToCards[tokenId];
    }
}
