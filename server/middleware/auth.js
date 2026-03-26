const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT token validation middleware
 */
const validateToken = (req, res, next) => {
  const token = req.header('x-auth-token');
  console.log(token)
  if (!token) return res.status(401).json({ msg: 'Unauthorized request!' });

  try {
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.status(401).json({ msg: 'Unauthorized request!' });
        console.error(err);
      } else {
        req.user = decoded.user;
        next();
      }
    });
  } catch (err) {
    console.error('Internal auth error - error in token validation middleware');
    res.status(500).json({ msg: 'Internal auth error' });
  }
};

/**
 * Wallet address authentication middleware (Task 14.8)
 * Validates wallet address from request body/params/query
 * Can be used for blockchain-based authentication
 */
const authMiddleware = (req, res, next) => {
  // Try to get wallet address from multiple sources
  let walletAddress = req.body.walletAddress || 
                      req.params.walletAddress || 
                      req.query.walletAddress ||
                      req.header('x-wallet-address');
  
  // If JWT token exists, use that for user info
  const token = req.header('x-auth-token');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.user = decoded.user;
      req.walletAddress = decoded.user?.walletAddress || decoded.user?.id || walletAddress;
      return next();
    } catch (err) {
      // Token invalid, continue with wallet address check
      console.warn('[Auth] JWT verification failed, falling back to wallet address');
    }
  }
  
  // Validate wallet address format (TRON address: starts with T, 34 characters)
  if (walletAddress) {
    // Basic TRON address validation
    if (walletAddress.length === 34 && walletAddress.startsWith('T')) {
      req.user = { walletAddress };
      req.walletAddress = walletAddress;
      return next();
    }
    
    // Also support Ethereum-style addresses (for testing)
    if (walletAddress.startsWith('0x') && walletAddress.length === 42) {
      req.user = { walletAddress };
      req.walletAddress = walletAddress;
      return next();
    }
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid wallet address format' 
    });
  }
  
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required. Please connect your wallet.' 
  });
};

/**
 * Optional auth middleware - doesn't reject if no auth
 * Useful for endpoints that work differently for authenticated users
 */
const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  let walletAddress = req.body.walletAddress || 
                      req.params.walletAddress || 
                      req.query.walletAddress ||
                      req.header('x-wallet-address');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.user = decoded.user;
      req.walletAddress = decoded.user?.walletAddress || decoded.user?.id;
      return next();
    } catch (err) {
      // Continue without auth
    }
  }
  
  if (walletAddress) {
    req.walletAddress = walletAddress;
    req.user = { walletAddress };
  }
  
  next();
};

/**
 * Admin middleware - requires admin role
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  // Check for admin role or admin wallet address
  const adminAddresses = (config.ADMIN_ADDRESSES || '').split(',').map(a => a.toLowerCase());
  
  if (req.user.role === 'admin' || 
      adminAddresses.includes(req.user.walletAddress?.toLowerCase())) {
    return next();
  }
  
  return res.status(403).json({ success: false, error: 'Admin access required' });
};

module.exports = {
  validateToken,
  authMiddleware,
  optionalAuth,
  adminMiddleware
};
