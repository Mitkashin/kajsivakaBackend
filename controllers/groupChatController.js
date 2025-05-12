const db = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * Create a new group chat
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createGroup = async (req, res) => {
  const { name, description, members } = req.body;
  const userId = req.userId; // From auth middleware

  if (!name || !members || !Array.isArray(members)) {
    return res.status(400).json({ success: false, message: 'Invalid group data' });
  }

  try {
    // Get a connection from the pool for transaction
    const connection = await db.getConnection();

    try {
      // Start a transaction
      await connection.beginTransaction();

      // Create the group
      const [result] = await connection.execute(
        'INSERT INTO chat_groups (name, description, created_by) VALUES (?, ?, ?)',
        [name, description || '', userId]
      );

      const groupId = result.insertId;

      // Add the creator as an admin
      await connection.execute(
        'INSERT INTO chat_group_members (group_id, user_id, is_admin) VALUES (?, ?, 1)',
        [groupId, userId]
      );

      // Add other members
      const addedMembers = [];
      for (const memberId of members) {
        // Skip if it's the creator (already added as admin)
        if (memberId === userId) continue;

        // Check if user exists
        const [user] = await connection.execute('SELECT id FROM users WHERE id = ?', [memberId]);
        if (user.length === 0) continue;

        // Add the member
        await connection.execute(
          'INSERT INTO chat_group_members (group_id, user_id, is_admin) VALUES (?, ?, 0)',
          [groupId, memberId]
        );

        // Track successfully added members for notifications
        addedMembers.push(memberId);
      }

      // Commit the transaction
      await connection.commit();

      // Get the created group
      const [groups] = await connection.execute(
        'SELECT * FROM chat_groups WHERE id = ?',
        [groupId]
      );

      // Release the connection back to the pool
      connection.release();

      // Send notifications to all added members (async, don't wait)
      for (const memberId of addedMembers) {
        notificationService.sendAddedToGroupNotification(groupId, memberId, userId)
          .catch(error => console.error(`Failed to send group addition notification to user ${memberId}:`, error));
      }

      return res.status(201).json({
        success: true,
        message: 'Group created successfully',
        group: groups[0]
      });
    } catch (error) {
      // Rollback the transaction on error
      await connection.rollback();
      // Release the connection back to the pool
      connection.release();
      throw error; // Re-throw to be caught by the outer catch block
    }
  } catch (error) {
    console.error('Error creating group:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get all groups for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGroups = async (req, res) => {
  const userId = req.userId; // From auth middleware

  try {
    // Get all groups the user is a member of
    const [groups] = await db.execute(`
      SELECT
        g.id,
        g.name,
        g.description,
        g.avatar,
        g.created_at,
        gm.is_admin,
        (
          SELECT COUNT(*)
          FROM chat_group_members
          WHERE group_id = g.id
        ) as member_count,
        (
          SELECT message
          FROM chat_group_messages
          WHERE group_id = g.id
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at
          FROM chat_group_messages
          WHERE group_id = g.id
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message_time,
        (
          SELECT u.username
          FROM chat_group_messages cgm
          JOIN users u ON cgm.sender_id = u.id
          WHERE cgm.group_id = g.id
          ORDER BY cgm.created_at DESC
          LIMIT 1
        ) as last_sender_name,
        (
          SELECT COUNT(*)
          FROM chat_group_messages cgm
          LEFT JOIN chat_group_message_reads cgmr ON cgm.id = cgmr.message_id AND cgmr.user_id = ?
          WHERE cgm.group_id = g.id AND cgmr.id IS NULL AND cgm.sender_id != ?
        ) as unread_count
      FROM chat_groups g
      JOIN chat_group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY CASE WHEN last_message_time IS NULL THEN 0 ELSE 1 END DESC, last_message_time DESC
    `, [userId, userId, userId]);

    return res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error('Error getting groups:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get group details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGroupDetails = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is a member of the group
    const [membership] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    // Get group details
    const [groups] = await db.execute(`
      SELECT
        g.*,
        (
          SELECT COUNT(*)
          FROM chat_group_members
          WHERE group_id = g.id
        ) as member_count,
        (
          SELECT is_admin
          FROM chat_group_members
          WHERE group_id = g.id AND user_id = ?
        ) as is_admin
      FROM chat_groups g
      WHERE g.id = ?
    `, [userId, groupId]);

    if (groups.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    return res.status(200).json({ success: true, group: groups[0] });
  } catch (error) {
    console.error('Error getting group details:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get group members
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGroupMembers = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is a member of the group
    const [membership] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    // Get group members
    const [members] = await db.execute(`
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.avatar,
        gm.is_admin,
        gm.joined_at
      FROM chat_group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.is_admin DESC, u.full_name ASC
    `, [groupId]);

    return res.status(200).json({ success: true, members });
  } catch (error) {
    console.error('Error getting group members:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Add a member to a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const addGroupMember = async (req, res) => {
  const { groupId } = req.params;
  const { userId: memberId } = req.body;
  const userId = req.userId; // From auth middleware

  if (!memberId) {
    return res.status(400).json({ success: false, message: 'Member ID is required' });
  }

  try {
    // Check if user is an admin of the group
    const [admin] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ? AND is_admin = 1',
      [groupId, userId]
    );

    if (admin.length === 0) {
      return res.status(403).json({ success: false, message: 'Only group admins can add members' });
    }

    // Check if the member is already in the group
    const [existingMember] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, memberId]
    );

    if (existingMember.length > 0) {
      return res.status(400).json({ success: false, message: 'User is already a member of this group' });
    }

    // Add the member
    await db.execute(
      'INSERT INTO chat_group_members (group_id, user_id, is_admin) VALUES (?, ?, 0)',
      [groupId, memberId]
    );

    // Send notification to the added member (async, don't wait)
    notificationService.sendAddedToGroupNotification(groupId, memberId, userId)
      .catch(error => console.error(`Failed to send group addition notification to user ${memberId}:`, error));

    return res.status(200).json({
      success: true,
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Error adding group member:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Remove a member from a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const removeGroupMember = async (req, res) => {
  const { groupId, userId: memberId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is an admin of the group
    const [admin] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ? AND is_admin = 1',
      [groupId, userId]
    );

    if (admin.length === 0) {
      return res.status(403).json({ success: false, message: 'Only group admins can remove members' });
    }

    // Check if the member is in the group
    const [existingMember] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, memberId]
    );

    if (existingMember.length === 0) {
      return res.status(400).json({ success: false, message: 'User is not a member of this group' });
    }

    // Check if the member is the only admin
    if (memberId === userId) {
      const [admins] = await db.execute(
        'SELECT * FROM chat_group_members WHERE group_id = ? AND is_admin = 1',
        [groupId]
      );

      if (admins.length === 1) {
        return res.status(400).json({ success: false, message: 'Cannot remove the only admin from the group' });
      }
    }

    // Remove the member
    await db.execute(
      'DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, memberId]
    );

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing group member:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Leave a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const leaveGroup = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is a member of the group
    const [membership] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    // Check if the user is the only admin
    if (membership[0].is_admin) {
      const [admins] = await db.execute(
        'SELECT * FROM chat_group_members WHERE group_id = ? AND is_admin = 1',
        [groupId]
      );

      if (admins.length === 1) {
        // Get other members
        const [members] = await db.execute(
          'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id != ?',
          [groupId, userId]
        );

        if (members.length > 0) {
          // Promote the first member to admin
          await db.execute(
            'UPDATE chat_group_members SET is_admin = 1 WHERE group_id = ? AND user_id = ?',
            [groupId, members[0].user_id]
          );
        }
      }
    }

    // Remove the user from the group
    await db.execute(
      'DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Left group successfully'
    });
  } catch (error) {
    console.error('Error leaving group:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Update group details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateGroup = async (req, res) => {
  const { groupId } = req.params;
  const { name, description, avatar } = req.body;
  const userId = req.userId; // From auth middleware

  if (!name) {
    return res.status(400).json({ success: false, message: 'Group name is required' });
  }

  try {
    // Check if user is an admin of the group
    const [admin] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ? AND is_admin = 1',
      [groupId, userId]
    );

    if (admin.length === 0) {
      return res.status(403).json({ success: false, message: 'Only group admins can update group details' });
    }

    // Update the group
    await db.execute(
      'UPDATE chat_groups SET name = ?, description = ?, avatar = ? WHERE id = ?',
      [name, description || '', avatar || null, groupId]
    );

    // Get the updated group
    const [groups] = await db.execute(
      'SELECT * FROM chat_groups WHERE id = ?',
      [groupId]
    );

    return res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      group: groups[0]
    });
  } catch (error) {
    console.error('Error updating group:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Delete a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteGroup = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is an admin of the group
    const [admin] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ? AND is_admin = 1',
      [groupId, userId]
    );

    if (admin.length === 0) {
      return res.status(403).json({ success: false, message: 'Only group admins can delete the group' });
    }

    // Delete the group (cascade will delete members and messages)
    await db.execute(
      'DELETE FROM chat_groups WHERE id = ?',
      [groupId]
    );

    return res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting group:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get group messages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGroupMessages = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is a member of the group
    const [membership] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    // Get messages
    const [messages] = await db.execute(`
      SELECT
        m.*,
        u.username as sender_username,
        u.full_name as sender_full_name,
        u.avatar as sender_avatar
      FROM chat_group_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = ?
      ORDER BY m.created_at ASC
    `, [groupId]);

    // Mark messages as read - simplified version without transaction
    const messageIds = messages.map(m => m.id);
    if (messageIds.length > 0) {
      for (const messageId of messageIds) {
        try {
          await db.execute(`
            INSERT IGNORE INTO chat_group_message_reads (message_id, user_id)
            VALUES (?, ?)
          `, [messageId, userId]);
        } catch (err) {
          console.error(`Error marking message ${messageId} as read:`, err.message);
          // Continue with other messages even if one fails
        }
      }
    }

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error getting group messages:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Send a message to a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendGroupMessage = async (req, res) => {
  const { groupId } = req.params;
  const { message } = req.body;
  const userId = req.userId; // From auth middleware

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message cannot be empty' });
  }

  try {
    // Check if user is a member of the group
    const [membership] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    // Check for recent duplicate messages (within the last 10 seconds)
    const [recentDuplicates] = await db.execute(
      `SELECT * FROM chat_group_messages
       WHERE group_id = ? AND sender_id = ? AND message = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL 10 SECOND)`,
      [groupId, userId, message]
    );

    // If a duplicate message was found, return it instead of creating a new one
    if (recentDuplicates.length > 0) {
      console.log('REST API prevented duplicate group message:', message);
      return res.status(200).json({
        success: true,
        message: 'Message sent successfully (duplicate prevented)',
        data: recentDuplicates[0],
        isDuplicate: true
      });
    }

    // Insert the message
    const [result] = await db.execute(
      'INSERT INTO chat_group_messages (group_id, sender_id, message) VALUES (?, ?, ?)',
      [groupId, userId, message]
    );

    // Get the inserted message with sender details
    const [messages] = await db.execute(`
      SELECT
        m.*,
        u.username as sender_username,
        u.full_name as sender_full_name,
        u.avatar as sender_avatar
      FROM chat_group_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);

    const newMessage = messages[0];

    // Mark the message as read by the sender
    await db.execute(
      'INSERT INTO chat_group_message_reads (message_id, user_id) VALUES (?, ?)',
      [newMessage.id, userId]
    );

    // Send FCM notification to all group members
    await notificationService.sendGroupMessageNotification(userId, groupId, message);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Error sending group message:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Mark group messages as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markGroupMessagesAsRead = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId; // From auth middleware

  try {
    // Check if user is a member of the group
    const [membership] = await db.execute(
      'SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }

    // Get unread messages
    const [unreadMessages] = await db.execute(`
      SELECT m.id
      FROM chat_group_messages m
      LEFT JOIN chat_group_message_reads r ON m.id = r.message_id AND r.user_id = ?
      WHERE m.group_id = ? AND r.id IS NULL
    `, [userId, groupId]);

    // Mark messages as read - simplified version without transaction
    let markedCount = 0;
    if (unreadMessages.length > 0) {
      for (const message of unreadMessages) {
        try {
          await db.execute(
            'INSERT IGNORE INTO chat_group_message_reads (message_id, user_id) VALUES (?, ?)',
            [message.id, userId]
          );
          markedCount++;
        } catch (err) {
          console.error(`Error marking message ${message.id} as read:`, err.message);
          // Continue with other messages even if one fails
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      count: markedCount
    });
  } catch (error) {
    console.error('Error marking group messages as read:', error.message);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupDetails,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  updateGroup,
  deleteGroup,
  getGroupMessages,
  sendGroupMessage,
  markGroupMessagesAsRead
};
