const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  
  const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['checkin_categories']);
  console.log('Columns in checkin_categories:', res.rows.map(r => r.column_name));

  const res2 = await client.query('SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = $1', ['checkin_categories']);
  console.log('Constraints in checkin_categories:', res2.rows);

  await client.end();
}

run().catch(console.error);
