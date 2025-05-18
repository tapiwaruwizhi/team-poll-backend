const buildFastify = require('../app');

describe('Poll API', () => {
  let fastify;

  const mockMysql = {
    getConnection: jest.fn().mockResolvedValue({
      beginTransaction: jest.fn(),
      query: jest.fn()
        .mockResolvedValueOnce([{ insertId: 123 }]) // vote insert
        .mockResolvedValue([]), // vote options insert
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    }),
    query: jest.fn()
  };

  const mockRedis = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn(),
    lpush: jest.fn()
  };

  beforeAll(async () => {
    fastify = buildFastify({ mysql: mockMysql, redis: mockRedis });
    await fastify.ready();
  });

  afterAll(() => fastify.close());

  test('should create a poll', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/poll/',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        question: 'Best backend framework?',
        options: [
          { name: 'Fastify', description: 'Fast and low overhead' },
          { name: 'Express', description: 'Flexible and popular' }
        ],
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('id');
  });
});
