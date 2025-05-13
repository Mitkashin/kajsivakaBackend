/**
 * Simple MySQL connection test script
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, './.env') });

async function testConnection() {
  console.log('Testing MySQL connection with the following settings:');
  console.log('- Host:', process.env.DB_HOST);
  console.log('- User:', process.env.DB_USER);
  console.log('- Database:', process.env.DB_NAME);
  
  try {
    // Try connecting with IPv4 explicitly
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('\n✅ Successfully connected to MySQL!');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 + 1 AS result');
    console.log('Query result:', rows[0].result);
    
    await connection.end();
    console.log('Connection closed.');
    
    return true;
  } catch (error) {
    console.error('\n❌ Failed to connect to MySQL:', error.message);
    
    // Try with socket path if IPv4 fails
    console.log('\nTrying with socket path...');
    try {
      const socketPath = '/var/run/mysqld/mysqld.sock';
      console.log('Using socket path:', socketPath);
      
      const connection = await mysql.createConnection({
        socketPath,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
      
      console.log('\n✅ Successfully connected to MySQL using socket!');
      
      // Test a simple query
      const [rows] = await connection.execute('SELECT 1 + 1 AS result');
      console.log('Query result:', rows[0].result);
      
      await connection.end();
      console.log('Connection closed.');
      
      console.log('\nRecommendation: Update your .env file to include:');
      console.log('DB_SOCKET_PATH=/var/run/mysqld/mysqld.sock');
      
      return true;
    } catch (socketError) {
      console.error('\n❌ Failed to connect using socket path:', socketError.message);
      
      console.log('\nTroubleshooting steps:');
      console.log('1. Check if MySQL is installed and running:');
      console.log('   sudo systemctl status mysql');
      console.log('2. Check MySQL configuration:');
      console.log('   sudo cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address');
      console.log('3. Check if MySQL socket exists:');
      console.log('   ls -la /var/run/mysqld/');
      console.log('4. Check MySQL user permissions:');
      console.log(`   sudo mysql -e "SELECT user, host FROM mysql.user WHERE user='${process.env.DB_USER}'"`);
      
      return false;
    }
  }
}

// Run the test
testConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
