require("dotenv").config();
const fastify = require("fastify")({ logger: true });

// CORS
fastify.register(require("@fastify/cors"), {
  origin: "*", // In production, replace with your allowed origin(s)
});

// Security headers
fastify.register(require("@fastify/helmet"));

// JWT Auth
fastify.register(require("@fastify/jwt"), {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: "1hr" },
});

// WebSocket support
fastify.register(require("@fastify/websocket"));


// const fastifyRedis = require('@fastify/redis')


fastify.register(require('@fastify/redis'), {
  host: 'redis', // Match container name
  port: 6379
});

const voteFlusher = require('./workers/voteFlusher');
 voteFlusher(fastify);

// Metrics endpoint
const client = require("prom-client");
const register = new client.Registry();
client.collectDefaultMetrics({ register });
fastify.get("/metrics", async (req, reply) => {
  reply.type("text/plain");
  return register.metrics();
});

//

fastify.register(require("./plugins/mysql"));

// Authentication preValidation utility
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// fastify.decorate("authenticate", async (request, reply) => {
//   return;
// });

const connections = new Set();
// const wsClients = {}; // { [pollId]: Set of WebSocket connections }
// fastify.decorate('wsClients', wsClients);
fastify.decorate("wsConnections", connections);

const voteConnections = new Set();

fastify.get("/ws/votes", { websocket: true }, (connection, req) => {
  const { socket } = connection;

  // Add connection
  voteConnections.add(socket);

  // Remove when closed
  socket.on("close", () => {
    voteConnections.delete(socket);
  });
});

// Function to broadcast vote update
fastify.decorate('broadcastVoteUpdate', function (pollId) {
  const message = JSON.stringify({
    type: 'voteUpdate',
    pollId,
    timestamp: Date.now(),
  });

  for (const socket of voteConnections) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  }
});
// fastify.decorate("broadcastVoteUpdate", broadcastVoteUpdate);

// Postgres plugin

// Routes
fastify.register(require("./routes/auth"), { prefix: "/auth" });
fastify.register(require("./routes/poll"), { prefix: "/poll" });

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ error: "Route not found" });
});

// Health check
fastify.get("/", async () => ({ message: "Team Polls API running" }));

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: parseInt(process.env.PORT, 10) || 3000,
      host: "0.0.0.0",
    });
    const [rows] = await fastify.mysql.query("SELECT 1");
    fastify.log.info("✅ MySQL connected");
    fastify.log.info("wsConnections", connections);

    fastify.log.info(`Server listening on port ${process.env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
