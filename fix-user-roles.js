const { Client } = require('pg');

async function fixUserRoles() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_lD7ZcVXOHPo4@ep-flat-shape-ah92g41r-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const result = await client.query(`
      UPDATE users
      SET role = 'client'
      WHERE role = 'user'
      RETURNING id, email, role
    `);

    console.log(`✅ Updated ${result.rowCount} users from 'user' to 'client' role`);

    if (result.rows.length > 0) {
      console.log('\nUpdated users:');
      result.rows.forEach(row => {
        console.log(`  - ${row.email} (${row.id}) → ${row.role}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

fixUserRoles();
