// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AMMPool.sol";

/**
 * @title AMMRouter
 * @dev AMM路由合约，作为用户交互入口
 * 提供便捷的添加流动性、移除流动性、交换等接口
 */
contract AMMRouter {
    // ============ 状态变量 ============
    
    address public factory;
    address public pool;
    address public token;  // CHIP token address
    
    // 管理员
    address public owner;
    
    // ============ 事件 ============
    
    event LiquidityAdded(
        address indexed sender,
        uint256 amountTRX,
        uint256 amountCHIP,
        uint256 liquidity
    );
    
    event LiquidityRemoved(
        address indexed sender,
        uint256 amountTRX,
        uint256 amountCHIP,
        uint256 liquidity
    );
    
    event SwapExecuted(
        address indexed sender,
        bool trxToChip,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // ============ 修饰器 ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "AMMRouter: not owner");
        _;
    }
    
    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "AMMRouter: expired deadline");
        _;
    }
    
    // ============ 构造函数 ============
    
    constructor(address _pool, address _token) {
        owner = msg.sender;
        pool = _pool;
        token = _token;
    }
    
    // ============ 添加流动性 ============
    
    /**
     * @dev 添加TRX/CHIP流动性
     * @param amountCHIPDesired 期望存入的CHIP数量
     * @param amountCHIPMin 最小CHIP数量（滑点保护）
     * @param amountTRXMin 最小TRX数量（滑点保护）
     * @param to 接收LP代币的地址
     * @param deadline 交易截止时间
     * @return amountTRX 实际存入的TRX数量
     * @return amountCHIP 实际存入的CHIP数量
     * @return liquidity 铸造的LP代币数量
     */
    function addLiquidity(
        uint256 amountCHIPDesired,
        uint256 amountCHIPMin,
        uint256 amountTRXMin,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (
        uint256 amountTRX,
        uint256 amountCHIP,
        uint256 liquidity
    ) {
        require(msg.value > 0, "AMMRouter: insufficient TRX amount");
        require(amountCHIPDesired > 0, "AMMRouter: insufficient CHIP amount");
        
        (uint256 reserveTRX, uint256 reserveCHIP, ) = IAMMPool(pool).getReserves();
        
        if (reserveTRX == 0 && reserveCHIP == 0) {
            // 首次添加流动性，使用用户提供的比例
            amountTRX = msg.value;
            amountCHIP = amountCHIPDesired;
        } else {
            // 计算最优存入比例
            uint256 optimalCHIPAmount = (msg.value * reserveCHIP) / reserveTRX;
            
            if (optimalCHIPAmount <= amountCHIPDesired) {
                // TRX是限制因素
                require(optimalCHIPAmount >= amountCHIPMin, "AMMRouter: insufficient CHIP amount");
                amountTRX = msg.value;
                amountCHIP = optimalCHIPAmount;
            } else {
                // CHIP是限制因素
                uint256 optimalTRXAmount = (amountCHIPDesired * reserveTRX) / reserveCHIP;
                require(optimalTRXAmount <= msg.value, "AMMRouter: excessive TRX amount");
                require(optimalTRXAmount >= amountTRXMin, "AMMRouter: insufficient TRX amount");
                amountTRX = optimalTRXAmount;
                amountCHIP = amountCHIPDesired;
            }
        }
        
        // 转账CHIP到池子
        ITRC20(token).transferFrom(msg.sender, address(this), amountCHIP);
        ITRC20(token).approve(pool, amountCHIP);
        
        // 转账TRX和CHIP到池子（多余的TRX返还）
        (bool success, ) = payable(pool).call{value: amountTRX}("");
        require(success, "AMMRouter: TRX transfer failed");
        ITRC20(token).transfer(pool, amountCHIP);
        
        // 铸造LP代币
        liquidity = IAMMPool(pool).mint(to);
        
        // 返还多余的TRX
        if (msg.value > amountTRX) {
            (success, ) = payable(msg.sender).call{value: msg.value - amountTRX}("");
            require(success, "AMMRouter: TRX refund failed");
        }
        
        emit LiquidityAdded(msg.sender, amountTRX, amountCHIP, liquidity);
    }
    
    // ============ 移除流动性 ============
    
    /**
     * @dev 移除TRX/CHIP流动性
     * @param liquidity 要燃烧的LP代币数量
     * @param amountTRXMin 最小取回TRX数量（滑点保护）
     * @param amountCHIPMin 最小取回CHIP数量（滑点保护）
     * @param to 接收代币的地址
     * @param deadline 交易截止时间
     * @return amountTRX 取回的TRX数量
     * @return amountCHIP 取回的CHIP数量
     */
    function removeLiquidity(
        uint256 liquidity,
        uint256 amountTRXMin,
        uint256 amountCHIPMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (
        uint256 amountTRX,
        uint256 amountCHIP
    ) {
        require(liquidity > 0, "AMMRouter: insufficient liquidity");
        
        // 转入LP代币
        IAMMPool(pool).transferFrom(msg.sender, pool, liquidity);
        
        // 燃烧LP代币，取回TRX和CHIP
        (amountTRX, amountCHIP) = IAMMPool(pool).burn(to);
        
        require(amountTRX >= amountTRXMin, "AMMRouter: insufficient TRX amount");
        require(amountCHIP >= amountCHIPMin, "AMMRouter: insufficient CHIP amount");
        
        emit LiquidityRemoved(msg.sender, amountTRX, amountCHIP, liquidity);
    }
    
    // ============ 交换功能 ============
    
    /**
     * @dev 使用TRX购买CHIP
     * @param amountOutMin 最小输出CHIP数量（滑点保护）
     * @param to 接收CHIP的地址
     * @param deadline 交易截止时间
     * @return amountOut 实际获得的CHIP数量
     */
    function swapTRXForCHIP(
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256 amountOut) {
        require(msg.value > 0, "AMMRouter: insufficient TRX amount");
        
        // 计算输出数量
        amountOut = IAMMPool(pool).getAmountOutTRXToCHIP(msg.value);
        require(amountOut >= amountOutMin, "AMMRouter: insufficient output amount");
        
        // 转账TRX到池子并执行交换
        (bool success, ) = payable(pool).call{value: msg.value}("");
        require(success, "AMMRouter: TRX transfer failed");
        IAMMPool(pool).swap(0, amountOut, to, "");
        
        emit SwapExecuted(msg.sender, true, msg.value, amountOut);
    }
    
    /**
     * @dev 使用CHIP购买TRX
     * @param amountIn 输入CHIP数量
     * @param amountOutMin 最小输出TRX数量（滑点保护）
     * @param to 接收TRX的地址
     * @param deadline 交易截止时间
     * @return amountOut 实际获得的TRX数量
     */
    function swapCHIPForTRX(
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut) {
        require(amountIn > 0, "AMMRouter: insufficient CHIP amount");
        
        // 计算输出数量
        amountOut = IAMMPool(pool).getAmountOutCHIPToTRX(amountIn);
        require(amountOut >= amountOutMin, "AMMRouter: insufficient output amount");
        
        // 转账CHIP到池子
        ITRC20(token).transferFrom(msg.sender, pool, amountIn);
        
        // 执行交换
        IAMMPool(pool).swap(amountOut, 0, to, "");
        
        emit SwapExecuted(msg.sender, false, amountIn, amountOut);
    }
    
    // ============ 查询函数 ============
    
    /**
     * @dev 预估TRX转CHIP的输出
     * @param amountIn 输入TRX数量
     * @return amountOut 预估输出CHIP数量
     */
    function quoteTRXToCHIP(uint256 amountIn) external view returns (uint256 amountOut) {
        amountOut = IAMMPool(pool).getAmountOutTRXToCHIP(amountIn);
    }
    
    /**
     * @dev 预估CHIP转TRX的输出
     * @param amountIn 输入CHIP数量
     * @return amountOut 预估输出TRX数量
     */
    function quoteCHIPToTRX(uint256 amountIn) external view returns (uint256 amountOut) {
        amountOut = IAMMPool(pool).getAmountOutCHIPToTRX(amountIn);
    }
    
    /**
     * @dev 获取当前储备量和价格
     * @return reserveTRX TRX储备量
     * @return reserveCHIP CHIP储备量
     * @return price 当前价格（1 TRX = ? CHIP）
     */
    function getPoolInfo() external view returns (
        uint256 reserveTRX,
        uint256 reserveCHIP,
        uint256 price
    ) {
        (reserveTRX, reserveCHIP, ) = IAMMPool(pool).getReserves();
        if (reserveTRX > 0) {
            price = IAMMPool(pool).getCurrentPrice();
        }
    }
    
    /**
     * @dev 计算价格影响
     * @param amountIn 输入数量
     * @param isTRXToCHIP 是否是TRX转CHIP
     * @return priceImpact 价格影响百分比（乘以10000）
     */
    function getPriceImpact(
        uint256 amountIn,
        bool isTRXToCHIP
    ) external view returns (uint256 priceImpact) {
        (uint256 reserveTRX, uint256 reserveCHIP, ) = IAMMPool(pool).getReserves();
        
        if (isTRXToCHIP) {
            require(reserveTRX > 0, "AMMRouter: no liquidity");
            priceImpact = (amountIn * 10000) / (reserveTRX + amountIn);
        } else {
            require(reserveCHIP > 0, "AMMRouter: no liquidity");
            priceImpact = (amountIn * 10000) / (reserveCHIP + amountIn);
        }
    }
    
    // ============ 管理功能 ============
    
    /**
     * @dev 更新池子地址
     */
    function setPool(address _pool) external onlyOwner {
        require(_pool != address(0), "AMMRouter: zero address");
        pool = _pool;
    }
    
    /**
     * @dev 更新代币地址
     */
    function setToken(address _token) external onlyOwner {
        require(_token != address(0), "AMMRouter: zero address");
        token = _token;
    }
    
    /**
     * @dev 转移管理员权限
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AMMRouter: zero address");
        owner = newOwner;
    }
    
    // ============ 接收TRX ============
    
    receive() external payable {}
}

// ============ 接口定义 ============

interface IAMMPool {
    function getReserves() external view returns (uint256 reserveTRX, uint256 reserveCHIP, uint256 blockTimestampLast);
    function mint(address to) external returns (uint256 liquidity);
    function burn(address to) external returns (uint256 amountTRX, uint256 amountCHIP);
    function swap(uint256 amountTRXOut, uint256 amountCHIPOut, address to, bytes calldata data) external;
    function getAmountOutTRXToCHIP(uint256 amountIn) external view returns (uint256 amountOut);
    function getAmountOutCHIPToTRX(uint256 amountIn) external view returns (uint256 amountOut);
    function getCurrentPrice() external view returns (uint256 price);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
