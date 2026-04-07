// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AMMPool
 * @dev AMM流动性池合约，基于恒定乘积公式(x*y=k)
 * 支持TRX/CHIP交易对的自动做市
 */
contract AMMPool {
    // ============ 状态变量 ============
    
    // TRC20代币地址（CHIP）
    address public token;
    
    // 储备量
    uint256 public reserveTRX;     // TRX储备量（wei）
    uint256 public reserveCHIP;    // CHIP储备量（microCHIP）
    
    // LP代币相关
    string public constant name = "AMM LP Token";
    string public constant symbol = "ALP";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    // 用户LP代币余额和授权
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // 管理员和暂停状态
    address public owner;
    bool public paused;
    
    // K值记录（用于防闪电贷攻击）
    uint256 public kLast;
    
    // 价格累积（用于TWAP）
    uint256 public price0CumulativeLast;  // TRX价格累积
    uint256 public price1CumulativeLast;  // CHIP价格累积
    uint32 public blockTimestampLast;
    
    // 最小流动性（防止除零）
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    
    // 手续费率（0.3% = 997/1000）
    uint256 public constant FEE_NUMERATOR = 997;
    uint256 public constant FEE_DENOMINATOR = 1000;
    
    // ============ 事件 ============
    
    event Mint(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint256 reserve0, uint256 reserve1);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event PauseChanged(bool paused);
    
    // ============ 修饰器 ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "AMMPool: not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "AMMPool: paused");
        _;
    }
    
    // 重入锁
    uint256 private _status;
    modifier nonReentrant() {
        require(_status != 2, "AMMPool: reentrant call");
        _status = 2;
        _;
        _status = 1;
    }
    
    // ============ 构造函数 ============
    
    constructor(address _token) {
        owner = msg.sender;
        token = _token;
        paused = false;
        _status = 1;
    }
    
    // ============ TRC20 LP代币接口 ============
    
    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "AMMPool: transfer to zero address");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
    
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }
    
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }
    
    // ============ 核心AMM功能 ============
    
    /**
     * @dev 获取当前储备量
     * @return _reserveTRX TRX储备量
     * @return _reserveCHIP CHIP储备量
     * @return _blockTimestampLast 最后更新区块时间
     */
    function getReserves() external view returns (
        uint256 _reserveTRX,
        uint256 _reserveCHIP,
        uint32 _blockTimestampLast
    ) {
        _reserveTRX = reserveTRX;
        _reserveCHIP = reserveCHIP;
        _blockTimestampLast = blockTimestampLast;
    }
    
    /**
     * @dev 更新储备量和价格累积
     */
    function _update(uint256 balance0, uint256 balance1) internal {
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        
        if (timeElapsed > 0 && reserveTRX > 0 && reserveCHIP > 0) {
            // 累积价格（用于TWAP）
            price0CumulativeLast += uint256((reserveCHIP * 1e18) / reserveTRX) * timeElapsed;
            price1CumulativeLast += uint256((reserveTRX * 1e18) / reserveCHIP) * timeElapsed;
        }
        
        reserveTRX = balance0;
        reserveCHIP = balance1;
        blockTimestampLast = blockTimestamp;
        emit Sync(balance0, balance1);
    }
    
    /**
     * @dev 铸造LP代币
     * @param to 接收LP代币的地址
     * @return liquidity 铸造的LP代币数量
     */
    function mint(address to) external nonReentrant whenNotPaused returns (uint256 liquidity) {
        uint256 _totalSupply = totalSupply;
        uint256 _reserveTRX = reserveTRX;
        uint256 _reserveCHIP = reserveCHIP;
        
        uint256 balance0 = address(this).balance;
        uint256 balance1 = ITRC20(token).balanceOf(address(this));
        
        uint256 amount0 = balance0 - _reserveTRX;
        uint256 amount1 = balance1 - _reserveCHIP;
        
        if (_totalSupply == 0) {
            // 首次添加流动性
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            // 永久锁定最小流动性，防止池子被清空
            balanceOf[address(0)] = MINIMUM_LIQUIDITY;
            totalSupply = MINIMUM_LIQUIDITY;
        } else {
            // 后续添加流动性，按较小比例铸造
            liquidity = min(
                (amount0 * _totalSupply) / _reserveTRX,
                (amount1 * _totalSupply) / _reserveCHIP
            );
        }
        
        require(liquidity > 0, "AMMPool: insufficient liquidity minted");
        
        totalSupply += liquidity;
        balanceOf[to] += liquidity;
        
        _update(balance0, balance1);
        kLast = reserveTRX * reserveCHIP;
        
        emit Mint(msg.sender, amount0, amount1, liquidity);
        emit Transfer(address(0), to, liquidity);
    }
    
    /**
     * @dev 燃烧LP代币，取回流动性
     * @param to 接收代币的地址
     * @return amount0 取回的TRX数量
     * @return amount1 取回的CHIP数量
     */
    function burn(address to) external nonReentrant whenNotPaused returns (
        uint256 amount0,
        uint256 amount1
    ) {
        uint256 liquidity = balanceOf[msg.sender];
        require(liquidity > 0, "AMMPool: insufficient liquidity");
        
        uint256 _totalSupply = totalSupply;
        uint256 _reserveTRX = reserveTRX;
        uint256 _reserveCHIP = reserveCHIP;
        
        // 按比例计算可取回的数量
        amount0 = (liquidity * _reserveTRX) / _totalSupply;
        amount1 = (liquidity * _reserveCHIP) / _totalSupply;
        
        require(amount0 > 0 && amount1 > 0, "AMMPool: insufficient liquidity burned");
        
        totalSupply = _totalSupply - liquidity;
        balanceOf[msg.sender] = balanceOf[msg.sender] - liquidity;
        
        // 转账TRX
        (bool success, ) = payable(to).call{value: amount0}("");
        require(success, "AMMPool: TRX transfer failed");
        
        // 转账CHIP
        ITRC20(token).transfer(to, amount1);
        
        uint256 balance0 = address(this).balance;
        uint256 balance1 = ITRC20(token).balanceOf(address(this));
        
        _update(balance0, balance1);
        kLast = reserveTRX * reserveCHIP;
        
        emit Burn(msg.sender, amount0, amount1, liquidity);
        emit Transfer(msg.sender, address(0), liquidity);
    }
    
    /**
     * @dev 执行交换
     * @param amount0Out 输出TRX数量（卖CHIP时设置）
     * @param amount1Out 输出CHIP数量（买CHIP时设置）
     * @param to 接收输出代币的地址
     * @param data 回调数据（可选）
     */
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external nonReentrant whenNotPaused {
        require(amount0Out > 0 || amount1Out > 0, "AMMPool: insufficient output amount");
        require(amount0Out < reserveTRX && amount1Out < reserveCHIP, "AMMPool: insufficient liquidity");
        
        uint256 balance0;
        uint256 balance1;
        
        // 转账输出代币
        if (amount0Out > 0) {
            (bool success, ) = payable(to).call{value: amount0Out}("");
            require(success, "AMMPool: TRX transfer failed");
        }
        if (amount1Out > 0) {
            ITRC20(token).transfer(to, amount1Out);
        }
        
        // 回调（用于闪电贷，可选）
        if (data.length > 0) {
            IAMMCallee(to).ammCall(msg.sender, amount0Out, amount1Out, data);
        }
        
        balance0 = address(this).balance;
        balance1 = ITRC20(token).balanceOf(address(this));
        
        uint256 amount0In = balance0 > reserveTRX - amount0Out 
            ? balance0 - (reserveTRX - amount0Out) 
            : 0;
        uint256 amount1In = balance1 > reserveCHIP - amount1Out 
            ? balance1 - (reserveCHIP - amount1Out) 
            : 0;
        
        require(amount0In > 0 || amount1In > 0, "AMMPool: insufficient input amount");
        
        // 验证K值（扣除手续费后K值应不减少）
        uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(
            balance0Adjusted * balance1Adjusted >= reserveTRX * reserveCHIP * 1000**2,
            "AMMPool: K value check failed"
        );
        
        _update(balance0, balance1);
        
        emit Swap(
            msg.sender,
            amount0In,
            amount1In,
            amount0Out,
            amount1Out,
            to
        );
    }
    
    /**
     * @dev 同步储备量（强制更新）
     */
    function sync() external nonReentrant {
        _update(address(this).balance, ITRC20(token).balanceOf(address(this)));
    }
    
    // ============ 查询函数 ============
    
    /**
     * @dev 计算输入TRX可获得多少CHIP
     * @param amountIn 输入TRX数量
     * @return amountOut 输出CHIP数量
     */
    function getAmountOutTRXToCHIP(uint256 amountIn) external view returns (uint256 amountOut) {
        require(amountIn > 0, "AMMPool: insufficient input amount");
        uint256 reserveIn = reserveTRX;
        uint256 reserveOut = reserveCHIP;
        require(reserveIn > 0 && reserveOut > 0, "AMMPool: insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @dev 计算输入CHIP可获得多少TRX
     * @param amountIn 输入CHIP数量
     * @return amountOut 输出TRX数量
     */
    function getAmountOutCHIPToTRX(uint256 amountIn) external view returns (uint256 amountOut) {
        require(amountIn > 0, "AMMPool: insufficient input amount");
        uint256 reserveIn = reserveCHIP;
        uint256 reserveOut = reserveTRX;
        require(reserveIn > 0 && reserveOut > 0, "AMMPool: insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @dev 计算当前价格（CHIP/TRX）
     * @return price 1 TRX = ? CHIP
     */
    function getCurrentPrice() external view returns (uint256 price) {
        require(reserveTRX > 0, "AMMPool: no liquidity");
        price = (reserveCHIP * 1e18) / reserveTRX;
    }
    
    // ============ 管理功能 ============
    
    /**
     * @dev 设置暂停状态
     */
    function setPause(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseChanged(_paused);
    }
    
    /**
     * @dev 转移管理员权限
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AMMPool: zero address");
        owner = newOwner;
    }
    
    // ============ 辅助函数 ============
    
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    // ============ 接收TRX ============
    
    receive() external payable {}
}

// ============ 接口定义 ============

interface ITRC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IAMMCallee {
    function ammCall(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}
