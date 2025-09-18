# Vexa Deployment (From Source)

This guide explains how to deploy the full Vexa stack on any server directly from this repository using Docker Compose. No private registry is required.

## Prerequisites
- Docker 24+
- Docker Compose plugin (`docker compose`)
- 10GB free disk space

## 1) Clone and configure
- Clone the repo:
  `git clone https://github.com/<your-org>/vexa.git && cd vexa`
- Create env file:
  `cp .env.example .env`
  Edit `.env` and set `ADMIN_API_TOKEN` (and any OAuth/keys you use)

## 2) Build and start services
- Build and run from source:
  `docker compose -f docker-compose.build.yml up -d --build`

This starts:
- postgres on port 15438
- redis on port 6379
- api-gateway on 18056
- admin-api on 18057
- bot-manager on 18081
- websocket-proxy on 8088/8090
- whisperlive-cpu on 9090/9091
- transcription-collector on 18123
- traefik dashboard on 18085

## 3) Bootstrap users and API token
- Create a user via Admin API (requires X-Admin-API-Key header using ADMIN_API_TOKEN):
  `curl -s -X POST http://localhost:18057/admin/users \
       -H 'X-Admin-API-Key: REPLACE_WITH_ADMIN_TOKEN' \
       -H 'Content-Type: application/json' \
       -d '{"email":"you@example.com","name":"You"}'`

- Create an API token for that user (replace USER_ID):
  `curl -s -X POST http://localhost:18057/admin/users/USER_ID/tokens \
       -H 'X-Admin-API-Key: REPLACE_WITH_ADMIN_TOKEN'`

Note the `token` value returned; use it as `X-API-Key` when calling Bot Manager.

## 4) Launch a bot
- Example request to start a transcription bot (replace values):
  `curl -s -X POST http://localhost:18081/bots \
       -H 'X-API-Key: REPLACE_WITH_USER_TOKEN' \
       -H 'Content-Type: application/json' \
       -d '{
             "platform":"teams",
             "native_meeting_id":"demo-session",
             "meeting_url":"REPLACE_TEAMS_MEETING_URL",
             "bot_name":"VexaTranscriptionBot",
             "task":"transcribe",
             "auth_mode":"guest"
           }'`

## 5) Logs and health
- Tail logs: `docker compose -f docker-compose.build.yml logs -f`
- Check container status: `docker ps`

## Notes
- WhisperLive uses image `vexaai/whisperlive-cpu:latest`. To override: `WHISPERLIVE_IMAGE=your/image:tag docker compose -f docker-compose.build.yml up -d`
- For HTTPS or domain routing, add Traefik labels or use your ingress. See `traefik` docs.
- To persist Postgres data across redeployments, the `postgres_data` named volume is used.

## CI/CD (optional)
To publish images to GHCR on push, add a GitHub Actions workflow that builds each service under `services/*` and pushes `ghcr.io/<org>/<name>:<tag>`. Then set `DOCKER_HUB_ORG`/`VERSION` or update `docker-compose.hub.yml` to point to your registry.

