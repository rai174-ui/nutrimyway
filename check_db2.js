const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgres://postgres@localhost:54321/nutrimyway' });
  await client.connect();
  const res = await client.query("SELECT * FROM consumption_logs LIMIT 1");
  console.log("Columns:", res.fields.map(f => f.name));
  await client.end();
}
run();
