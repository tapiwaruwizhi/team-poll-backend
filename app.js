// src/app.js
const Fastify = require('fastify');
const pollRoutes = require('./routes/poll');

function buildFastify(mockServices = {}) {
  const fastify = Fastify();

  // Register mock mysql & redis
  fastify.decorate('mysql', mockServices.mysql || {});
  fastify.decorate('redis', mockServices.redis || {});

  // Register mock auth
  fastify.decorate('authenticate', async (req, res) => {
    req.user = { id: 1 }; // Simulate authenticated user
  });

  // Register routes
  fastify.register(pollRoutes, { prefix: '/poll' });

  return fastify;
}

module.exports = buildFastify;
