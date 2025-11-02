# Running AgentRunner Locally

This guide will help you set up and run all services in the AgentRunner project locally.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Build Packages](#build-packages)
4. [Environment Variables](#environment-variables)
5. [Running Services](#running-services)
6. [Frontend](#frontend)
7. [Python Services](#python-services)
8. [Solana Programs](#solana-programs)

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** (for PostgreSQL, Redis, and Python containers)
- **TypeScript** (via `ts-node` or `tsx`)
- **Python 3.10+** with `venv` (for API services)
- **Anchor** (for Solana programs)

---

## Infrastructure Setup

### 1. PostgreSQL Database

Start PostgreSQL using Docker Compose:

```bash
docker-compose up postgres -d
```

Or manually:

```bash
docker run -d \
  --name agentrunner-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=agentrunner \
  -p 5432:5432 \
  postgres:15
```

**Connection String:**
```
PG_URL=postgres://postgres:postgres@localhost:5432/agentrunner
```

### 2. Redis (Optional)

Start Redis using Docker Compose:

```bash
docker-compose up redis -d
```

Or manually:

```bash
docker run -d \
  --name agentrunner-redis \
  -p 6379:6379 \
  redis:7
```

---

## Build Packages

Build the shared packages before starting services:

```bash
# Build common package
cd packages/common
npm install
npm run build

# Build skills package
cd ../skills
npm install
npm run build
```

---

## Environment Variables

Create `.env` files in each service directory with the required variables. Here's a quick reference:

### Common Variables

```env
# Database
PG_URL=postgres://postgres:postgres@localhost:5432/agentrunner

# Frontend
FRONTEND_URL=http://localhost:3000

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_private_key_here
AGENT_PROGRAM_ID=your_program_id
AGENT_IDENTITY=your_agent_identity
```

### Service-Specific Variables

See each service section below for detailed environment variable requirements.

---

## Running Services

Run services in this order for proper dependency resolution:

### 1. Broker Service (Port 7004)

**Purpose:** Handles agent registration and marketplace functionality.

```bash
cd services/broker

# Create .env file with:
# PG_URL=postgres://postgres:postgres@localhost:5432/agentrunner
# FRONTEND_URL=http://localhost:3000

npx ts-node src/server.ts
```

**Required Environment Variables:**
- `PG_URL` - PostgreSQL connection string
- `FRONTEND_URL` - Frontend URL for CORS (default: `http://localhost:3000`)

---

### 2. Planner Service (Port 7002)

**Purpose:** OpenAI-based planning service for agent task planning.

```bash
cd services/planner-openai

# Create .env file with:
# OPENAI_API_KEY=your_openai_api_key

npx ts-node src/server.ts
```

**Required Environment Variables:**
- `OPENAI_API_KEY` - Your OpenAI API key

---

### 3. X402 Merchant Service (Port 7003)

**Purpose:** Payment gateway for paywalled services using USDC.

```bash
cd services/x402-merchant

# Create .env file with:
# X402_CURRENCY=usdc
# PAYTO_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# MERCHANT_PUBLIC_KEY=your_merchant_public_key

npx ts-node src/server.ts
```

**Required Environment Variables:**
- `X402_CURRENCY` - Currency type (default: `usdc`)
- `PAYTO_MINT` - Token mint address
- `MERCHANT_PUBLIC_KEY` - Your merchant wallet public key

**Note:** You can add other currencies by changing `X402_CURRENCY` and `PAYTO_MINT` in `.env`.

---

### 4. Runner Service (Port 7001)

**Purpose:** Executes agent skills and handles job queues.

```bash
cd services/runner

# Create .env file with required variables
npx ts-node src/server.ts
```

**Required Environment Variables:**
- `RUNNER_URL` - Runner service URL (default: `http://localhost:7001`)
- `SOLANA_RPC_URL` - Solana RPC endpoint


---


### 5. API Gateway

**Purpose:** API gateway service for routing requests.

```bash
cd services/api-gateway

# Set all the env variables needed
# RUNNER_URL=http://localhost:7001
# PLANNER_URL=http://localhost:7002
# X402_URL=http://localhost:7003
# BROKER_URL=http://localhost:7004
# CERT_URL=http://localhost:7005

# Pull Python Docker image
docker pull python:3.10-slim

# Run the Python agent service (for POST /run-code)
npx ts-node src/runcd.ts

# Also run the main API gateway
npx ts-node src/run.ts
```

**Note:** Both `runcd.ts` (for `/run-code` POST request) and `run.ts` need to be running.

---

## Frontend

**Port:** 3000

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

**Environment Variables:**
- `PLANNER_URL` - Planner service URL (default: `http://localhost:7002`)
- `BROKER_URL` - Broker service URL (default: `http://localhost:7004`)
- `RUNNER_URL` - Runner service URL (default: `http://localhost:7001`)
- `PYTHON_AGENT_API_URL` - Python agent API URL (default: `http://localhost:6050`)

---

## Python Services

**Location:** `api-services/`

### Main API Service (Port 8000)

**Purpose:** Provides OHLCV data for trading symbols and timeframes.

```bash
cd api-services
source venv/bin/activate
python app/main.py
```

**Endpoints:**
- `GET /ohlcv?symbol={symbol}&timeframe={timeframe}` - Get OHLCV data

### Link Shortener Service

**Purpose:** X402 paywalled link shortening service.

```bash
cd api-services
source venv/bin/activate
python app/link_shortner.py
```

---

## Solana Programs

**Location:** `programs/registry/`

### Building Programs

```bash
cd programs/registry
anchor build
```

### Available Functions

The Solana program includes four main functions:

1. **`register_agent`** - Register a new agent in the registry
2. **`update_agent`** - Update an existing agent
3. **`post_validation`** - Used in `anchorMerkleTree.ts` for validation
4. **`post_feedback`** - Submit feedback for agents

### Testing

```bash
cd programs/registry
anchor test
```

### Deployment

```bash
cd programs/registry
anchor deploy
```

---

## Service Port Summary

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js web application |
| Runner | 7001 | Agent skill execution |
| Planner | 7002 | Task planning |
| X402 Merchant | 7003 | Payment gateway |
| Broker | 7004 | Agent marketplace |
| API Gateway (run.ts) | 7050 | Main API gateway |
| Python Agent API (runcd.ts) | 6050 | Python agent execution (/run-code) |
| Python Main API | 8000 | OHLCV data API |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache/Queue |

---

## Quick Start Commands

For a quick setup, run services in separate terminal windows:

```bash
# Terminal 1: Infrastructure
docker-compose up postgres redis -d

# Terminal 2: Broker
cd services/broker && npx ts-node src/server.ts

# Terminal 3: Planner
cd services/planner-openai && npx ts-node src/server.ts

# Terminal 4: X402
cd services/x402-merchant && npx ts-node src/server.ts

# Terminal 5: Runner
cd services/runner && npx ts-node src/server.ts

# Terminal 6: API Gateway - Python Agent Service (for POST /run-code)
cd services/api-gateway && npx ts-node src/runcd.ts

# Terminal 7: API Gateway - Main Service
cd services/api-gateway && npx ts-node src/run.ts

# Terminal 8: Frontend
cd frontend && npm run dev
```

---

## Troubleshooting

### Common Issues

1. **Port Already in Use:** Make sure no other services are using the required ports.

2. **Docker Connection Error:** Ensure Docker is running and you have access to the Docker socket.

3. **Database Connection Failed:** Verify PostgreSQL is running and the connection string is correct.

4. **Missing Dependencies:** Run `npm install` in each service directory.

5. **TypeScript Errors:** Make sure packages are built (`npm run build` in `packages/common` and `packages/skills`).

### Checking Service Health

Most services expose a health endpoint:
- API Gateway: `GET http://localhost:8080/health`
- Python Agent API: `GET http://localhost:6050/health`

---

## Notes

- Services should be started in the order listed above for proper dependency resolution.
- Environment variables can be set in `.env` files in each service directory.
- For production deployment, consider using Docker Compose (see `docker-compose.yml`).
- The Python agent service requires Docker and may not work on all platforms.
