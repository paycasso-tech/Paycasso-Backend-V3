const { Client } = require('pg');

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_lD7ZcVXOHPo4@ep-flat-shape-ah92g41r-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Truncate all tables (only those that exist)
    console.log('\n🗑️  Truncating all tables...');

    const tables = ['ratings', 'transactions', 'milestones', 'escrows', 'wallets', 'otp_tokens', 'users'];

    for (const table of tables) {
      try {
        await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
        console.log(`  ✅ Cleared ${table}`);
      } catch (err) {
        console.log(`  ⏭️  Skipped ${table} (doesn't exist)`);
      }
    }

    console.log('\n✅ All existing tables cleared!');
    console.log('\n📝 You can now restart the server and it will create fresh tables with the new schema.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

resetDatabase();
