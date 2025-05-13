/**
 * Kaj Si Vaka API Server
 *
 * This is the main server file that initializes the Express application,
 * sets up database connections, and starts the HTTP server.
 */

const dotenv = require("dotenv");
const app = require("./app");
const path = require("path");
const http = require("http");
const mysql = require("mysql2/promise");
const fs = require("fs");

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "./.env") });

// Server configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaj_si_vaka',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000 // 10 seconds
};

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

/**
 * Test database connection before starting the server
 * This helps identify database connection issues early
 */
async function testDatabaseConnection() {
  console.log("Testing database connection...");
  console.log(`- Host: ${dbConfig.host}`);
  console.log(`- User: ${dbConfig.user}`);
  console.log(`- Database: ${dbConfig.database}`);

  try {
    // Try to connect without specifying a database first
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 10000
    });

    console.log("✅ Successfully connected to MySQL server!");

    // Check if the database exists
    const [rows] = await tempConnection.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbConfig.database]
    );

    if (rows.length === 0) {
      console.log(`⚠️ Database '${dbConfig.database}' does not exist on the server.`);
      console.log("Creating database...");

      await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      console.log(`✅ Database '${dbConfig.database}' created successfully!`);

      // Create tables if needed
      await tempConnection.query(`USE \`${dbConfig.database}\``);

      // Check if we have a database setup file
      const sqlPath = path.resolve(__dirname, "./database_setup.sql");
      if (fs.existsSync(sqlPath)) {
        console.log("Found database setup file. Creating tables...");
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');

        for (const statement of statements) {
          if (statement.trim()) {
            await tempConnection.query(statement);
          }
        }
        console.log("✅ Database tables created successfully!");
      } else {
        console.log("No database setup file found. Basic tables will be created as needed.");
      }
    } else {
      console.log(`✅ Database '${dbConfig.database}' exists!`);
    }

    // Close the temporary connection
    await tempConnection.end();
    return true;

  } catch (error) {
    console.error("❌ Database connection failed!");
    console.error(`Error: ${error.message}`);

    if (error.message.includes('Access denied')) {
      console.log("\nPossible solutions:");
      console.log("1. Check if the username and password are correct");
      console.log("2. Ensure the user has proper permissions");
    }

    if (error.message.includes('connect ETIMEDOUT') || error.message.includes('connect ECONNREFUSED')) {
      console.log("\nPossible solutions:");
      console.log("1. Check if the MySQL server is running on the specified host");
      console.log("2. Ensure the server allows remote connections (bind-address in my.cnf)");
      console.log("3. Check if any firewall is blocking the connection");
      console.log("4. If using a cloud provider, check security group settings");
    }

    return false;
  }
}

/**
 * Start the HTTP server
 */
function startServer() {
  // Create HTTP server
  const server = http.createServer(app);

  // Start the server
  server.listen(PORT, () => {
    console.log(`\n🚀 Server is running in ${NODE_ENV} mode on:`);
    console.log(`- Local:            http://localhost:${PORT}`);
    console.log(`- On Your Network:  http://${localIP}:${PORT}`);
    console.log(`- Android Emulator: http://10.0.2.2:${PORT}`);
    console.log(`- iOS Simulator:    http://localhost:${PORT}`);
    console.log(`- Messaging:        Firebase Cloud Messaging (FCM)`);

    if (dbConfig.host === 'localhost') {
      console.log("\n⚠️ You are using a local database. If you're migrating to a remote server,");
      console.log("   update the DB_HOST in your .env file to point to your server's IP address.");
    } else {
      console.log(`\n📊 Connected to remote database at: ${dbConfig.host}`);
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });
}

// Initialize the application
async function initialize() {
  try {
    // Test database connection first
    const dbConnected = await testDatabaseConnection();

    if (dbConnected) {
      console.log("\n✅ Database connection successful! Starting server...");
      startServer();
    } else {
      console.log("\n⚠️ Starting server despite database connection issues...");
      console.log("The application may not function correctly until database issues are resolved.");
      startServer();
    }
  } catch (error) {
    console.error("❌ Failed to initialize the application:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Exit with error
  process.exit(1);
});

// Start the application
initialize();

