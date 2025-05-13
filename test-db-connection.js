/**
 * Database Connection Test Script
 *
 * This script tests the connection to the MySQL database using the credentials
 * from the .env file. It will attempt to connect to the database and run a simple query.
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Get database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaj_si_vaka',
  connectTimeout: 10000 // 10 seconds
};

console.log('Testing database connection with the following configuration:');
console.log(`- Host: ${dbConfig.host}`);
console.log(`- Port: ${dbConfig.port}`);
console.log(`- User: ${dbConfig.user}`);
console.log(`- Database: ${dbConfig.database}`);
console.log('- Password: [HIDDEN]');
console.log('\nAttempting to connect...');

async function testConnection() {
  let connection;

  try {
    // First try to connect without specifying a database
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    console.log('\n✅ Successfully connected to MySQL server!');

    // Check if the database exists
    const [rows] = await connection.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbConfig.database]
    );

    if (rows.length === 0) {
      console.log(`\n❌ Database '${dbConfig.database}' does not exist on the server.`);
    } else {
      console.log(`\n✅ Database '${dbConfig.database}' exists!`);

      // Connect to the specific database
      await connection.end();
      connection = await mysql.createConnection(dbConfig);

      // Test a simple query
      const [tables] = await connection.query('SHOW TABLES');

      console.log(`\n✅ Successfully connected to '${dbConfig.database}' database!`);
      console.log('\nDatabase tables:');

      if (tables.length === 0) {
        console.log('- No tables found in the database.');
      } else {
        tables.forEach(table => {
          const tableName = Object.values(table)[0];
          console.log(`- ${tableName}`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error('Error message:', error.message);

    if (error.message.includes('Access denied')) {
      console.log('\nPossible solutions:');
      console.log('1. Check if the username and password are correct');
      console.log('2. Ensure the user has proper permissions');
      console.log('3. Check if the MySQL server is running and accessible from your location');
    }

    if (error.message.includes('connect ECONNREFUSED')) {
      console.log('\nPossible solutions:');
      console.log('1. Check if the MySQL server is running on the specified host');
      console.log('2. Ensure the server allows remote connections');
      console.log('3. Check if any firewall is blocking the connection');
      console.log('4. Verify the port is correct (default is 3306)');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nConnection closed.');
    }
  }
}

testConnection();
