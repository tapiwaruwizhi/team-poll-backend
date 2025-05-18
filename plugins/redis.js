const fp = require('fastify-plugin');
const Redis = require('ioredis');

module.exports = fp(async function (fastify, opts) {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: 6379
  });

  fastify.decorate('redis', redis);

  redis.on('connect', () => {
    fastify.log.info('✅ Connected to Redis');
  });

  redis.on('error', err => {
    fastify.log.error('❌ Redis error:', err);
  });
});
