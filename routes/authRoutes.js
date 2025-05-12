const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { login, register, refreshAccessToken, updateProfile, updateAvatar, deleteAccount, biometricLogin } = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");
const db = require("../config/db");

// Auth route handlers initialized

// Simple ping endpoint for connection testing
router.get("/ping", (_, res) => {
  const serverInfo = {
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Server is running",
    environment: process.env.NODE_ENV || "development"
  };

  res.json(serverInfo);
});

// Authentication routes
router.post("/login", login);
router.post("/register", register);
router.post("/refresh-token", refreshAccessToken);
router.post("/biometric-login", biometricLogin);

// Protected route for testing authentication
router.get("/protected", verifyToken, (req, res) => {
  console.log('Protected route accessed by user ID:', req.userId);
  res.json({
    success: true,
    message: "You are authenticated!",
    userId: req.userId
  });
});

// Get current user data (used by the mobile app for authentication check)
router.get("/me", verifyToken, async (req, res) => {
  console.log('Me endpoint accessed by user ID:', req.userId);

  try {
    // Get user data from database
    const [rows] = await db.execute(
      "SELECT id, username, email, full_name, phone, is_business, avatar, created_at, updated_at FROM users WHERE id = ?",
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      user: rows[0]
    });
  } catch (error) {
    console.error("Error fetching user data:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// User profile routes
router.get("/profile/:userId", verifyToken, (req, res) => {
  // Verify that the authenticated user is requesting their own profile
  if (req.userId !== parseInt(req.params.userId)) {
    return res.status(403).json({
      success: false,
      message: "You can only access your own profile"
    });
  }

  // Get user profile from database
  db.execute(
    "SELECT id, username, email, full_name, phone, is_business, avatar, created_at, updated_at FROM users WHERE id = ?",
    [req.params.userId]
  )
    .then(([rows]) => {
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      return res.json({
        success: true,
        user: rows[0]
      });
    })
    .catch(error => {
      console.error("Error fetching user profile:", error.message);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message
      });
    });
});
router.put("/profile/:userId", verifyToken, updateProfile);
router.put("/profile/:userId/avatar", verifyToken, updateAvatar);

// Delete account route
router.delete("/account/:userId", verifyToken, deleteAccount);

// Change password route
router.put("/password/:userId", verifyToken, async (req, res) => {
  // Verify that the authenticated user is changing their own password
  if (req.userId !== parseInt(req.params.userId)) {
    return res.status(403).json({
      success: false,
      message: "You can only change your own password"
    });
  }

  const { currentPassword, newPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required"
    });
  }

  // Minimum password length validation
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters long"
    });
  }

  // Verify current password and update to new password
  try {
    console.log(`Password change attempt for user ID: ${req.userId}`);

    // First, get the user's current password from the database
    const [rows] = await db.execute(
      "SELECT password FROM users WHERE id = ?",
      [req.userId]
    );

    if (rows.length === 0) {
      console.log(`User not found for ID: ${req.userId}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log(`Retrieved password hash for user ID: ${req.userId}`);


    const storedPassword = rows[0].password;

    // Use bcrypt to compare the plain text password from the request with the hashed password from the database
    console.log('Comparing passwords using bcrypt...');
    try {
      const passwordMatches = await bcrypt.compare(currentPassword, storedPassword);

      if (!passwordMatches) {
        console.log(`Password verification failed for user ID: ${req.userId}`);
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect"
        });
      }

      console.log(`Password verification successful for user ID: ${req.userId}`);
    } catch (bcryptError) {
      console.error('bcrypt comparison error:', bcryptError);
      return res.status(500).json({
        success: false,
        message: "Error verifying password",
        error: bcryptError.message
      });
    }

    // Hash the new password before storing it in the database
    console.log(`Hashing new password for user ID: ${req.userId}`);
    let hashedNewPassword;
    try {
      hashedNewPassword = await bcrypt.hash(newPassword, 10);
      console.log('New password hashed successfully');
    } catch (hashError) {
      console.error('Error hashing new password:', hashError);
      return res.status(500).json({
        success: false,
        message: "Error processing new password",
        error: hashError.message
      });
    }

    // Update the password
    console.log(`Updating password in database for user ID: ${req.userId}`);
    try {
      await db.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedNewPassword, req.userId]
      );
      console.log(`Password updated successfully for user ID: ${req.userId}`);
    } catch (dbError) {
      console.error('Database error updating password:', dbError);
      return res.status(500).json({
        success: false,
        message: "Error updating password in database",
        error: dbError.message
      });
    }

    // Send success response
    return res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error("Error changing password:", error.message);
    console.error("Error stack:", error.stack);

    // Check if it's a token verification error
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Authentication failed: " + error.message,
        error: error.name
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

module.exports = router;
