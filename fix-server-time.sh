#!/bin/bash

# Script to fix server time synchronization issues
# This script should be run on the Hetzner server

echo "=== Server Time Synchronization Fix ==="
echo "This script will help fix time synchronization issues with your server."
echo "Current server time: $(date)"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

# Install NTP if not already installed
echo "Installing NTP..."
apt-get update
apt-get install -y ntp ntpdate

# Stop NTP service
echo "Stopping NTP service..."
systemctl stop ntp

# Force time synchronization
echo "Synchronizing time with NTP servers..."
ntpdate pool.ntp.org

# Start NTP service
echo "Starting NTP service..."
systemctl start ntp
systemctl enable ntp

# Show new time
echo ""
echo "Time synchronization complete."
echo "New server time: $(date)"
echo ""

# Restart PM2 if it exists
if command -v pm2 &> /dev/null; then
    echo "Restarting PM2 services..."
    pm2 restart all
    echo "PM2 services restarted."
else
    echo "PM2 not found. If you're using PM2 to manage your Node.js applications,"
    echo "please install it and restart your applications manually."
fi

echo ""
echo "=== Time Synchronization Complete ==="
echo "If you're still experiencing Firebase authentication issues,"
echo "you may need to generate a new service account key from the Firebase console."
echo "Visit: https://console.firebase.google.com/project/kajsivaka-d7010/settings/serviceaccounts/adminsdk"
echo ""
