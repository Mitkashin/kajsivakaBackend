/**
 * Script to run all migrations
 */
const createGroupChatTables = require('./migrations/create_group_chat_tables');

async function runMigrations() {
  try {
    console.log('Running migrations...');
    
    // Run group chat tables migration
    console.log('Creating group chat tables...');
    const groupChatResult = await createGroupChatTables();
    console.log('Group chat tables migration result:', groupChatResult);
    
    console.log('All migrations completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Run migrations
runMigrations()
  .then(result => {
    console.log('Migration script completed with result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
