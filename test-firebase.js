/**
 * Test script for Firebase Cloud Messaging
 * 
 * This script tests the Firebase configuration by sending a test notification
 * to verify that the Firebase Admin SDK is properly configured.
 * 
 * Usage: node test-firebase.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Path to service account key file
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(__dirname, './firebase-service-account.json');

console.log('Testing Firebase configuration...');
console.log('Service account path:', serviceAccountPath);

// Check if service account file exists
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Firebase service account file not found at:', serviceAccountPath);
  process.exit(1);
}

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

// Test sending a message to a topic
async function testTopicMessage() {
  try {
    console.log('Sending test message to "test" topic...');
    
    const message = {
      topic: 'test',
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from the server'
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };
    
    const response = await admin.messaging().send(message);
    console.log('Test message sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending test message:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.message && error.message.includes('The project id used to initialize the app')) {
      console.error('\nPossible issue: The service account file may be for a different Firebase project than the one you\'re trying to use.');
    }
    
    if (error.message && error.message.includes('Permission denied')) {
      console.error('\nPossible issue: The service account may not have the required permissions to send FCM messages.');
      console.error('Make sure the service account has the "Firebase Cloud Messaging Admin" role.');
    }
    
    return false;
  }
}

// Run the test
testTopicMessage()
  .then(success => {
    if (success) {
      console.log('\nFirebase configuration test passed!');
      console.log('Your Firebase Admin SDK is properly configured and can send messages.');
    } else {
      console.log('\nFirebase configuration test failed!');
      console.log('Please check the error messages above for more information.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error during test:', error);
    process.exit(1);
  });
