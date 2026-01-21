import { query } from './index';

const migration = `
ALTER TABLE settings ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'it'));
`;

async function runMigration() {
  try {
    console.log('Running migration to add language column to settings table...');
    await query(migration, []);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
