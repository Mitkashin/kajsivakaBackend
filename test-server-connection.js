/**
 * Server Connection Test Script
 * 
 * This script tests if the server is reachable and if the MySQL port is open.
 */

const net = require('net');
const dns = require('dns');
const dotenv = require('dotenv');
const path = require('path');
const { exec } = require('child_process');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Get server details from environment variables
const serverHost = process.env.DB_HOST || 'localhost';
const serverPort = process.env.DB_PORT || 3306;

console.log('Testing server connection:');
console.log(`- Server: ${serverHost}`);
console.log(`- Port: ${serverPort}`);
console.log('\nRunning tests...');

// Function to check if the server is reachable via ping
function pingServer() {
  return new Promise((resolve) => {
    exec(`ping -n 3 ${serverHost}`, (error, stdout, stderr) => {
      if (error) {
        console.log('\n❌ Server ping test failed!');
        console.log('Error:', stderr || 'Server is not responding to ping');
        resolve(false);
      } else {
        console.log('\n✅ Server ping test successful!');
        console.log('Response:', stdout.split('\n').slice(-3, -1).join('\n'));
        resolve(true);
      }
    });
  });
}

// Function to check if the port is open
function checkPort() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;
    
    // Set a timeout of 5 seconds
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log(`\n✅ Port ${serverPort} is open!`);
      status = true;
      socket.destroy();
    });
    
    socket.on('timeout', () => {
      console.log(`\n❌ Connection to port ${serverPort} timed out!`);
      socket.destroy();
    });
    
    socket.on('error', (error) => {
      console.log(`\n❌ Port ${serverPort} is not accessible!`);
      console.log('Error:', error.message);
    });
    
    socket.on('close', () => {
      resolve(status);
    });
    
    socket.connect(serverPort, serverHost);
  });
}

// Function to resolve DNS
function resolveDns() {
  return new Promise((resolve) => {
    dns.lookup(serverHost, (error, address) => {
      if (error) {
        console.log('\n❌ DNS resolution failed!');
        console.log('Error:', error.message);
        resolve(false);
      } else {
        console.log('\n✅ DNS resolution successful!');
        console.log(`Resolved IP: ${address}`);
        resolve(true);
      }
    });
  });
}

// Run all tests
async function runTests() {
  // Only run DNS resolution if the host is not an IP address
  if (/^[0-9.]+$/.test(serverHost)) {
    console.log('\nSkipping DNS resolution as the host is an IP address');
  } else {
    await resolveDns();
  }
  
  await pingServer();
  const portStatus = await checkPort();
  
  console.log('\n=== Summary ===');
  if (portStatus) {
    console.log('The server is reachable and MySQL port is open.');
    console.log('If you still cannot connect to the database, check:');
    console.log('1. MySQL user credentials');
    console.log('2. MySQL user permissions');
    console.log('3. MySQL server configuration (bind-address, skip-networking)');
  } else {
    console.log('The MySQL port is not accessible. Possible reasons:');
    console.log('1. MySQL is not running on the server');
    console.log('2. MySQL is not configured to accept remote connections');
    console.log('3. A firewall is blocking the connection');
    console.log('\nSuggested actions:');
    console.log('1. Verify MySQL is running on the server');
    console.log('2. Check MySQL configuration (my.cnf) to ensure it accepts remote connections');
    console.log('3. Check firewall rules to allow connections to port 3306');
    console.log('4. If using a cloud provider, check security group settings');
  }
}

runTests();
