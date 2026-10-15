const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'a25josguapat_apidaw',
  password: process.env.DB_PASSWORD || 'Y0992759_r07',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'a25josguapat_Proyecto0',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
