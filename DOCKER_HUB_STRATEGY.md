# Docker Hub Strategy for CPU → GPU Transition

## 🎯 Why Docker Hub is CRITICAL for CPU → GPU Migration

### The Challenge: Different Base Images
**CPU WhisperLive**:
- Base: `python:3.9-slim`
- Size: ~2GB
- Dependencies: CPU-only PyTorch, faster-whisper
- Build time: 5-10 minutes

**GPU WhisperLive**:
- Base: `nvidia/cuda:11.8-devel-ubuntu20.04`
- Size: ~8GB (CUDA toolkit + PyTorch GPU + cuDNN)
- Dependencies: CUDA libraries, GPU PyTorch, NVIDIA drivers
- Build time: 20-45 minutes
- **CRITICAL**: Requires NVIDIA Docker runtime during build

### Problems Building GPU Images on orc-3001

#### 1. CUDA Toolkit Download (3-5GB)
```bash
# During GPU image build, these downloads happen:
- CUDA Toolkit: ~3GB
- PyTorch GPU: ~2GB  
- cuDNN: ~500MB
- NVIDIA libraries: ~1GB
- Total: ~6.5GB download during build
```

#### 2. Build Resource Requirements
```bash
# GPU image build requires:
- RAM: 8GB+ during build
- Disk: 15GB+ temporary space
- Network: High bandwidth for CUDA downloads
- Time: 20-45 minutes
```

#### 3. NVIDIA Docker Runtime Complexity
```yaml
# GPU build requires special Docker configuration:
services:
  whisperlive:
    build:
      context: .
      dockerfile: services/WhisperLive/Dockerfile.gpu
    runtime: nvidia  # Must be available during build
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
```

## 🚀 Docker Hub Solution: Pre-built GPU Images

### Current Working Images to Upload

#### 1. Check What We Have Built
```bash
# List current images (these are tested and working)
docker images | grep vexa

# Expected output:
vexa-vexa-bot                    latest    abc123    2GB
vexa-whisperlive-cpu-1          latest    def456    2GB  
vexa-websocket-proxy-1          latest    ghi789    100MB
vexa-api-gateway-1              latest    jkl012    200MB
```

#### 2. Build Missing GPU Images
Since we're switching to GPU, we need to build the GPU WhisperLive image:

```bash
# Build GPU WhisperLive (this will take 20-30 minutes)
cd /root/vexa
COMPOSE_PROFILES=gpu docker compose build whisperlive

# Verify GPU image is created
docker images | grep whisperlive
```

### Upload Strategy for CPU → GPU Transition

#### 1. Tag and Upload Current CPU Images
```bash
# Tag CPU images as stable versions
docker tag vexa-vexa-bot vexaai/vexa-bot:stable
docker tag vexa-whisperlive-cpu-1 vexaai/whisperlive-cpu:stable
docker tag vexa-websocket-proxy-1 vexaai/websocket-proxy:stable
docker tag vexa-api-gateway-1 vexaai/api-gateway:stable

# Upload to Docker Hub
docker push vexaai/vexa-bot:stable
docker push vexaai/whisperlive-cpu:stable
docker push vexaai/websocket-proxy:stable
docker push vexaai/api-gateway:stable
```

#### 2. Build and Upload GPU Images
```bash
# Build GPU WhisperLive locally (once)
DEVICE_TYPE=cuda COMPOSE_PROFILES=gpu docker compose build whisperlive

# Tag GPU image
docker tag vexa-whisperlive-1 vexaai/whisperlive-gpu:stable

# Upload GPU image (large upload, do once)
docker push vexaai/whisperlive-gpu:stable
```

## 📋 Production docker-compose for orc-3001

### Create docker-compose.production.yml
```yaml
version: '3.8'

services:
  # Bot service (same for CPU/GPU)
  vexa-bot:
    image: vexaai/vexa-bot:stable
    networks:
      - vexa_default
    restart: unless-stopped

  # GPU WhisperLive (replaces CPU version)
  whisperlive:
    image: vexaai/whisperlive-gpu:stable  # Pre-built GPU image
    profiles: ["gpu"]
    environment:
      - REDIS_STREAM_URL=redis://redis:6379/0/transcription_segments
      - DEVICE_TYPE=cuda
    deploy:
      replicas: 1
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["3"]  
              capabilities: [gpu]
    expose:
      - "9090"
      - "9091"
    networks:
      - vexa_default
    restart: unless-stopped

  # WebSocket Proxy (GPU-compatible)
  websocket-proxy:
    image: vexaai/websocket-proxy:stable
    ports:
      - "8088:8088"
      - "8090:8090"
    environment:
      - WHISPER_LIVE_URL=ws://whisperlive:9090  # Points to GPU service
      - PORT=8090
      - HTTP_PORT=8088
    networks:
      - vexa_default
    restart: unless-stopped

  # API Gateway
  api-gateway:
    image: vexaai/api-gateway:stable
    ports:
      - "18056:8000"
    networks:
      - vexa_default
    restart: unless-stopped

  # Redis (unchanged)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - vexa_default
    restart: unless-stopped

  # Other services...
  # (Use pre-built images for all)

volumes:
  redis-data:

networks:
  vexa_default:
    driver: bridge
```

## 🎯 orc-3001 Deployment Process

### Step 1: Prepare Docker Hub Images (Local)
```bash
# On current development machine:

# 1. Build GPU image (20-30 minutes, do once)
DEVICE_TYPE=cuda COMPOSE_PROFILES=gpu docker compose build whisperlive

# 2. Tag all images
docker tag vexa-vexa-bot vexaai/vexa-bot:stable
docker tag vexa-whisperlive-1 vexaai/whisperlive-gpu:stable
docker tag vexa-websocket-proxy-1 vexaai/websocket-proxy:stable
docker tag vexa-api-gateway-1 vexaai/api-gateway:stable

# 3. Upload to Docker Hub (large upload, be patient)
docker login
docker push vexaai/vexa-bot:stable          # ~2GB
docker push vexaai/whisperlive-gpu:stable   # ~8GB (this will take time)
docker push vexaai/websocket-proxy:stable   # ~100MB
docker push vexaai/api-gateway:stable       # ~200MB
```

### Step 2: Deploy on orc-3001 (Fast!)
```bash
# SSH to orc-3001
ssh root@orc-3001

# Pull latest configuration
cd /root/vexa
git pull origin main

# Deploy with pre-built GPU images (2-3 minutes!)
DEVICE_TYPE=cuda COMPOSE_PROFILES=gpu docker compose -f docker-compose.production.yml up -d

# Verify GPU is being used
docker exec vexa-whisperlive-1 nvidia-smi
```

## 💡 Benefits for CPU → GPU Migration

### Time Savings
```
Without Docker Hub (building on orc-3001):
- Download CUDA toolkit: 10-15 minutes
- Build GPU WhisperLive: 20-30 minutes
- Build other services: 10-15 minutes
- Total: 40-60 minutes

With Docker Hub (pre-built images):
- Download GPU images: 3-5 minutes
- Deploy stack: 1-2 minutes
- Total: 4-7 minutes
```

### Reliability
```
Build on orc-3001 Risks:
- CUDA download timeouts
- GPU driver compatibility issues
- Out of disk space during build
- Network interruptions
- Build cache conflicts

Pre-built Images Benefits:
- Tested working images
- Consistent deployment
- No build dependencies
- Fast rollback capability
```

### Resource Efficiency
```
Building on orc-3001:
- Uses production server resources
- High CPU/memory during build
- Large temporary disk usage
- Network bandwidth consumption

Pre-built Images:
- No build resources needed
- Just pulls and runs
- Minimal server impact
- Fast startup
```

## 🔄 Update CLAUDE.md for Docker Hub Strategy

```markdown
### 🚀 Production Deployment (Docker Hub Images)

#### ALWAYS Use Pre-built Images for orc-3001:
```bash
# ✅ CORRECT: Use pre-built images
DEVICE_TYPE=cuda COMPOSE_PROFILES=gpu docker compose -f docker-compose.production.yml up -d

# ❌ WRONG: Building on production server
docker compose build  # Never do this on orc-3001
```

#### Docker Hub Images:
- **vexaai/vexa-bot:stable** - Bot with Playwright + audio
- **vexaai/whisperlive-gpu:stable** - GPU-accelerated WhisperLive
- **vexaai/websocket-proxy:stable** - WebSocket proxy service
- **vexaai/api-gateway:stable** - REST API gateway

#### Benefits:
- ✅ **4-7 minutes deployment** vs 40-60 minutes building
- ✅ **Tested working images** vs build failures
- ✅ **No resource usage** vs high CPU/memory during build
- ✅ **Reliable GPU support** vs CUDA build complexity
```

## 🎯 Immediate Action Plan

1. **Build GPU Images Locally** (20-30 minutes, do once)
2. **Upload to Docker Hub** (~8GB upload, be patient) 
3. **Create production docker-compose.yml** (uses pre-built images)
4. **Deploy on orc-3001** (4-7 minutes total!)
5. **Verify GPU acceleration** (nvidia-smi, performance tests)

**Bottom Line**: Docker Hub images are ESSENTIAL for CPU → GPU migration. They eliminate build complexity, reduce deployment time by 90%, and ensure reliable GPU support on orc-3001.