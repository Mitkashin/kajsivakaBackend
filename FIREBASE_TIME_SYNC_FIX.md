# Firebase Time Synchronization Fix

This guide will help you fix the Firebase authentication error: `Error fetching access token: invalid_grant (Invalid JWT Signature.)`.

## Problem

Your server is experiencing one of these issues:

1. **Server time is incorrect** - Your server time is set to the future (May 13, 2025), causing Firebase JWT authentication to fail
2. **Firebase service account key is revoked** - Your service account key may have been revoked or is invalid

## Solution 1: Fix Server Time on Hetzner

1. Connect to your Hetzner server via SSH:
   ```bash
   ssh root@159.69.222.79
   ```

2. Upload the `fix-server-time.sh` script to your server:
   ```bash
   scp backend/fix-server-time.sh root@159.69.222.79:/root/
   ```

3. Make the script executable and run it:
   ```bash
   chmod +x /root/fix-server-time.sh
   ./root/fix-server-time.sh
   ```

4. Verify the time is correct:
   ```bash
   date
   ```

5. Restart your Node.js application:
   ```bash
   # If using PM2
   pm2 restart all
   
   # If using systemd
   systemctl restart kajsivaka-backend
   
   # If running directly with Node
   cd /path/to/your/app
   node server.js
   ```

## Solution 2: Generate a New Firebase Service Account Key

If fixing the server time doesn't resolve the issue, you'll need to generate a new service account key:

1. Go to the Firebase Console: https://console.firebase.google.com/project/kajsivaka-d7010/settings/serviceaccounts/adminsdk

2. Click on "Generate new private key"

3. Download the new key file

4. Upload the new key file to your server:
   ```bash
   scp your-new-key-file.json root@159.69.222.79:/root/kajsivakaBackend/firebase-service-account.json
   ```

5. Restart your Node.js application

## Verifying the Fix

After applying either solution, you should see the following in your server logs:

```
Firebase Admin SDK initialized with service account file
Firebase connection test successful
```

If you're still experiencing issues, please check:

1. The Firebase project settings
2. The service account permissions
3. The server's network connectivity to Google services

## Preventing Future Issues

To prevent time synchronization issues in the future:

1. Set up automatic time synchronization on your server
2. Configure monitoring to alert you if the server time drifts significantly
3. Consider implementing more robust error handling in your application

For more information, see the Firebase Admin SDK documentation: https://firebase.google.com/docs/admin/setup
