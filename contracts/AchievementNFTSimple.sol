// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AchievementNFTSimple
 * @dev Simplified NFT Achievement system for Texas Hold'em Poker
 * Minimal implementation for TRON compatibility
 */
contract AchievementNFTSimple {
    
    // ============ Events ============
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event AchievementMinted(address indexed player, uint256 indexed tokenId, uint256 achievementTypeId);
    
    // ============ State Variables ============
    
    string public name = "Poker Achievement NFT";
    string public symbol = "PANFT";
    
    uint256 private _tokenIdCounter;
    address public owner;
    address public signer;
    string public baseURI;
    
    uint256 public signatureValidity = 7 days;
    
    // Token ownership
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Achievement type ID => Achievement info
    mapping(uint256 => string) public achievementNames;
    mapping(uint256 => uint256) public achievementMonthlyLimits;
    mapping(uint256 => uint256) public achievementMintPrices;
    
    // YearMonth (YYYYMM) => AchievementType => Minted count
    mapping(uint256 => mapping(uint256 => uint256)) public monthlyMinted;
    
    // Claim record hash => used
    mapping(bytes32 => bool) public claimRecord;
    
    // Token ID => Achievement type
    mapping(uint256 => uint256) public tokenAchievementType;
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _signer, string memory _baseURI) {
        require(_signer != address(0), "Invalid signer");
        owner = msg.sender;
        signer = _signer;
        baseURI = _baseURI;
        
        // Initialize achievements
        achievementNames[1] = "Royal Flush";
        achievementMonthlyLimits[1] = 10;
        achievementMintPrices[1] = 5 * 1e6;
        
        achievementNames[2] = "Straight Flush";
        achievementMonthlyLimits[2] = 20;
        achievementMintPrices[2] = 5 * 1e6;
        
        achievementNames[3] = "Four of a Kind";
        achievementMonthlyLimits[3] = 50;
        achievementMintPrices[3] = 5 * 1e6;
        
        achievementNames[4] = "Full House";
        achievementMonthlyLimits[4] = 100;
        achievementMintPrices[4] = 5 * 1e6;
        
        achievementNames[5] = "Flush";
        achievementMonthlyLimits[5] = 200;
        achievementMintPrices[5] = 5 * 1e6;
        
        achievementNames[6] = "Straight";
        achievementMonthlyLimits[6] = 300;
        achievementMintPrices[6] = 5 * 1e6;
    }
    
    // ============ ERC721 Functions ============
    
    function balanceOf(address account) public view returns (uint256) {
        require(account != address(0), "Zero address");
        return _balances[account];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Invalid token");
        return tokenOwner;
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved");
        _transfer(from, to, tokenId);
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved");
        _transfer(from, to, tokenId);
    }
    
    function approve(address to, uint256 tokenId) public {
        address tokenOwner = ownerOf(tokenId);
        require(to != tokenOwner, "Self-approval");
        require(msg.sender == tokenOwner || _operatorApprovals[tokenOwner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        require(_exists(tokenId), "Invalid token");
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }
    
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f; // ERC721, ERC721Metadata
    }
    
    // ============ NFT Claim Functions ============
    
    function claimNFT(
        uint256 achievementTypeId,
        uint256 timestamp,
        string calldata gameId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable returns (uint256) {
        _validateClaim(achievementTypeId, timestamp, gameId, v, r, s);
        
        // Mint NFT
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        
        _mint(msg.sender, tokenId);
        tokenAchievementType[tokenId] = achievementTypeId;
        
        uint256 yearMonth = _getYearMonth();
        monthlyMinted[yearMonth][achievementTypeId]++;
        
        // Refund excess
        uint256 price = achievementMintPrices[achievementTypeId];
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit AchievementMinted(msg.sender, tokenId, achievementTypeId);
        
        return tokenId;
    }
    
    function _validateClaim(
        uint256 achievementTypeId,
        uint256 timestamp,
        string calldata gameId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        require(achievementTypeId >= 1 && achievementTypeId <= 6, "Invalid type");
        require(msg.value >= achievementMintPrices[achievementTypeId], "Insufficient payment");
        require(block.timestamp <= timestamp + signatureValidity, "Signature expired");
        require(block.timestamp >= timestamp - signatureValidity, "Signature not valid yet");
        
        // Check monthly limit
        uint256 yearMonth = _getYearMonth();
        require(
            monthlyMinted[yearMonth][achievementTypeId] < achievementMonthlyLimits[achievementTypeId],
            "Monthly limit reached"
        );
        
        // Verify signature
        bytes32 hash = keccak256(abi.encodePacked(
            msg.sender,
            achievementTypeId,
            timestamp,
            gameId
        ));
        
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        address recoveredSigner = ecrecover(ethSignedHash, v, r, s);
        
        require(recoveredSigner == signer, "Invalid signature");
        
        // Check for replay
        bytes32 claimHash = keccak256(abi.encodePacked(msg.sender, gameId, achievementTypeId));
        require(!claimRecord[claimHash], "Already claimed");
        claimRecord[claimHash] = true;
    }
    
    // ============ View Functions ============
    
    function getMonthlyRemaining(uint256 achievementTypeId) external view returns (uint256) {
        uint256 yearMonth = _getYearMonth();
        uint256 minted = monthlyMinted[yearMonth][achievementTypeId];
        uint256 limit = achievementMonthlyLimits[achievementTypeId];
        
        return minted >= limit ? 0 : limit - minted;
    }
    
    function getAchievementInfo(uint256 achievementTypeId) external view returns (
        string memory name,
        uint256 monthlyLimit,
        uint256 mintPrice
    ) {
        return (
            achievementNames[achievementTypeId],
            achievementMonthlyLimits[achievementTypeId],
            achievementMintPrices[achievementTypeId]
        );
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Invalid token");
        uint256 achievementType = tokenAchievementType[tokenId];
        return string(abi.encodePacked(baseURI, _uint2str(achievementType), "/", _uint2str(tokenId)));
    }
    
    // ============ Admin Functions ============
    
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
    }
    
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }
    
    function updateAchievement(
        uint256 achievementTypeId,
        uint256 monthlyLimit,
        uint256 mintPrice
    ) external onlyOwner {
        require(achievementTypeId >= 1 && achievementTypeId <= 6, "Invalid type");
        achievementMonthlyLimits[achievementTypeId] = monthlyLimit;
        achievementMintPrices[achievementTypeId] = mintPrice;
    }
    
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    // ============ Internal Functions ============
    
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || 
               _tokenApprovals[tokenId] == spender || 
               _operatorApprovals[tokenOwner][spender];
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Wrong owner");
        require(to != address(0), "Zero address");
        
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        
        emit Transfer(from, to, tokenId);
    }
    
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Zero address");
        require(!_exists(tokenId), "Token exists");
        
        _balances[to] += 1;
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function _getYearMonth() internal view returns (uint256) {
        uint256 timestamp = block.timestamp;
        uint256 year = 1970 + (timestamp / 31536000);
        uint256 month = ((timestamp % 31536000) / 2592000) + 1;
        return year * 100 + (month > 12 ? 12 : month);
    }
    
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
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
    
    receive() external payable {}
}
