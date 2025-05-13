const dotenv = require("dotenv");
const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Database configuration
let dbConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaj_si_vaka',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// If socket path is provided, use it instead of host/port
if (process.env.DB_SOCKET_PATH) {
  console.log(`Using socket connection: ${process.env.DB_SOCKET_PATH}`);
  dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else {
  console.log(`Using TCP connection: ${process.env.DB_HOST}`);
  dbConfig.host = process.env.DB_HOST || '127.0.0.1';
}

// Database connection details initialized

// Function to check if database exists, create it if it doesn't
const checkAndCreateDatabase = async () => {
  try {
    // Create a connection without specifying a database
    const tempPool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0,
    }).promise();

    // Check if database exists
    const [rows] = await tempPool.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbConfig.database]
    );

    // If database doesn't exist, create it
    if (rows.length === 0) {
      // Database not found, creating it
      await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      // Database created successfully

      // Create tables
      await tempPool.query(`USE \`${dbConfig.database}\``);

      // Read and execute the SQL setup file
      const sqlPath = path.resolve(__dirname, "../database_setup.sql");
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');

        for (const statement of statements) {
          await tempPool.query(statement);
        }
        // Database tables and sample data created successfully
      } else {
        // SQL setup file not found, creating basic tables

        // Create venues table
        await tempPool.query(`
          CREATE TABLE IF NOT EXISTS venues (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(100),
            location VARCHAR(255),
            description TEXT,
            rating DECIMAL(3,1),
            price_range VARCHAR(10),
            features TEXT,
            opening_hours VARCHAR(255),
            image VARCHAR(255),
            images TEXT,
            premium BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);

        // Create events table
        await tempPool.query(`
          CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            venue VARCHAR(255) NOT NULL,
            event_date DATE NOT NULL,
            description TEXT,
            image VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);

        // Basic tables created successfully
      }
    } else {
      // Database already exists
    }

    // Close the temporary connection
    await tempPool.end();

  } catch (error) {
    console.error("Error checking/creating database:", error.message);
    throw error;
  }
};

// Create connection pool
const createPool = () => {
  return mysql.createPool(dbConfig);
};

// Initialize database and create pool
let pool;
try {
  // Check and create database if needed
  checkAndCreateDatabase()
    .then(() => {
      // Database check completed, connection pool created
    })
    .catch(err => {
      console.error("Failed to initialize database:", err.message);
    });

  // Create the pool regardless of the database check
  // If there's an issue, it will be caught when queries are executed
  pool = createPool();
} catch (error) {
  console.error("Error creating connection pool:", error.message);
  // Create a dummy pool that will throw errors when used
  pool = {
    promise: () => ({
      execute: () => Promise.reject(new Error("Database connection failed")),
      query: () => Promise.reject(new Error("Database connection failed")),
    }),
  };
}

module.exports = pool.promise();
