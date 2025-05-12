const dotenv = require("dotenv");
const app = require("./app");
const path = require("path");
const http = require("http");

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "./.env") });

const PORT = process.env.PORT || 5000;

// Get the local IP address for easier access from mobile devices
const { networkInterfaces } = require('os');
const nets = networkInterfaces();

let localIP = '10.0.2.2'; // Default for Android emulator

// Try to find a non-internal IPv4 address
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Skip over non-IPv4 and internal addresses
    if (net.family === 'IPv4' && !net.internal) {
      localIP = net.address;
    }
  }
}

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on:`);
  console.log(`- Local:            http://localhost:${PORT}`);
  console.log(`- On Your Network:  http://${localIP}:${PORT}`);
  console.log(`- Android Emulator: http://10.0.2.2:${PORT}`);
  console.log(`- iOS Simulator:    http://localhost:${PORT}`);

  // FCM is used for real-time messaging instead of WebSockets
  console.log(`- Messaging:         Firebase Cloud Messaging (FCM)`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

