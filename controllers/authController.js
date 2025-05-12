const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Log JWT configuration for debugging
console.log("JWT Config:", {
  secret: process.env.JWT_SECRET ? "[Set]" : "[Not Set]",
  expiresIn: process.env.JWT_EXPIRES_IN,
  refreshSecret: process.env.JWT_REFRESH_SECRET ? "[Set]" : "[Not Set]",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN
});


exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`Login attempt for email: ${email}`);

    // Check if JWT_SECRET is properly set
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set!');
      return res.status(500).json({ success: false, message: "Server configuration error: JWT_SECRET not set" });
    }

    // Check if JWT_REFRESH_SECRET is properly set
    if (!process.env.JWT_REFRESH_SECRET) {
      console.error('JWT_REFRESH_SECRET is not set!');
      return res.status(500).json({ success: false, message: "Server configuration error: JWT_REFRESH_SECRET not set" });
    }

    const [rows] = await db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      console.log(`No user found with email: ${email}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = rows[0];
    console.log(`User found: ${user.id} (${user.full_name})`);

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log(`Password mismatch for user: ${user.id}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    console.log(`Password verified for user: ${user.id}`);

    // Use environment variables with fallbacks for token expiration
    const jwtOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    };

    console.log('JWT sign options:', jwtOptions);

    try {
      const accessToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        jwtOptions
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      console.log("Tokens generated successfully");

      // Optional: save refreshToken to DB for logout-from-all-devices functionality

      delete user.password;

      return res.json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken,
        user,
      });
    } catch (tokenErr) {
      console.error("Token generation error:", tokenErr.message);
      console.error("Token error details:", tokenErr);
      return res.status(500).json({ success: false, message: `Token generation error: ${tokenErr.message}` });
    }
  } catch (err) {
    console.error("Login error:", err.message);
    console.error("Error details:", err);
    res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  }
};




exports.register = async (req, res) => {
  const { fullName, email, password, phone, isBusiness } = req.body;

  try {
    const [existing] = await db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // 👈 Hash the password

    await db.execute(
      "INSERT INTO users (full_name, email, password, phone, is_business) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, hashedPassword, phone, isBusiness ? 1 : 0]
    );

    return res.status(201).json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = req.body;

    // Verify that the authenticated user is updating their own profile
    if (req.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile"
      });
    }

    // Remove sensitive fields that shouldn't be updated directly
    delete userData.password;

    // Build the SQL query dynamically based on the provided fields
    const updateFields = [];
    const updateValues = [];

    // Only include fields that are provided in the request
    if (userData.full_name) {
      updateFields.push("full_name = ?");
      updateValues.push(userData.full_name);
    }

    if (userData.email) {
      updateFields.push("email = ?");
      updateValues.push(userData.email);
    }

    if (userData.phone) {
      updateFields.push("phone = ?");
      updateValues.push(userData.phone);
    }

    if (userData.avatar) {
      updateFields.push("avatar = ?");
      updateValues.push(userData.avatar);
    }

    // If no fields to update, return early
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update"
      });
    }

    // Add the user ID to the values array
    updateValues.push(userId);

    // Execute the update query
    const updateQuery = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
    const [result] = await db.execute(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found or no changes made"
      });
    }

    // Get the updated user data
    const [updatedUserRows] = await db.execute(
      "SELECT id, username, email, full_name, phone, is_business, avatar, created_at, updated_at FROM users WHERE id = ?",
      [userId]
    );

    if (updatedUserRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found after update"
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUserRows[0]
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    const { userId } = req.params;
    const { avatar } = req.body;

    // Verify that the authenticated user is updating their own avatar
    if (req.userId !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own avatar"
      });
    }

    // Validate avatar URL
    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: "Avatar URL is required"
      });
    }

    // Update the avatar in the database
    const [result] = await db.execute(
      "UPDATE users SET avatar = ? WHERE id = ?",
      [avatar, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found or no changes made"
      });
    }

    return res.json({
      success: true,
      message: "Avatar updated successfully",
      avatar: avatar
    });
  } catch (error) {
    console.error("Update avatar error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

exports.refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  console.log('Refresh token request received');

  if (!refreshToken) {
    console.error('No refresh token provided in request');
    return res.status(401).json({ success: false, message: "Missing refresh token" });
  }

  console.log('Refresh token provided:', refreshToken.substring(0, 20) + '...');

  // Check if JWT_SECRET is properly set
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set!');
    return res.status(500).json({ success: false, message: "Server configuration error: JWT_SECRET not set" });
  }

  // Check if JWT_REFRESH_SECRET is properly set
  if (!process.env.JWT_REFRESH_SECRET) {
    console.error('JWT_REFRESH_SECRET is not set!');
    return res.status(500).json({ success: false, message: "Server configuration error: JWT_REFRESH_SECRET not set" });
  }

  try {
    console.log('Verifying refresh token...');
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    console.log('Refresh token verified successfully. Payload:', payload);

    const jwtOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    };

    console.log('JWT sign options for new access token:', jwtOptions);

    try {
      const newAccessToken = jwt.sign(
        { id: payload.id },
        process.env.JWT_SECRET,
        jwtOptions
      );

      console.log("New access token generated successfully");

      res.json({ success: true, accessToken: newAccessToken });
    } catch (tokenErr) {
      console.error("Token generation error:", tokenErr.message);
      console.error("Token error details:", tokenErr);
      return res.status(500).json({ success: false, message: `Token generation error: ${tokenErr.message}` });
    }
  } catch (err) {
    console.error("Refresh error:", err.message);
    console.error("Error details:", err);

    // Provide more specific error messages based on the error type
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Refresh token has expired. Please log in again.",
        error: err.name
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token. Please log in again.",
        error: err.name
      });
    }

    res.status(403).json({
      success: false,
      message: `Invalid refresh token: ${err.message}`,
      error: err.name
    });
  }
};

exports.biometricLogin = async (req, res) => {
  const { refreshToken, userId } = req.body;

  console.log('Biometric login attempt for user ID:', userId);

  if (!refreshToken || !userId) {
    console.error('Missing refreshToken or userId in biometric login request');
    return res.status(400).json({ success: false, message: "Missing refreshToken or userId" });
  }

  // Check if JWT_SECRET is properly set
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set!');
    return res.status(500).json({ success: false, message: "Server configuration error: JWT_SECRET not set" });
  }

  // Check if JWT_REFRESH_SECRET is properly set
  if (!process.env.JWT_REFRESH_SECRET) {
    console.error('JWT_REFRESH_SECRET is not set!');
    return res.status(500).json({ success: false, message: "Server configuration error: JWT_REFRESH_SECRET not set" });
  }

  try {
    // Verify the refresh token
    console.log('Verifying refresh token...');
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    console.log('Refresh token verified successfully. Payload:', payload);

    // Check if the user ID in the token matches the requested user ID
    if (payload.id !== parseInt(userId)) {
      console.error(`User ID mismatch: Token has ${payload.id}, request has ${userId}`);
      return res.status(403).json({ success: false, message: "Invalid token for this user" });
    }

    // Get the user data from the database
    const [userRows] = await db.execute(
      "SELECT id, username, email, full_name, phone, is_business, avatar, created_at, updated_at FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userRows[0];
    console.log(`User found: ${user.id} (${user.full_name})`);

    // Generate new tokens
    const jwtOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    };

    console.log('JWT sign options for new tokens:', jwtOptions);

    try {
      // Generate new access token
      const accessToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        jwtOptions
      );

      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      console.log("New tokens generated successfully for biometric login");

      return res.json({
        success: true,
        message: "Biometric login successful",
        accessToken,
        refreshToken: newRefreshToken,
        user
      });
    } catch (tokenErr) {
      console.error("Token generation error:", tokenErr.message);
      console.error("Token error details:", tokenErr);
      return res.status(500).json({ success: false, message: `Token generation error: ${tokenErr.message}` });
    }
  } catch (err) {
    console.error("Biometric login error:", err.message);
    console.error("Error details:", err);

    // Provide more specific error messages based on the error type
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Biometric token has expired. Please log in with password.",
        error: err.name
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid biometric token. Please log in with password.",
        error: err.name
      });
    }

    res.status(500).json({
      success: false,
      message: `Server error: ${err.message}`,
      error: err.name
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { password, deleteContent } = req.body;

    console.log(`Account deletion request for user ID: ${userId}`);

    // Verify that the authenticated user is deleting their own account
    if (req.userId !== parseInt(userId)) {
      console.error(`Unauthorized deletion attempt: Auth user ${req.userId} tried to delete user ${userId}`);
      return res.status(403).json({
        success: false,
        message: "You can only delete your own account"
      });
    }

    // Validate input
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required for verification"
      });
    }

    // First, get the user's current password from the database
    const [userRows] = await db.execute(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const storedPassword = userRows[0].password;

    // Verify password
    const passwordMatches = await bcrypt.compare(password, storedPassword);

    if (!passwordMatches) {
      console.log(`Password verification failed for user ID: ${userId}`);
      return res.status(401).json({
        success: false,
        message: "Password is incorrect"
      });
    }

    console.log(`Password verified for user ID: ${userId}, proceeding with account deletion`);

    // Start a transaction to ensure all deletions are atomic
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // If deleteContent flag is true, delete user's content
      if (deleteContent) {
        console.log(`Deleting content for user ID: ${userId}`);

        // Get all venues created by the user
        const [venueRows] = await connection.execute(
          "SELECT id FROM venues WHERE user_id = ?",
          [userId]
        );

        const venueIds = venueRows.map(venue => venue.id);
        console.log(`Found ${venueIds.length} venues to delete`);

        // For each venue, delete associated events
        // Note: This is handled by ON DELETE CASCADE in the database schema

        // Delete user's venues (this will cascade delete ratings)
        if (venueIds.length > 0) {
          await connection.execute(
            "DELETE FROM venues WHERE user_id = ?",
            [userId]
          );
          console.log(`Deleted venues for user ID: ${userId}`);
        }

        // Delete user's events - we need to do this before deleting venues
        if (venueIds.length > 0) {
          const venueIdsStr = venueIds.join(',');
          await connection.execute(
            `DELETE FROM events WHERE venue_id IN (${venueIdsStr})`
          );
          console.log(`Deleted events associated with user's venues`);
        }

        // Delete user's event interests
        await connection.execute(
          "DELETE FROM event_interests WHERE user_id = ?",
          [userId]
        );
        console.log(`Deleted event interests for user ID: ${userId}`);
      }

      // Finally, delete the user account
      await connection.execute(
        "DELETE FROM users WHERE id = ?",
        [userId]
      );

      await connection.commit();
      console.log(`User account ${userId} successfully deleted`);

      return res.json({
        success: true,
        message: "Account deleted successfully"
      });
    } catch (error) {
      await connection.rollback();
      console.error("Error during account deletion transaction:", error);
      throw error; // Re-throw to be caught by the outer catch block
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Account deletion error:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Server error during account deletion",
      error: error.message
    });
  }
};
