const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nutrimyway' });
pool.query('SELECT * FROM ingredient_skus').then(res => { console.log(res.rows); process.exit(0); });
