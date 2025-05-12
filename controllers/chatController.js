const db = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * Get chat history with a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getChatHistory = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if they are friends
    const [friendship] = await db.execute(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );

    if (friendship.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not friends with this user' });
    }

    // Get chat messages
    const [messages] = await db.execute(`
      SELECT * FROM chat_messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [userId, friendId, friendId, userId]);

    // Mark messages as read
    await db.execute(`
      UPDATE chat_messages
      SET is_read = 1
      WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
    `, [friendId, userId]);

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error getting chat history:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get all chat conversations for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getConversations = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get all conversations with the latest message and unread count
    const [conversations] = await db.execute(`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.avatar,
        (
          SELECT message
          FROM chat_messages
          WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at
          FROM chat_messages
          WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*)
          FROM chat_messages
          WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0
        ) as unread_count
      FROM users u
      JOIN friends f ON (f.user_id = ? AND f.friend_id = u.id)
      WHERE EXISTS (
        SELECT 1
        FROM chat_messages
        WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
      )
      ORDER BY last_message_time DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId]);

    return res.status(200).json({ success: true, conversations });
  } catch (error) {
    console.error('Error getting conversations:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Send a message to a friend
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendMessage = async (req, res) => {
  const { receiverId, message } = req.body;
  const senderId = req.userId; // From auth middleware

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message cannot be empty' });
  }

  try {
    // Check if they are friends
    const [friendship] = await db.execute(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [senderId, receiverId, receiverId, senderId]
    );

    if (friendship.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not friends with this user' });
    }

    // Check for recent duplicate messages (within the last 10 seconds)
    const [recentDuplicates] = await db.execute(
      `SELECT * FROM chat_messages
       WHERE sender_id = ? AND receiver_id = ? AND message = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL 10 SECOND)`,
      [senderId, receiverId, message]
    );

    // If a duplicate message was found, return it instead of creating a new one
    if (recentDuplicates.length > 0) {
      console.log('REST API prevented duplicate message:', message);
      return res.status(200).json({
        success: true,
        message: 'Message sent successfully (duplicate prevented)',
        data: recentDuplicates[0],
        isDuplicate: true
      });
    }

    // Insert the message
    const [result] = await db.execute(
      'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [senderId, receiverId, message]
    );

    // Get the inserted message
    const [messages] = await db.execute(
      'SELECT * FROM chat_messages WHERE id = ?',
      [result.insertId]
    );

    // Send FCM notification to receiver
    await notificationService.sendChatMessageNotification(senderId, receiverId, message);

    return res.status(201).json({ success: true, message: 'Message sent successfully', data: messages[0] });
  } catch (error) {
    console.error('Error sending message:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get unread message count for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUnreadCount = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get total unread count
    const [result] = await db.execute(
      'SELECT COUNT(*) as count FROM chat_messages WHERE receiver_id = ? AND is_read = 0',
      [userId]
    );

    return res.status(200).json({ success: true, unreadCount: result[0].count });
  } catch (error) {
    console.error('Error getting unread count:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Mark messages as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markAsRead = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Mark messages as read
    await db.execute(
      'UPDATE chat_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [friendId, userId]
    );

    return res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getChatHistory,
  getConversations,
  sendMessage,
  getUnreadCount,
  markAsRead
};
