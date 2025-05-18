const buildFastify = require('../app');

describe('Vote API', () => {
  let fastify;

  const mockMysql = {
    query: jest.fn(),
  };

  const mockRedis = {
    incr: jest.fn(),
    expire: jest.fn(),
    lpush: jest.fn(),
  };

  beforeEach(async () => {
    mockMysql.query.mockReset();
    mockRedis.incr.mockReset();
    mockRedis.expire.mockReset();
    mockRedis.lpush.mockReset();

    fastify = buildFastify({ mysql: mockMysql, redis: mockRedis });
    await fastify.ready();
  });

  afterEach(() => fastify.close());

  test('should cast vote directly when under load threshold', async () => {
    const pollId = 1;
    const optionId = 10;

    // Simulate valid vote option
    mockMysql.query
      .mockResolvedValueOnce([[{ id: optionId }]]) // valid option check
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // vote insert

    mockRedis.incr.mockResolvedValue(1); // under threshold

    const response = await fastify.inject({
      method: 'POST',
      url: `/poll/${pollId}/vote`,
      headers: { authorization: 'Bearer token' },
      payload: { optionId },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true });

    expect(mockRedis.incr).toHaveBeenCalled();
    expect(mockMysql.query).toHaveBeenCalledWith(
      'INSERT INTO votes_cast (user_id, option_id) VALUES (?, ?)',
      [1, optionId]
    );
  });

  test('should buffer vote when over load threshold', async () => {
    const pollId = 1;
    const optionId = 10;

    mockMysql.query.mockResolvedValueOnce([[{ id: optionId }]]); // valid option
    mockRedis.incr.mockResolvedValue(1001); // over threshold

    const response = await fastify.inject({
      method: 'POST',
      url: `/poll/${pollId}/vote`,
      headers: { authorization: 'Bearer token' },
      payload: { optionId },
    });

    expect(response.statusCode).toBe(200);
    expect(mockRedis.lpush).toHaveBeenCalled();
    const votePayload = JSON.parse(mockRedis.lpush.mock.calls[0][1]);
    expect(votePayload.option_id).toBe(optionId);
    expect(votePayload.poll_id).toBe(pollId.toString());
  });

  test('should reject vote for invalid option', async () => {
    const pollId = 1;
    const optionId = 999;

    // Option not found
    mockMysql.query.mockResolvedValueOnce([[]]);

    const response = await fastify.inject({
      method: 'POST',
      url: `/poll/${pollId}/vote`,
      headers: { authorization: 'Bearer token' },
      payload: { optionId },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Invalid option for this poll',
    });
  });
});
