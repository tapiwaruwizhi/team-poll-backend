const fp = require('fastify-plugin');
const Redis = require('ioredis');

module.exports = fp(async (fastify) => {
  const client = new Redis({
    host: process.env.REDIS_HOST,
    port: +process.env.REDIS_PORT
  });
  fastify.decorate('redis', client);
});