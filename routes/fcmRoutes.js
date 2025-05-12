const express = require('express');
const router = express.Router();
const db = require('../config/db');
const firebase = require('../config/firebase');

/**
 * Register FCM token for a user
 * POST /api/users/fcm-token
 */
router.post('/fcm-token', async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'User ID and token are required' });
    }

    // Check if user exists
    const [userResult] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (userResult.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if token already exists for this user
    const [tokenResult] = await db.execute(
      'SELECT id FROM user_fcm_tokens WHERE user_id = ? AND fcm_token = ?',
      [userId, token]
    );

    if (tokenResult.length > 0) {
      // Token already exists, update last_updated
      await db.execute(
        'UPDATE user_fcm_tokens SET last_updated = NOW() WHERE id = ?',
        [tokenResult[0].id]
      );
    } else {
      // Delete any existing tokens for this user
      await db.execute('DELETE FROM user_fcm_tokens WHERE user_id = ?', [userId]);

      // Insert new token
      await db.execute(
        'INSERT INTO user_fcm_tokens (user_id, fcm_token, created_at, last_updated) VALUES (?, ?, NOW(), NOW())',
        [userId, token]
      );
    }

    return res.json({ success: true, message: 'FCM token registered successfully' });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Get online users
 * GET /api/users/online
 */
router.get('/online', async (req, res) => {
  try {
    // Get users who have been active in the last 15 minutes
    const [result] = await db.execute(`
      SELECT DISTINCT user_id 
      FROM user_fcm_tokens 
      WHERE last_updated > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    `);

    const onlineUsers = result.map(row => row.user_id);

    return res.json({ success: true, users: onlineUsers });
  } catch (error) {
    console.error('Error getting online users:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Test FCM notification
 * POST /api/users/test-notification
 */
router.post('/test-notification', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Get user's FCM token
    const [tokenResult] = await db.execute(
      'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
      [userId]
    );

    if (tokenResult.length === 0) {
      return res.status(404).json({ success: false, message: 'No FCM token found for this user' });
    }

    // Send test notification
    const notification = {
      title: 'Test Notification',
      body: 'This is a test notification from the server'
    };

    const data = {
      type: 'test',
      message: 'Test message',
      timestamp: new Date().toISOString()
    };

    const result = await firebase.sendFCMMessage(tokenResult[0].fcm_token, notification, data);

    if (result) {
      return res.json({ success: true, message: 'Test notification sent successfully' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to send test notification' });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
