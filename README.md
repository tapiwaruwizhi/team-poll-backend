# Team Polls API

> A lightweight Fastify-based backend for live polls with Postgres, Redis, and WebSockets.

## Features
- Anonymous JWT authentication (`/auth/anon`)
- Create polls, cast votes, fetch tally
- Real-time WebSocket updates
- Rate limiting (5 votes/sec)
- Metrics endpoint (`/metrics`) in Prometheus format

## Getting Started

1. Install dependencies:
   ```bash
   npm installs