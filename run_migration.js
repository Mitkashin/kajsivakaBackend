/**
 * Run database migration script
 *
 * This script will run the SQL migration to add the images column to the venues table
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');

async function runMigration() {
  console.log('Starting database migration...');

  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      multipleStatements: true // Enable multiple statements for batch operations
    });

    console.log('Connected to database');

    // Read migration SQL files
    const venuesMigrationFile = path.join(__dirname, 'sql', 'add_images_column.sql');
    const eventsMigrationFile = path.join(__dirname, 'sql', 'add_images_column_to_events.sql');

    const venuesSql = fs.readFileSync(venuesMigrationFile, 'utf8');
    const eventsSql = fs.readFileSync(eventsMigrationFile, 'utf8');

    // Execute migrations
    console.log('Executing venues migration...');
    await connection.query(venuesSql);
    console.log('Venues migration completed successfully');

    console.log('Executing events migration...');
    await connection.query(eventsSql);
    console.log('Events migration completed successfully');

  } catch (error) {
    console.error('Error running migration:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
runMigration();
