const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Path to service account key file
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, '../firebase-service-account.json');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

try {
  // Check if service account file exists
  if (fs.existsSync(serviceAccountPath)) {
    // Initialize with service account file
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized with service account file');
  } else {
    console.warn('Firebase service account file not found at:', serviceAccountPath);
    console.warn('FCM functionality will not be available');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

/**
 * Send a Firebase Cloud Messaging (FCM) message to a specific device
 * @param {string} token - FCM token of the device
 * @param {object} notification - Notification object with title and body
 * @param {object} data - Data payload to send with the message
 * @returns {Promise} - Promise that resolves with the messaging response
 */
async function sendFCMMessage(token, notification, data) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, cannot send FCM message');
    return null;
  }

  // Check if token is provided
  if (!token) {
    console.warn('No FCM token provided, cannot send FCM message');
    return null;
  }

  try {
    // Convert all data values to strings as required by FCM
    const stringifiedData = {};
    if (data) {
      Object.keys(data).forEach(key => {
        // Convert all values to strings, including null/undefined
        stringifiedData[key] = data[key] != null ? String(data[key]) : '';
      });
    }

    console.log('Sending FCM message with stringified data:', stringifiedData);

    const message = {
      token,
      notification,
      data: stringifiedData,
      android: {
        priority: 'high',
        notification: {
          channelId: getChannelId(data?.type),
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('FCM message sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending FCM message:', error);
    if (error.code === 'messaging/invalid-argument' && error.message.includes('token')) {
      console.error('Invalid FCM token provided:', token);
    } else if (error.code === 'messaging/registration-token-not-registered') {
      console.error('FCM token is no longer valid:', token);
    }
    return null;
  }
}

/**
 * Send a Firebase Cloud Messaging (FCM) message to multiple devices
 * @param {string[]} tokens - Array of FCM tokens
 * @param {object} notification - Notification object with title and body
 * @param {object} data - Data payload to send with the message
 * @returns {Promise} - Promise that resolves with the messaging response
 */
async function sendFCMMessageToMultipleDevices(tokens, notification, data) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, cannot send FCM message');
    return null;
  }

  if (!tokens || tokens.length === 0) {
    console.warn('No tokens provided, cannot send FCM message');
    return null;
  }

  try {
    // Convert all data values to strings as required by FCM
    const stringifiedData = {};
    if (data) {
      Object.keys(data).forEach(key => {
        // Convert all values to strings, including null/undefined
        stringifiedData[key] = data[key] != null ? String(data[key]) : '';
      });
    }

    console.log('Sending FCM multicast message with stringified data:', JSON.stringify(stringifiedData));
    console.log('Number of tokens:', tokens.length);

    // For debugging, log a sample token
    if (tokens.length > 0) {
      console.log('Sample token (first 20 chars):', tokens[0].substring(0, 20));
    }

    // Instead of using multicast, send individual messages to avoid potential issues
    // This is less efficient but more reliable for debugging
    const responses = [];
    let successCount = 0;
    let failureCount = 0;

    // Send to a maximum of 10 devices during testing to avoid overwhelming the server
    const testLimit = Math.min(tokens.length, 10);

    for (let i = 0; i < testLimit; i++) {
      const token = tokens[i];

      try {
        // Create message for a single device
        const message = {
          token,
          notification,
          data: stringifiedData,
          android: {
            priority: 'high',
            notification: {
              channelId: getChannelId(data?.type),
              sound: 'default'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                contentAvailable: true
              }
            }
          }
        };

        // Send message to a single device
        const response = await admin.messaging().send(message);
        console.log(`FCM message sent successfully to token ${i+1}/${testLimit}`);
        responses.push(response);
        successCount++;
      } catch (err) {
        console.error(`Error sending to token ${i+1}/${testLimit}:`, err.message);
        failureCount++;

        // Check for specific error types
        if (err.code === 'messaging/invalid-argument') {
          console.error('Invalid argument error - token may be malformed');
        } else if (err.code === 'messaging/registration-token-not-registered') {
          console.error('Token is no longer valid and should be removed');
        }
      }
    }

    console.log(`Individual FCM messages: ${successCount} successful, ${failureCount} failed`);

    // If all test messages succeeded, try sending to the rest using multicast for efficiency
    if (successCount > 0 && failureCount === 0 && tokens.length > testLimit) {
      console.log(`Sending to remaining ${tokens.length - testLimit} tokens via multicast`);

      try {
        // Split remaining tokens into chunks of 500 (FCM limit)
        const remainingTokens = tokens.slice(testLimit);
        const tokenChunks = [];
        for (let i = 0; i < remainingTokens.length; i += 500) {
          tokenChunks.push(remainingTokens.slice(i, i + 500));
        }

        for (const chunk of tokenChunks) {
          const message = {
            tokens: chunk,
            notification,
            data: stringifiedData,
            android: {
              priority: 'high',
              notification: {
                channelId: getChannelId(data?.type),
                sound: 'default'
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                  contentAvailable: true
                }
              }
            }
          };

          const response = await admin.messaging().sendMulticast(message);
          console.log(`FCM multicast message sent: ${response.successCount} successful, ${response.failureCount} failed`);
          responses.push(response);
        }
      } catch (multicastErr) {
        console.error('Error sending multicast messages to remaining tokens:', multicastErr);
      }
    }

    return responses.length > 0 ? responses : null;
  } catch (error) {
    console.error('Error in sendFCMMessageToMultipleDevices:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);

    // Try to send a test message to verify Firebase connectivity
    try {
      console.log('Attempting to send a test message to verify Firebase connectivity...');
      const testMessage = {
        topic: 'test',
        notification: {
          title: 'Test',
          body: 'Test message'
        }
      };
      await admin.messaging().send(testMessage);
      console.log('Test message sent successfully');
    } catch (testError) {
      console.error('Test message failed:', testError.message);
      console.error('Firebase configuration may be incorrect or service account may be invalid');
    }

    return null;
  }
}

/**
 * Get the appropriate channel ID based on notification type
 * @param {string} type - Notification type
 * @returns {string} - Channel ID
 */
function getChannelId(type) {
  if (!type) return 'kaj-si-vaka-default-channel';

  if (type.includes('message')) {
    return 'kaj-si-vaka-messages-channel';
  } else if (type.includes('event')) {
    return 'kaj-si-vaka-events-channel';
  }

  return 'kaj-si-vaka-default-channel';
}

module.exports = {
  admin,
  firebaseInitialized,
  sendFCMMessage,
  sendFCMMessageToMultipleDevices
};
