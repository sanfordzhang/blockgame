// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title ChipToken
 * @dev CHIP platform token for the poker game ecosystem
 * ERC20 standard with minting controls and VIP benefits
 */
contract ChipToken is ERC20, ERC20Burnable, Ownable, Pausable {
    
    // ============ Constants ============
    
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e6; // 1 billion with 6 decimals
    uint8 private constant DECIMALS = 6;
    
    // ============ State Variables ============
    
    // Minter whitelist
    mapping(address => bool) public isMinter;
    address[] public minters;
    
    // VIP thresholds
    uint256 public vipThreshold = 10_000 * 1e6; // 10,000 CHIP for VIP status
    uint256 public superVipThreshold = 100_000 * 1e6; // 100,000 CHIP for Super VIP
    
    // VIP discount rates (in basis points)
    uint256 public vipDiscount = 500;    // 5% discount for VIP
    uint256 public superVipDiscount = 1000; // 10% discount for Super VIP
    
    // Total minted
    uint256 public totalMinted;
    
    // ============ Events ============
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Minted(address indexed to, uint256 amount, address indexed minter);
    event Burned(address indexed from, uint256 amount);
    event VipThresholdUpdated(uint256 newThreshold);
    event VipDiscountUpdated(uint256 vipDiscount, uint256 superVipDiscount);
    
    // ============ Modifiers ============
    
    modifier onlyMinter() {
        require(isMinter[msg.sender], "ChipToken: caller is not minter");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(uint256 initialSupply) 
        ERC20("CHIP Token", "CHIP") 
        
    {
        require(initialSupply <= MAX_SUPPLY, "ChipToken: exceeds max supply");
        
        // Mint initial supply to deployer
        _mint(msg.sender, initialSupply);
        totalMinted = initialSupply;
        
        // Deployer is a minter by default
        _addMinter(msg.sender);
    }
    
    // ============ ERC20 Overrides ============
    
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
    
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool) 
    {
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        returns (bool) 
    {
        return super.transferFrom(from, to, amount);
    }
    
    // ============ Minting Functions ============
    
    /**
     * @dev Mint new tokens (only minters)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyMinter whenNotPaused {
        require(to != address(0), "ChipToken: mint to zero address");
        require(totalMinted + amount <= MAX_SUPPLY, "ChipToken: exceeds max supply");
        
        _mint(to, amount);
        totalMinted += amount;
        
        emit Minted(to, amount, msg.sender);
    }
    
    /**
     * @dev Burn tokens from caller
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override whenNotPaused {
        super.burn(amount);
        emit Burned(msg.sender, amount);
    }
    
    /**
     * @dev Burn tokens from another account (with allowance)
     * @param account Account to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address account, uint256 amount) public override whenNotPaused {
        super.burnFrom(account, amount);
        emit Burned(account, amount);
    }
    
    // ============ Minter Management ============
    
    function addMinter(address minter) external onlyOwner {
        _addMinter(minter);
    }
    
    function removeMinter(address minter) external onlyOwner {
        require(isMinter[minter], "ChipToken: not a minter");
        require(minter != owner(), "ChipToken: cannot remove owner");
        
        isMinter[minter] = false;
        
        // Remove from array
        for (uint256 i = 0; i < minters.length; i++) {
            if (minters[i] == minter) {
                minters[i] = minters[minters.length - 1];
                minters.pop();
                break;
            }
        }
        
        emit MinterRemoved(minter);
    }
    
    function _addMinter(address minter) internal {
        require(minter != address(0), "ChipToken: invalid minter");
        require(!isMinter[minter], "ChipToken: already minter");
        
        isMinter[minter] = true;
        minters.push(minter);
        
        emit MinterAdded(minter);
    }
    
    function getMinters() external view returns (address[] memory) {
        return minters;
    }
    
    // ============ VIP Functions ============
    
    /**
     * @dev Check if address is VIP
     * @param account Address to check
     */
    function isVip(address account) external view returns (bool) {
        return balanceOf(account) >= vipThreshold;
    }
    
    /**
     * @dev Check if address is Super VIP
     * @param account Address to check
     */
    function isSuperVip(address account) external view returns (bool) {
        return balanceOf(account) >= superVipThreshold;
    }
    
    /**
     * @dev Get VIP discount for an address
     * @param account Address to check
     * @return Discount in basis points
     */
    function getVipDiscount(address account) external view returns (uint256) {
        uint256 balance = balanceOf(account);
        
        if (balance >= superVipThreshold) {
            return superVipDiscount;
        } else if (balance >= vipThreshold) {
            return vipDiscount;
        }
        
        return 0;
    }
    
    /**
     * @dev Calculate discounted amount for VIP
     * @param account Address to check
     * @param originalAmount Original amount
     * @return Discounted amount
     */
    function applyVipDiscount(address account, uint256 originalAmount) 
        external 
        view 
        returns (uint256) 
    {
        uint256 discount = this.getVipDiscount(account);
        
        if (discount == 0) {
            return originalAmount;
        }
        
        return originalAmount * (10000 - discount) / 10000;
    }
    
    // ============ Admin Functions ============
    
    function setVipThreshold(uint256 _vipThreshold, uint256 _superVipThreshold) 
        external 
        onlyOwner 
    {
        require(_superVipThreshold > _vipThreshold, "ChipToken: invalid thresholds");
        vipThreshold = _vipThreshold;
        superVipThreshold = _superVipThreshold;
        emit VipThresholdUpdated(_vipThreshold);
    }
    
    function setVipDiscount(uint256 _vipDiscount, uint256 _superVipDiscount) 
        external 
        onlyOwner 
    {
        require(_vipDiscount <= 2000, "ChipToken: VIP discount too high"); // Max 20%
        require(_superVipDiscount <= 3000, "ChipToken: Super VIP discount too high"); // Max 30%
        vipDiscount = _vipDiscount;
        superVipDiscount = _superVipDiscount;
        emit VipDiscountUpdated(_vipDiscount, _superVipDiscount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Rescue Functions ============
    
    /**
     * @dev Rescue TRX sent to contract
     */
    function rescueTRX() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "ChipToken: rescue failed");
    }
    
    /**
     * @dev Rescue ERC20 tokens sent to contract
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "ChipToken: cannot rescue own token");
        IERC20(token).transfer(owner(), amount);
    }
    
    // ============ Receive ============
    
    receive() external payable {}
    fallback() external payable {}
}
