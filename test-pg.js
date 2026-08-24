import pg from 'pg';
const pool = new pg.Pool({
  host: undefined,
  user: undefined,
  password: undefined,
  database: undefined,
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error("Query error", err);
  else console.log(res.rows[0]);
  pool.end();
});
