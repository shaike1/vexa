# Vexa Deployment Guidelines

## Overview
This document provides comprehensive deployment guidelines for Vexa, an open-source meeting transcription API with Microsoft Teams and Google Meet support.

## Architecture
Vexa follows a microservices architecture with the following components:
- **API Gateway**: Main API endpoints (port 8056)
- **Admin API**: User and token management (port 8057)
- **Bot Manager**: Bot lifecycle management
- **Transcription Collector**: Process transcription data (port 8123)
- **WhisperLive**: Real-time speech-to-text (port 9090)
- **PostgreSQL**: Database for users, meetings, transcripts
- **Redis**: Caching and bot command coordination
- **Traefik**: Load balancing and service discovery

## Deployment Options

### 1. Local Development (Recommended for Testing)
```bash
# Clone repository
git clone https://github.com/Vexa-ai/vexa.git
cd vexa

# Quick deployment
make all TARGET=cpu

# Check services
docker compose ps
```

### 2. Server Deployment
```bash
# System requirements
- 4GB RAM minimum (8GB recommended)
- 2 CPU cores minimum (4 cores recommended)
- 20GB storage minimum
- x86_64 architecture (ARM64 limited support)

# Deploy on server
git clone https://github.com/Vexa-ai/vexa.git
cd vexa
make all TARGET=cpu

# For GPU acceleration
make all TARGET=gpu
```

### 3. Cloud Deployment Options

#### AWS EC2
```bash
# Launch EC2 instance (t3.medium or larger)
# Install Docker and Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# Deploy Vexa
git clone https://github.com/Vexa-ai/vexa.git
cd vexa
make all TARGET=cpu
```

#### DigitalOcean
```bash
# Use Docker Droplet or regular Ubuntu droplet
# Install dependencies and deploy
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Deploy Vexa
git clone https://github.com/Vexa-ai/vexa.git
cd vexa
make all TARGET=cpu
```

#### Google Cloud Platform
```bash
# Use Compute Engine VM
# Install Docker and deploy
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker

# Deploy Vexa
git clone https://github.com/Vexa-ai/vexa.git
cd vexa
make all TARGET=cpu
```

## Configuration

### Environment Variables
```bash
# Core Configuration
ADMIN_API_TOKEN=your-secure-token          # Change in production!
LANGUAGE_DETECTION_SEGMENTS=10
VAD_FILTER_THRESHOLD=0.5
WHISPER_MODEL_SIZE=tiny                     # tiny, small, medium, large
DEVICE_TYPE=cpu                             # cpu or cuda

# Port Configuration
API_GATEWAY_HOST_PORT=8056
ADMIN_API_HOST_PORT=8057
TRANSCRIPTION_COLLECTOR_HOST_PORT=8123
POSTGRES_HOST_PORT=5438
TRAEFIK_WEB_HOST_PORT=9090
TRAEFIK_DASHBOARD_HOST_PORT=8085

# Cloudflare Tunnel (Optional)
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
```

### Database Configuration
```bash
# PostgreSQL settings (in docker-compose.yml)
POSTGRES_DB=vexa
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres  # Change in production!

# Redis settings
REDIS_URL=redis://redis:6379/0
```

## Security Guidelines

### Production Security
```bash
# 1. Change default passwords
ADMIN_API_TOKEN=your-super-secure-admin-token-here
POSTGRES_PASSWORD=your-secure-db-password

# 2. Use environment-specific configs
cp .env.example .env.production
# Edit .env.production with secure values

# 3. Enable firewall
sudo ufw allow ssh
sudo ufw allow 8056/tcp  # API Gateway
sudo ufw allow 8057/tcp  # Admin API
sudo ufw enable

# 4. Use HTTPS with reverse proxy
# Configure Nginx/Apache or use Cloudflare Tunnel
```

### API Security
```bash
# Generate secure API keys (40+ characters)
openssl rand -hex 20

# Use API keys in headers
X-API-Key: user-api-key               # For bot operations
X-Admin-API-Key: admin-api-key        # For admin operations
```

## User Management

### Create Admin User
```bash
# Create user via Admin API
curl -X POST http://localhost:8057/admin/users \
  -H "X-Admin-API-Key: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure-password"
  }'
```

### Generate API Token
```bash
# Generate token for user (user_id from previous step)
curl -X POST http://localhost:8057/admin/users/1/tokens \
  -H "X-Admin-API-Key: your-admin-token"
```

## Platform-Specific Configuration

### Microsoft Teams
```bash
# Teams bot configuration
{
  "platform": "teams",
  "meetingUrl": "https://teams.microsoft.com/l/meetup-join/...",
  "botName": "VexaBot",
  "native_meeting_id": "meeting-id-from-url"
}
```

### Google Meet
```bash
# Google Meet bot configuration
{
  "platform": "google",
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "botName": "VexaBot",
  "native_meeting_id": "abc-defg-hij"
}
```

## API Usage Examples

### Create Bot
```bash
curl -X POST http://localhost:8056/bots \
  -H "X-API-Key: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "native_meeting_id": "teams-meeting-id",
    "platform": "teams",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
    "bot_name": "VexaBot"
  }'
```

### Get Transcripts
```bash
curl -H "X-API-Key: your-api-token" \
  http://localhost:8056/transcripts/teams/meeting-id
```

### List Bots
```bash
curl -H "X-API-Key: your-api-token" \
  http://localhost:8056/bots
```

## Cloudflare Tunnel Integration

### Setup
```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create vexa-tunnel

# Configure DNS records
# api.your-domain.com → CNAME to tunnel-id.cfargotunnel.com
# admin.your-domain.com → CNAME to tunnel-id.cfargotunnel.com
```

### Deploy with Tunnel
```bash
# Update .env with tunnel token
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# Deploy with Cloudflare profile
docker compose --profile cloudflare --profile cpu up -d
```

## Monitoring and Maintenance

### Health Checks
```bash
# Check service health
curl http://localhost:8056/health        # API Gateway
curl http://localhost:8057/health        # Admin API
curl http://localhost:8123/health        # Transcription Collector

# Check Traefik dashboard
curl http://localhost:8085/dashboard/
```

### Log Monitoring
```bash
# View service logs
docker compose logs -f api-gateway
docker compose logs -f admin-api
docker compose logs -f bot-manager
docker compose logs -f transcription-collector
```

### Database Maintenance
```bash
# Backup database
docker compose exec postgres pg_dump -U postgres vexa > backup.sql

# Monitor database size
docker compose exec postgres psql -U postgres -d vexa -c "SELECT pg_size_pretty(pg_database_size('vexa'));"
```

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker status
sudo systemctl status docker

# Check port conflicts
sudo netstat -tulpn | grep :8056

# Check disk space
df -h
```

#### Database Connection Issues
```bash
# Check PostgreSQL logs
docker compose logs postgres

# Test database connection
docker compose exec postgres psql -U postgres -d vexa -c "SELECT version();"
```

#### Bot Creation Failures
```bash
# Check bot-manager logs
docker compose logs bot-manager

# Check Docker socket permissions
sudo chmod 666 /var/run/docker.sock
```

#### Memory Issues
```bash
# Check memory usage
docker stats

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Performance Optimization

### Resource Allocation
```bash
# Optimize for CPU deployment
WHISPER_MODEL_SIZE=tiny              # Fastest, lower accuracy
VAD_FILTER_THRESHOLD=0.5             # Voice activity detection

# Optimize for GPU deployment
WHISPER_MODEL_SIZE=medium            # Better accuracy
DEVICE_TYPE=cuda                     # GPU acceleration
```

### Scaling Considerations
```bash
# Horizontal scaling
docker compose up --scale whisperlive-cpu=3

# Load balancing
# Traefik automatically handles load balancing between replicas

# Database optimization
# Consider connection pooling for high-load scenarios
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker compose exec postgres pg_dump -U postgres vexa > vexa_backup_$(date +%Y%m%d).sql

# Restore backup
docker compose exec -T postgres psql -U postgres vexa < vexa_backup_20231201.sql
```

### Configuration Backup
```bash
# Backup configuration files
tar -czf vexa_config_backup.tar.gz .env docker-compose.yml cloudflare-tunnel-config.yml

# Restore configuration
tar -xzf vexa_config_backup.tar.gz
```

## Support and Resources

### Documentation
- Main README: `/README.md`
- Complete Teams Guide: `/VEXA-TEAMS-COMPLETE-GUIDE.md`
- API Documentation: Available via running services

### Community Resources
- GitHub Issues: [https://github.com/Vexa-ai/vexa/issues](https://github.com/Vexa-ai/vexa/issues)
- Discussions: [https://github.com/Vexa-ai/vexa/discussions](https://github.com/Vexa-ai/vexa/discussions)

### Getting Help
1. Check logs for error messages
2. Review this documentation
3. Search existing GitHub issues
4. Create new issue with detailed information

---

*This document provides comprehensive deployment guidelines for Vexa. Keep it updated as the system evolves and new features are added.*