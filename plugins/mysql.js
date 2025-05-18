// plugins/mysql.js
const fp = require('fastify-plugin');
const mysql = require('@fastify/mysql');

module.exports = fp(async function (fastify, opts) {
  try {
    await fastify.register(mysql, {
      promise: true,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Test the connection
    const [rows] = await fastify.mysql.query('SELECT 1');
  } catch (err) {
    console.log(err)
    fastify.log.error(err, '❌ Failed to connect to MySQL');
    fastify.log.error('❌ Failed to connect to MySQL:', err);
    process.exit(1); // Stop server if connection fails
  }
});
