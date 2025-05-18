const { v4: uuidv4 } = require('uuid');

module.exports = async (fastify, opts) => {
  fastify.get('/anon', async (request, reply) => {
    const anonId = uuidv4(); // unique user identifier
    const token = fastify.jwt.sign({ type: 'anon', id: anonId });
    return { token };
  });
};