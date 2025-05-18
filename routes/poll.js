const WebSocketClients = new Set();

function broadcastVoteUpdate(fastify, pollId) {
  const message = JSON.stringify({ type: "voteUpdate", pollId });

  WebSocketClients.forEach((conn) => {
    try {
      conn.send(message);
    } catch (err) {
      fastify.log.error("WebSocket send error:", err);
    }
  });
}

async function pollRoutes(fastify, opts) {
  // Create a poll
  fastify.post(
    "/",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { question, options, expiresAt } = request.body;

      const conn = await fastify.mysql.getConnection();
      try {
        await conn.beginTransaction();
const formattedExpiresAt = new Date(expiresAt).toISOString().slice(0, 19).replace('T', ' ');

        const [voteResult] = await conn.query(
          "INSERT INTO vote (description, expiresAt) VALUES (?, ?)",
          [question, formattedExpiresAt]
        );
        const voteId = voteResult.insertId;

        const inserts = options.map((opt) =>
          conn.query(
            "INSERT INTO vote_options (vote_id, name, description) VALUES (?, ?, ?)",
            [voteId, opt.name, opt.description || null]
          )
        );
        await Promise.all(inserts);

        await conn.commit();
        reply.code(201).send({ id: voteId });
      } catch (err) {
        await conn.rollback();
        fastify.log.error(err);
        reply.code(500).send({ error: "Failed to create poll" });
      } finally {
        conn.release();
      }
    }
  );

  // Get all polls
  fastify.get(
    "/",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const [rows] = await fastify.mysql.query(
        "SELECT id, description FROM vote ORDER BY id DESC"
      );
      reply.send(rows);
    }
  );

  // Get poll by ID with options and vote counts
  fastify.get(
    "/:id",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const pollId = request.params.id;

      const [pollRows] = await fastify.mysql.query(
        "SELECT id, description AS question, expiresAt FROM vote WHERE id = ?",
        [pollId]
      );
      if (!pollRows.length)
        return reply.code(404).send({ error: "Poll not found" });

      const [options] = await fastify.mysql.query(
        `SELECT o.id, o.name, o.description, COUNT(vc.id) AS votes
       FROM vote_options o
       LEFT JOIN votes_cast vc ON vc.option_id = o.id
       WHERE o.vote_id = ?
       GROUP BY o.id`,
        [pollId]
      );

      reply.send({
        id: pollId,
        question: pollRows[0].question,
        expiresAt: pollRows[0].expiresAt,
        options,
      });
    }
  );

  // Vote for an option
  // fastify.post(
  //   "/:id/vote",
  //   { preValidation: [fastify.authenticate] },
  //   async (request, reply) => {
  //     const pollId = request.params.id;
  //     const { optionId } = request.body;
  //     const userId = request?.user?.id;

  //     try {
  //       const [check] = await fastify.mysql.query(
  //         "SELECT id FROM vote_options WHERE id = ? AND vote_id = ?",
  //         [optionId, pollId]
  //       );
  //       if (check.length === 0) {
  //         return reply
  //           .code(400)
  //           .send({ error: "Invalid option for this poll" });
  //       }

  //       await fastify.mysql.query(
  //         "INSERT INTO votes_cast (user_id, option_id) VALUES (?, ?)",
  //         [userId, optionId]
  //       );
  //       // Broadcast vote update
  //       broadcastVoteUpdate(fastify, parseInt(pollId));

  //       reply.send({ success: true });
  //     } catch (err) {
  //       fastify.log.error(err);
  //       reply.code(500).send({ error: "Failed to cast vote" });
  //     }
  //   }
  // );

  fastify.post(
    "/:id/vote",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const pollId = request.params.id;
      const { optionId } = request.body;
  
    
      const user = request?.user;
    const isAnon = user?.type === 'anon';
    const voterId = isAnon ? user?.id : user?.id;

      try {
        // Validate vote option
        const [check] = await fastify.mysql.query(
          "SELECT id FROM vote_options WHERE id = ? AND vote_id = ?",
          [optionId, pollId]
        );
        if (check.length === 0) {
          return reply
            .code(400)
            .send({ error: "Invalid option for this poll" });
        }

              // Check if user has already voted
      const [alreadyVoted] = await fastify.mysql.query(
        "SELECT id FROM votes_cast WHERE option_id = ? AND user_id = ?",
        [pollId, voterId]
      );
      if (alreadyVoted.length > 0) {
        return reply.code(403).send({ error: "You have already voted" });
      }
        // Check vote rate
        console.log('222222')
        const now = Math.floor(Date.now() / 1000);
        const rateKey = `vote_rate:${now}`;
        const currentRate = await fastify.redis.incr(rateKey);
        console.log(currentRate)
        if (currentRate === 1) {
          await fastify.redis.expire(rateKey, 2);
        }

        if (currentRate > 1000) {
          // High load – buffer vote in Redis
          console.log('buffer')
          await fastify.redis.lpush(
            "vote_queue",
            JSON.stringify({
              user_id: voterId,
              option_id: optionId,
              timestamp: Date.now(),
            })
          );
        } else {
          console.log('no buffer')
          // Low load – insert directly
          await fastify.mysql.query(
            "INSERT INTO votes_cast (user_id, option_id) VALUES (?, ?)",
            [voterId, optionId]
          );
        }

        broadcastVoteUpdate(fastify, parseInt(pollId));
        reply.send({ success: true });
      } catch (err) {
        fastify.log.error(err);
        reply.code(500).send({ error: "Failed to cast vote" });
      }
    }
  );

  //Get all votes
  fastify.get(
    "/all",
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const [polls] = await fastify.mysql.query(
          "SELECT id, description FROM vote ORDER BY id DESC"
        );
        reply.send(polls);
      } catch (err) {
        fastify.log.error(err);
        reply.code(500).send({ error: "Error fetching polls" });
      }
    }
  );

  // WebSocket route for vote updates
  fastify.get("/ws/votes", { websocket: true }, (connection /*, req */) => {
    WebSocketClients.add(connection.socket);
    connection.socket.on("close", () =>
      WebSocketClients.delete(connection.socket)
    );
  });
}

module.exports = pollRoutes;
