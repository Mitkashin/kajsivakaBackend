const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Middleware to verify JWT token
 */
exports.verifyToken = (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.log('No Authorization header provided');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  // Check if the header has the correct format
  if (!authHeader.startsWith('Bearer ')) {
    console.log('Invalid Authorization header format');
    return res.status(401).json({ success: false, message: 'Invalid token format' });
  }
  
  // Extract the token
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    console.log('No token found in Authorization header');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  // Check if JWT_SECRET is properly set
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set in environment variables');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }
  
  // Verify the token
  try {
    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified successfully. User ID:', decoded.id);
    
    // Add the user ID to the request object
    req.userId = decoded.id;
    
    // Continue to the next middleware or route handler
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    
    // Provide more specific error messages based on the error type
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has expired',
        error: err.name
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token',
        error: err.name
      });
    }
    
    // Generic error for other cases
    return res.status(401).json({ 
      success: false, 
      message: `Token verification failed: ${err.message}`,
      error: err.name
    });
  }
};
