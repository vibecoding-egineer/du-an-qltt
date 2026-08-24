import pg from 'pg';
console.log("Host:", process.env.SQL_HOST);
const pool = new pg.Pool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows[0]);
  pool.end();
});
