const db = require('../config/db');

/**
 * Share a venue or event with a friend
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const shareItem = async (req, res) => {
  const { receiverId, itemType, itemId, message } = req.body;
  const senderId = req.userId; // From auth middleware

  if (!['venue', 'event'].includes(itemType)) {
    return res.status(400).json({ success: false, message: 'Invalid item type. Must be "venue" or "event"' });
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

    // Check if the item exists
    const table = itemType === 'venue' ? 'venues' : 'events';
    const [item] = await db.execute(`SELECT * FROM ${table} WHERE id = ?`, [itemId]);

    if (item.length === 0) {
      return res.status(404).json({ success: false, message: `${itemType} not found` });
    }

    // Insert the shared item
    const [result] = await db.execute(
      'INSERT INTO shared_items (sender_id, receiver_id, item_type, item_id, message) VALUES (?, ?, ?, ?, ?)',
      [senderId, receiverId, itemType, itemId, message || null]
    );

    return res.status(201).json({ success: true, message: `${itemType} shared successfully` });
  } catch (error) {
    console.error('Error sharing item:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get all shared items for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSharedItems = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get shared venues
    const [sharedVenues] = await db.execute(`
      SELECT 
        si.id, si.sender_id, si.item_id, si.message, si.is_read, si.created_at,
        u.username as sender_username, u.full_name as sender_name, u.avatar as sender_avatar,
        v.name as venue_name, v.image as venue_image, v.premium as venue_premium
      FROM shared_items si
      JOIN users u ON si.sender_id = u.id
      JOIN venues v ON si.item_id = v.id
      WHERE si.receiver_id = ? AND si.item_type = 'venue'
      ORDER BY si.created_at DESC
    `, [userId]);

    // Get shared events
    const [sharedEvents] = await db.execute(`
      SELECT 
        si.id, si.sender_id, si.item_id, si.message, si.is_read, si.created_at,
        u.username as sender_username, u.full_name as sender_name, u.avatar as sender_avatar,
        e.name as event_name, e.image as event_image, e.event_date as event_date
      FROM shared_items si
      JOIN users u ON si.sender_id = u.id
      JOIN events e ON si.item_id = e.id
      WHERE si.receiver_id = ? AND si.item_type = 'event'
      ORDER BY si.created_at DESC
    `, [userId]);

    return res.status(200).json({ 
      success: true, 
      sharedVenues,
      sharedEvents
    });
  } catch (error) {
    console.error('Error getting shared items:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Mark a shared item as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markSharedItemAsRead = async (req, res) => {
  const { itemId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Mark the item as read
    const [result] = await db.execute(
      'UPDATE shared_items SET is_read = 1 WHERE id = ? AND receiver_id = ?',
      [itemId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Shared item not found' });
    }

    return res.status(200).json({ success: true, message: 'Shared item marked as read' });
  } catch (error) {
    console.error('Error marking shared item as read:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get unread shared items count
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUnreadSharedItemsCount = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get unread count
    const [result] = await db.execute(
      'SELECT COUNT(*) as count FROM shared_items WHERE receiver_id = ? AND is_read = 0',
      [userId]
    );

    return res.status(200).json({ success: true, unreadCount: result[0].count });
  } catch (error) {
    console.error('Error getting unread shared items count:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  shareItem,
  getSharedItems,
  markSharedItemAsRead,
  getUnreadSharedItemsCount
};
