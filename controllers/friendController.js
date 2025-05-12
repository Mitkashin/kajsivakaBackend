const db = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * Send a friend request to another user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendFriendRequest = async (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.userId; // From auth middleware

  try {
    // Check if users exist
    const [senderExists] = await db.execute('SELECT id FROM users WHERE id = ?', [senderId]);
    const [receiverExists] = await db.execute('SELECT id FROM users WHERE id = ?', [receiverId]);

    if (senderExists.length === 0) {
      return res.status(404).json({ success: false, message: 'Sender user not found' });
    }

    if (receiverExists.length === 0) {
      return res.status(404).json({ success: false, message: 'Receiver user not found' });
    }

    // Check if sender is trying to add themselves
    if (senderId === parseInt(receiverId)) {
      return res.status(400).json({ success: false, message: 'You cannot send a friend request to yourself' });
    }

    // Check if they are already friends
    const [existingFriendship] = await db.execute(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [senderId, receiverId, receiverId, senderId]
    );

    if (existingFriendship.length > 0) {
      return res.status(400).json({ success: false, message: 'You are already friends with this user' });
    }

    // Check if there's already a pending request
    const [existingRequest] = await db.execute(
      'SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [senderId, receiverId, receiverId, senderId]
    );

    if (existingRequest.length > 0) {
      // If there's a request from the receiver to the sender, automatically accept it
      if (existingRequest[0].sender_id === parseInt(receiverId) && existingRequest[0].receiver_id === senderId) {
        // Update the request status
        await db.execute(
          'UPDATE friend_requests SET status = "accepted", updated_at = NOW() WHERE id = ?',
          [existingRequest[0].id]
        );

        // Create friendship entries (bidirectional)
        await db.execute(
          'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
          [senderId, receiverId, receiverId, senderId]
        );

        return res.status(200).json({
          success: true,
          message: 'Friend request accepted automatically',
          status: 'accepted'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'A friend request already exists between these users',
        status: existingRequest[0].status
      });
    }

    // Create a new friend request
    await db.execute(
      'INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)',
      [senderId, receiverId]
    );

    // Send FCM notification to receiver
    await notificationService.sendFriendRequestNotification(senderId, receiverId);

    return res.status(201).json({ success: true, message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Respond to a friend request (accept or reject)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const respondToFriendRequest = async (req, res) => {
  const { requestId, action } = req.body;
  const userId = req.userId; // From auth middleware

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action. Must be "accept" or "reject"' });
  }

  try {
    // Get the friend request
    const [request] = await db.execute(
      'SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
      [requestId, userId]
    );

    if (request.length === 0) {
      return res.status(404).json({ success: false, message: 'Friend request not found or not pending' });
    }

    const friendRequest = request[0];

    // Update the request status
    await db.execute(
      'UPDATE friend_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      [action === 'accept' ? 'accepted' : 'rejected', requestId]
    );

    // If accepted, create friendship entries
    if (action === 'accept') {
      await db.execute(
        'INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
        [userId, friendRequest.sender_id, friendRequest.sender_id, userId]
      );

      // Send FCM notification to the friend
      await notificationService.sendFriendRequestAcceptedNotification(userId, friendRequest.sender_id);
    }

    return res.status(200).json({
      success: true,
      message: `Friend request ${action === 'accept' ? 'accepted' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error(`Error ${action}ing friend request:`, error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get all friends for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFriends = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get all friends with user details
    const [friends] = await db.execute(`
      SELECT u.id, u.username, u.full_name, u.avatar, f.created_at as friendship_date
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY u.full_name ASC
    `, [userId]);

    return res.status(200).json({ success: true, friends });
  } catch (error) {
    console.error('Error getting friends:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get all pending friend requests for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFriendRequests = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get incoming friend requests
    const [incomingRequests] = await db.execute(`
      SELECT fr.id, fr.sender_id, fr.created_at, fr.status,
             u.username, u.full_name, u.avatar
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.id
      WHERE fr.receiver_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [userId]);

    // Get outgoing friend requests
    const [outgoingRequests] = await db.execute(`
      SELECT fr.id, fr.receiver_id, fr.created_at, fr.status,
             u.username, u.full_name, u.avatar
      FROM friend_requests fr
      JOIN users u ON fr.receiver_id = u.id
      WHERE fr.sender_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [userId]);

    return res.status(200).json({
      success: true,
      incomingRequests,
      outgoingRequests
    });
  } catch (error) {
    console.error('Error getting friend requests:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Remove a friend
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeFriend = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if the friendship exists
    const [friendship] = await db.execute(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );

    if (friendship.length === 0) {
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    // Delete the friendship (both directions)
    await db.execute(
      'DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );

    // Also delete any friend requests between these users
    await db.execute(
      'DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [userId, friendId, friendId, userId]
    );

    return res.status(200).json({ success: true, message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Search for users to add as friends
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const searchUsers = async (req, res) => {
  const { query } = req.query;
  const userId = req.userId; // From auth middleware

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
  }

  try {
    // Search for users by username or full name
    const [users] = await db.execute(`
      SELECT id, username, full_name, avatar
      FROM users
      WHERE (username LIKE ? OR full_name LIKE ?) AND id != ?
      LIMIT 20
    `, [`%${query}%`, `%${query}%`, userId]);

    // Get friend status for each user
    const usersWithStatus = await Promise.all(users.map(async (user) => {
      // Check if they are already friends
      const [friendship] = await db.execute(
        'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
        [userId, user.id, user.id, userId]
      );

      if (friendship.length > 0) {
        return { ...user, status: 'friend' };
      }

      // Check if there's a pending request
      const [request] = await db.execute(
        'SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
        [userId, user.id, user.id, userId]
      );

      if (request.length > 0) {
        const req = request[0];
        if (req.status === 'pending') {
          if (req.sender_id === userId) {
            return { ...user, status: 'request_sent' };
          } else {
            return { ...user, status: 'request_received', requestId: req.id };
          }
        }
        return { ...user, status: req.status };
      }

      return { ...user, status: 'none' };
    }));

    return res.status(200).json({ success: true, users: usersWithStatus });
  } catch (error) {
    console.error('Error searching users:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  sendFriendRequest,
  respondToFriendRequest,
  getFriends,
  getFriendRequests,
  removeFriend,
  searchUsers
};
