module.exports = async (fastify, opts) => {
  fastify.get('/anon', async (request, reply) => {
    const token = fastify.jwt.sign({ type: 'anon' });
    return { token };
  });
};