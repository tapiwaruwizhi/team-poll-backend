module.exports = async function voteFlusher(fastify) {
  setInterval(async () => {
    const BATCH_SIZE = 100;
    const votes = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const raw = await fastify.redis.rpop('vote_queue');
      if (!raw) break;
      votes.push(JSON.parse(raw));
    }

    if (votes.length > 0) {
      const values = votes.map(v => [v.user_id, v.option_id]);
      await fastify.mysql.query(
        'INSERT INTO votes_cast (user_id, option_id) VALUES ?',
        [values]
      );
      fastify.log.info(`✅ Flushed ${votes.length} votes to MySQL`);
    }
  }, 3000); // flush every 3s
};
