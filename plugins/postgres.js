const fp = require('fastify-plugin');

module.exports = fp(async (fastify) => {
  fastify.register(require('@fastify/postgres'), {
    connectionString: process.env.DATABASE_URL
  });
});