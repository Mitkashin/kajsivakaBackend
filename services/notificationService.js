const db = require('../config/db');
const firebase = require('../config/firebase');

/**
 * Notification Service
 * Handles sending notifications via Firebase Cloud Messaging (FCM)
 */
class NotificationService {
  /**
   * Send a chat message notification
   * @param {number} senderId - ID of the sender
   * @param {number} receiverId - ID of the receiver
   * @param {string} message - Message content
   * @returns {Promise} - Promise that resolves when notification is sent
   */
  async sendChatMessageNotification(senderId, receiverId, message) {
    try {
      console.log(`Sending chat notification from ${senderId} to ${receiverId}: ${message.substring(0, 30)}...`);

      // Get sender info
      const [senderResult] = await db.execute(
        'SELECT id, username, full_name, avatar FROM users WHERE id = ?',
        [senderId]
      );

      if (senderResult.length === 0) {
        console.error('Sender not found:', senderId);
        return null;
      }

      const sender = senderResult[0];

      // Get receiver's FCM token
      const [tokenResult] = await db.execute(
        'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
        [receiverId]
      );

      if (tokenResult.length === 0) {
        console.log('No FCM token found for user:', receiverId);
        return null;
      }

      // Check if token is valid
      const token = tokenResult[0].fcm_token;
      if (!token || token.trim() === '') {
        console.log('Empty FCM token found for user:', receiverId);
        return null;
      }

      // Get the actual message ID from the database
      const [messageResult] = await db.execute(
        'SELECT id FROM chat_messages WHERE sender_id = ? AND receiver_id = ? ORDER BY created_at DESC LIMIT 1',
        [senderId, receiverId]
      );

      const messageId = messageResult.length > 0 ? messageResult[0].id : Date.now().toString();

      // Send notification
      const notification = {
        title: 'New Message',
        body: `${sender.full_name || sender.username}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
      };

      const data = {
        type: 'newMessage',
        messageId: messageId.toString(),
        senderId: sender.id.toString(),
        senderUsername: sender.username || '',
        senderFullName: sender.full_name || '',
        senderAvatar: sender.avatar || '',
        receiverId: receiverId.toString(),
        message: message,
        createdAt: new Date().toISOString()
      };

      console.log('Sending FCM notification with data:', JSON.stringify(data));
      return await firebase.sendFCMMessage(token, notification, data);
    } catch (error) {
      console.error('Error sending chat message notification:', error);
      return null;
    }
  }



  /**
   * Send a friend request notification
   * @param {number} senderId - ID of the sender
   * @param {number} receiverId - ID of the receiver
   * @returns {Promise} - Promise that resolves when notification is sent
   */
  async sendFriendRequestNotification(senderId, receiverId) {
    try {
      // Get sender info
      const [senderResult] = await db.execute(
        'SELECT id, username, full_name, avatar FROM users WHERE id = ?',
        [senderId]
      );

      if (senderResult.length === 0) {
        console.error('Sender not found:', senderId);
        return null;
      }

      const sender = senderResult[0];

      // Get receiver's FCM token
      const [tokenResult] = await db.execute(
        'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
        [receiverId]
      );

      if (tokenResult.length === 0) {
        console.log('No FCM token found for user:', receiverId);
        return null;
      }

      // Check if token is valid
      const token = tokenResult[0].fcm_token;
      if (!token || token.trim() === '') {
        console.log('Empty FCM token found for user:', receiverId);
        return null;
      }

      // Send notification
      const notification = {
        title: 'Friend Request',
        body: `${sender.full_name || sender.username} sent you a friend request`
      };

      const data = {
        type: 'friendRequest',
        senderId: sender.id.toString(),
        senderUsername: sender.username,
        senderFullName: sender.full_name,
        senderAvatar: sender.avatar,
        createdAt: new Date().toISOString()
      };

      return await firebase.sendFCMMessage(token, notification, data);
    } catch (error) {
      console.error('Error sending friend request notification:', error);
      return null;
    }
  }

  /**
   * Send a friend request accepted notification
   * @param {number} userId - ID of the user who accepted the request
   * @param {number} friendId - ID of the user who sent the request
   * @returns {Promise} - Promise that resolves when notification is sent
   */
  async sendFriendRequestAcceptedNotification(userId, friendId) {
    try {
      // Get user info
      const [userResult] = await db.execute(
        'SELECT id, username, full_name, avatar FROM users WHERE id = ?',
        [userId]
      );

      if (userResult.length === 0) {
        console.error('User not found:', userId);
        return null;
      }

      const user = userResult[0];

      // Get friend's FCM token
      const [tokenResult] = await db.execute(
        'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
        [friendId]
      );

      if (tokenResult.length === 0) {
        console.log('No FCM token found for user:', friendId);
        return null;
      }

      // Check if token is valid
      const token = tokenResult[0].fcm_token;
      if (!token || token.trim() === '') {
        console.log('Empty FCM token found for user:', friendId);
        return null;
      }

      // Send notification
      const notification = {
        title: 'Friend Request Accepted',
        body: `${user.full_name || user.username} accepted your friend request`
      };

      const data = {
        type: 'friendRequestAccepted',
        userId: user.id.toString(),
        username: user.username,
        fullName: user.full_name,
        avatar: user.avatar,
        createdAt: new Date().toISOString()
      };

      return await firebase.sendFCMMessage(token, notification, data);
    } catch (error) {
      console.error('Error sending friend request accepted notification:', error);
      return null;
    }
  }

  /**
   * Send a group message notification
   * @param {number} senderId - ID of the sender
   * @param {number} groupId - ID of the group
   * @param {string} message - Message content
   * @returns {Promise} - Promise that resolves when notifications are sent
   */
  async sendGroupMessageNotification(senderId, groupId, message) {
    try {
      console.log(`Sending group notification from ${senderId} to group ${groupId}: ${message.substring(0, 30)}...`);

      // Get sender info
      const [senderResult] = await db.execute(
        'SELECT id, username, full_name, avatar FROM users WHERE id = ?',
        [senderId]
      );

      if (senderResult.length === 0) {
        console.error('Sender not found:', senderId);
        return null;
      }

      const sender = senderResult[0];

      // Get group info
      const [groupResult] = await db.execute(
        'SELECT id, name, avatar FROM chat_groups WHERE id = ?',
        [groupId]
      );

      if (groupResult.length === 0) {
        console.error('Group not found:', groupId);
        return null;
      }

      const group = groupResult[0];

      // Get all group members except the sender
      const [members] = await db.execute(
        'SELECT user_id FROM chat_group_members WHERE group_id = ? AND user_id != ?',
        [groupId, senderId]
      );

      if (members.length === 0) {
        console.log('No other members in group:', groupId);
        return null;
      }

      // Get FCM tokens for all members
      const memberIds = members.map(member => member.user_id);
      const placeholders = memberIds.map(() => '?').join(',');

      const [tokenResults] = await db.execute(
        `SELECT user_id, fcm_token FROM user_fcm_tokens
         WHERE user_id IN (${placeholders}) AND fcm_token IS NOT NULL`,
        memberIds
      );

      if (tokenResults.length === 0) {
        console.log('No FCM tokens found for group members');
        return null;
      }

      // Get the actual message ID from the database
      const [messageResult] = await db.execute(
        'SELECT id FROM chat_group_messages WHERE sender_id = ? AND group_id = ? ORDER BY created_at DESC LIMIT 1',
        [senderId, groupId]
      );

      // Log the message ID for debugging
      console.log(`Retrieved message ID for group message: ${messageResult.length > 0 ? messageResult[0].id : 'none found'}`);

      const messageId = messageResult.length > 0 ? messageResult[0].id : Date.now().toString();

      // Prepare notification
      const notification = {
        title: `${group.name}`,
        body: `${sender.full_name || sender.username}: ${message.length > 50 ? message.substring(0, 47) + '...' : message}`
      };

      const data = {
        type: 'newGroupMessage',
        messageId: messageId.toString(),
        senderId: sender.id.toString(),
        senderUsername: sender.username || '',
        senderFullName: sender.full_name || '',
        senderAvatar: sender.avatar || '',
        groupId: group.id.toString(),
        groupName: group.name || '',
        groupAvatar: group.avatar || '',
        message: message,
        createdAt: new Date().toISOString()
      };

      // Filter out invalid tokens
      const validTokens = tokenResults
        .map(token => token.fcm_token)
        .filter(token => token && token.trim() !== '');

      if (validTokens.length === 0) {
        console.log('No valid FCM tokens found for group members');
        return null;
      }

      // Log detailed information for debugging
      console.log(`Sending group message notification to ${validTokens.length} members of group ${groupId}`);
      console.log('Group name:', group.name);
      console.log('Sender:', sender.full_name || sender.username);
      console.log('Message preview:', message.substring(0, 30) + (message.length > 30 ? '...' : ''));
      console.log('Notification data:', JSON.stringify(data));

      // Try sending to each member individually for better reliability
      const results = [];
      let successCount = 0;

      for (const token of validTokens) {
        try {
          console.log(`Sending notification to token: ${token.substring(0, 10)}...`);
          const result = await firebase.sendFCMMessage(token, notification, data);
          if (result) {
            successCount++;
            results.push(result);
          }
        } catch (error) {
          console.error(`Error sending notification to token ${token.substring(0, 10)}...`, error.message);
        }
      }

      console.log(`Successfully sent ${successCount} out of ${validTokens.length} group notifications`);

      return results.length > 0 ? results : null;
    } catch (error) {
      console.error('Error sending group message notification:', error);
      return null;
    }
  }

  /**
   * Send a booking status update notification
   * @param {number} bookingId - ID of the booking
   * @param {string} status - New status of the booking (confirmed, cancelled)
   * @returns {Promise} - Promise that resolves when notification is sent
   */
  async sendBookingStatusNotification(bookingId, status) {
    try {
      console.log(`Sending booking status notification for booking ${bookingId} with status ${status}`);

      // Get booking details with venue and user information
      const [bookingResult] = await db.execute(
        `SELECT b.*, v.name as venue_name, v.image as venue_image, u.id as user_id
         FROM venue_bookings b
         JOIN venues v ON b.venue_id = v.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = ?`,
        [bookingId]
      );

      if (bookingResult.length === 0) {
        console.error('Booking not found:', bookingId);
        return null;
      }

      const booking = bookingResult[0];
      const userId = booking.user_id;
      const venueName = booking.venue_name || 'the venue';

      // Get user's FCM token
      const [tokenResult] = await db.execute(
        'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
        [userId]
      );

      if (tokenResult.length === 0) {
        console.log('No FCM token found for user:', userId);
        return null;
      }

      // Check if token is valid
      const token = tokenResult[0].fcm_token;
      if (!token || token.trim() === '') {
        console.log('Empty FCM token found for user:', userId);
        return null;
      }

      // Create appropriate message based on status
      let title = 'Booking Update';
      let body = '';

      if (status === 'confirmed') {
        body = `Your booking for ${venueName} has been confirmed`;
      } else if (status === 'cancelled') {
        body = `Your booking for ${venueName} has been cancelled`;
      } else {
        body = `Your booking for ${venueName} has been updated`;
      }

      // Prepare notification
      const notification = {
        title,
        body
      };

      // Format booking date and time for display
      const bookingDate = booking.booking_date ? new Date(booking.booking_date).toISOString().split('T')[0] : '';
      const bookingTime = booking.booking_time || '';

      const data = {
        type: 'reservation',
        bookingId: booking.id.toString(),
        venueId: booking.venue_id.toString(),
        venueName: venueName,
        venueImage: booking.venue_image || '',
        status: status,
        date: bookingDate,
        time: bookingTime,
        guestCount: booking.guest_count ? booking.guest_count.toString() : '1',
        createdAt: new Date().toISOString()
      };

      console.log('Sending FCM booking notification with data:', JSON.stringify(data));
      return await firebase.sendFCMMessage(token, notification, data);
    } catch (error) {
      console.error('Error sending booking status notification:', error);
      return null;
    }
  }

  /**
   * Send notification about a new event to all users
   * @param {number} eventId - ID of the newly created event
   * @returns {Promise} - Promise that resolves when notifications are sent
   */
  async sendNewEventNotification(eventId) {
    try {
      console.log(`Sending new event notification for event ${eventId}`);

      // Get event details
      const [eventResult] = await db.execute(
        `SELECT e.*, v.name as venue_name, v.location as venue_location
         FROM events e
         LEFT JOIN venues v ON e.venue_id = v.id
         WHERE e.id = ?`,
        [eventId]
      );

      if (eventResult.length === 0) {
        console.error('Event not found:', eventId);
        return null;
      }

      const event = eventResult[0];

      // Format event name and location for the notification
      const eventName = event.name || 'New Event';
      const eventLocation = event.venue || event.custom_location || event.venue_location || 'Unknown location';

      // Get FCM tokens for all active users
      const [tokenResults] = await db.execute(
        'SELECT user_id, fcm_token FROM user_fcm_tokens WHERE fcm_token IS NOT NULL AND fcm_token != ""'
      );

      if (tokenResults.length === 0) {
        console.log('No valid FCM tokens found for users');
        return null;
      }

      // Prepare notification
      const notification = {
        title: 'New Event',
        body: `${eventName} has been added at ${eventLocation}`
      };

      // Format event date and time for display
      const eventDate = event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '';
      const startingTime = event.starting_time || '';

      const data = {
        type: 'event',
        eventId: event.id.toString(),
        name: eventName,
        description: event.description || '',
        venue: event.venue || '',
        venueId: event.venue_id ? event.venue_id.toString() : '',
        eventDate: eventDate,
        startingTime: startingTime,
        price: event.price || '',
        image: event.image || '',
        images: event.images || '',
        latitude: event.latitude ? event.latitude.toString() : '',
        longitude: event.longitude ? event.longitude.toString() : '',
        createdAt: new Date().toISOString()
      };

      // Filter out invalid tokens
      const validTokens = tokenResults
        .map(token => token.fcm_token)
        .filter(token => token && token.trim() !== '');

      if (validTokens.length === 0) {
        console.log('No valid FCM tokens found');
        return null;
      }

      console.log(`Sending FCM event notification for "${eventName}" to ${validTokens.length} devices`);

      // For safety, limit the number of tokens in development/testing
      // Remove this limitation in production
      const maxTokens = 50; // Adjust based on your needs
      const limitedTokens = validTokens.slice(0, maxTokens);

      if (validTokens.length > maxTokens) {
        console.log(`Limiting notification to ${maxTokens} tokens for safety (out of ${validTokens.length} total)`);
      }

      // Send notifications to users with valid FCM tokens
      try {
        const result = await firebase.sendFCMMessageToMultipleDevices(limitedTokens, notification, data);
        if (result) {
          console.log(`Successfully sent event notification for event ${eventId}`);
          return result;
        } else {
          console.log(`No response from FCM for event ${eventId}`);
          return null;
        }
      } catch (fcmError) {
        console.error(`FCM error for event ${eventId}:`, fcmError);

        // Try sending to a single test device as fallback
        if (limitedTokens.length > 0) {
          try {
            console.log('Attempting to send to a single device as fallback');
            const singleResult = await firebase.sendFCMMessage(limitedTokens[0], notification, data);
            return singleResult ? [singleResult] : null;
          } catch (singleError) {
            console.error('Single device fallback also failed:', singleError);
            return null;
          }
        }
        return null;
      }
    } catch (error) {
      console.error('Error sending new event notification:', error);
      return null;
    }
  }

  /**
   * Send notification about a new venue to all users
   * @param {number} venueId - ID of the newly created venue
   * @returns {Promise} - Promise that resolves when notifications are sent
   */
  async sendNewVenueNotification(venueId) {
    try {
      console.log(`Sending new venue notification for venue ${venueId}`);

      // Get venue details
      const [venueResult] = await db.execute(
        'SELECT * FROM venues WHERE id = ?',
        [venueId]
      );

      if (venueResult.length === 0) {
        console.error('Venue not found:', venueId);
        return null;
      }

      const venue = venueResult[0];

      // Format venue name and location for the notification
      const venueName = venue.name || 'New Venue';
      const venueLocation = venue.location || 'Unknown location';
      const venueType = venue.type || '';

      // Get FCM tokens for all active users
      const [tokenResults] = await db.execute(
        'SELECT user_id, fcm_token FROM user_fcm_tokens WHERE fcm_token IS NOT NULL AND fcm_token != ""'
      );

      if (tokenResults.length === 0) {
        console.log('No valid FCM tokens found for users');
        return null;
      }

      // Prepare notification
      const notification = {
        title: 'New Venue',
        body: `${venueName} (${venueType}) has been added at ${venueLocation}`
      };

      const data = {
        type: 'venue',
        venueId: venue.id.toString(),
        name: venueName,
        description: venue.description || '',
        location: venueLocation,
        type: venueType,
        premium: venue.premium ? '1' : '0',
        image: venue.image || '',
        images: venue.images || '',
        features: venue.features || '',
        openingHours: venue.opening_hours || '',
        latitude: venue.latitude ? venue.latitude.toString() : '',
        longitude: venue.longitude ? venue.longitude.toString() : '',
        createdAt: new Date().toISOString()
      };

      // Filter out invalid tokens
      const validTokens = tokenResults
        .map(token => token.fcm_token)
        .filter(token => token && token.trim() !== '');

      if (validTokens.length === 0) {
        console.log('No valid FCM tokens found');
        return null;
      }

      console.log(`Sending FCM venue notification for "${venueName}" to ${validTokens.length} devices`);

      // For safety, limit the number of tokens in development/testing
      // Remove this limitation in production
      const maxTokens = 50; // Adjust based on your needs
      const limitedTokens = validTokens.slice(0, maxTokens);

      if (validTokens.length > maxTokens) {
        console.log(`Limiting notification to ${maxTokens} tokens for safety (out of ${validTokens.length} total)`);
      }

      // Send notifications to users with valid FCM tokens
      try {
        const result = await firebase.sendFCMMessageToMultipleDevices(limitedTokens, notification, data);
        if (result) {
          console.log(`Successfully sent venue notification for venue ${venueId}`);
          return result;
        } else {
          console.log(`No response from FCM for venue ${venueId}`);
          return null;
        }
      } catch (fcmError) {
        console.error(`FCM error for venue ${venueId}:`, fcmError);

        // Try sending to a single test device as fallback
        if (limitedTokens.length > 0) {
          try {
            console.log('Attempting to send to a single device as fallback');
            const singleResult = await firebase.sendFCMMessage(limitedTokens[0], notification, data);
            return singleResult ? [singleResult] : null;
          } catch (singleError) {
            console.error('Single device fallback also failed:', singleError);
            return null;
          }
        }
        return null;
      }
    } catch (error) {
      console.error('Error sending new venue notification:', error);
      return null;
    }
  }

  /**
   * Send notification about a new booking to the venue owner
   * @param {number} bookingId - ID of the newly created booking
   * @returns {Promise} - Promise that resolves when notification is sent
   */
  async sendNewBookingNotification(bookingId) {
    try {
      console.log(`Sending new booking notification for booking ${bookingId}`);

      // Get booking details with venue, venue owner, and user information
      const [bookingResult] = await db.execute(
        `SELECT b.*, v.name as venue_name, v.user_id as venue_owner_id,
                u.id as user_id, u.username as user_username, u.full_name as user_full_name
         FROM venue_bookings b
         JOIN venues v ON b.venue_id = v.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = ?`,
        [bookingId]
      );

      if (bookingResult.length === 0) {
        console.error('Booking not found:', bookingId);
        return null;
      }

      const booking = bookingResult[0];
      const venueOwnerId = booking.venue_owner_id;
      const venueName = booking.venue_name || 'your venue';
      const userName = booking.user_full_name || booking.user_username || 'Someone';

      // If there's no venue owner ID, we can't send a notification
      if (!venueOwnerId) {
        console.log('No venue owner found for venue:', booking.venue_id);
        return null;
      }

      // Get venue owner's FCM token
      const [tokenResult] = await db.execute(
        'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
        [venueOwnerId]
      );

      if (tokenResult.length === 0) {
        console.log('No FCM token found for venue owner:', venueOwnerId);
        return null;
      }

      // Check if token is valid
      const token = tokenResult[0].fcm_token;
      if (!token || token.trim() === '') {
        console.log('Empty FCM token found for venue owner:', venueOwnerId);
        return null;
      }

      // Format booking date and time for display
      const bookingDate = booking.booking_date ? new Date(booking.booking_date).toISOString().split('T')[0] : '';
      const bookingTime = booking.booking_time || '';
      const formattedDate = bookingDate + (bookingTime ? ` at ${bookingTime}` : '');

      // Prepare notification
      const notification = {
        title: 'New Booking',
        body: `${userName} made a booking at ${venueName} for ${formattedDate}`
      };

      const data = {
        type: 'newBooking',
        bookingId: booking.id.toString(),
        venueId: booking.venue_id.toString(),
        venueName: venueName,
        userId: booking.user_id.toString(),
        userName: userName,
        bookingDate: bookingDate,
        bookingTime: bookingTime,
        guestCount: booking.guest_count ? booking.guest_count.toString() : '1',
        note: booking.note || '',
        status: booking.status || 'pending',
        createdAt: new Date().toISOString()
      };

      console.log('Sending FCM new booking notification with data:', JSON.stringify(data));
      return await firebase.sendFCMMessage(token, notification, data);
    } catch (error) {
      console.error('Error sending new booking notification:', error);
      return null;
    }
  }

  /**
   * Send notification to a user when they are added to a group
   * @param {number} groupId - ID of the group
   * @param {number} userId - ID of the user who was added
   * @param {number} addedByUserId - ID of the user who added them (optional)
   * @returns {Promise} - Promise that resolves when notification is sent
   */
  async sendAddedToGroupNotification(groupId, userId, addedByUserId = null) {
    try {
      console.log(`Sending 'added to group' notification to user ${userId} for group ${groupId}`);

      // Get group details
      const [groupResult] = await db.execute(
        'SELECT id, name, avatar, description FROM chat_groups WHERE id = ?',
        [groupId]
      );

      if (groupResult.length === 0) {
        console.error('Group not found:', groupId);
        return null;
      }

      const group = groupResult[0];

      // Get user's FCM token
      const [tokenResult] = await db.execute(
        'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ? AND fcm_token IS NOT NULL',
        [userId]
      );

      if (tokenResult.length === 0) {
        console.log('No FCM token found for user:', userId);
        return null;
      }

      // Check if token is valid
      const token = tokenResult[0].fcm_token;
      if (!token || token.trim() === '') {
        console.log('Empty FCM token found for user:', userId);
        return null;
      }

      // Get information about who added the user (if provided)
      let addedByText = 'You were';
      let addedByName = 'Someone';
      if (addedByUserId) {
        const [adderResult] = await db.execute(
          'SELECT id, username, full_name FROM users WHERE id = ?',
          [addedByUserId]
        );

        if (adderResult.length > 0) {
          addedByName = adderResult[0].full_name || adderResult[0].username || 'Someone';
          addedByText = `${addedByName} added you`;
        }
      }

      // Prepare notification
      const notification = {
        title: 'Added to Group',
        body: `${addedByText} to the group "${group.name}"`
      };

      const data = {
        type: 'addedToGroup',
        groupId: group.id.toString(),
        groupName: group.name,
        groupAvatar: group.avatar || '',
        groupDescription: group.description || '',
        addedByUserId: addedByUserId ? addedByUserId.toString() : null,
        addedByName: addedByName,
        createdAt: new Date().toISOString()
      };

      // Log detailed information for debugging
      console.log(`Sending 'added to group' notification to user ${userId} for group ${groupId}`);
      console.log('Group name:', group.name);
      console.log('Added by:', addedByUserId ? 'User ID ' + addedByUserId : 'Unknown');
      console.log('Notification data:', JSON.stringify(data));

      try {
        console.log(`Sending notification to token: ${token.substring(0, 10)}...`);
        const result = await firebase.sendFCMMessage(token, notification, data);
        console.log('FCM response:', result ? 'Success' : 'Failed');
        return result;
      } catch (error) {
        console.error(`Error sending 'added to group' notification to user ${userId}:`, error.message);
        return null;
      }
    } catch (error) {
      console.error('Error sending added to group notification:', error);
      return null;
    }
  }
}

module.exports = new NotificationService();
