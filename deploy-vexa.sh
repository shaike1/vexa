#!/bin/bash

# Vexa AI Deployment Script
# Automated deployment with interactive configuration
# Supports local and remote deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/deployment.log"
BACKUP_DIR="$SCRIPT_DIR/backups/$(date +%Y%m%d_%H%M%S)"

# Default configuration
DEFAULT_BOT_NAME="VexaAI-Transcriber"
DEFAULT_API_TOKEN="token"
DEFAULT_LANGUAGE="en"
DEFAULT_DEVICE_TYPE="cpu"

echo -e "${PURPLE}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                     🤖 VEXA AI DEPLOYMENT                       ║
║              Real-Time Meeting Transcription Stack              ║
║                                                                  ║
║  🚀 Automated Docker deployment with configuration prompts      ║
║  🔧 Supports local and remote server deployment                 ║
║  📊 Health monitoring and service verification                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "${RED}❌ ERROR: $1${NC}"
    log "${YELLOW}💡 Check troubleshooting guide: TROUBLESHOOTING.md${NC}"
    exit 1
}

# Success message
success() {
    log "${GREEN}✅ $1${NC}"
}

# Warning message  
warn() {
    log "${YELLOW}⚠️  $1${NC}"
}

# Info message
info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running. Please start Docker service."
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error_exit "Docker Compose is not available. Please install Docker Compose."
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df "$SCRIPT_DIR" | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 10485760 ]; then  # 10GB in KB
        warn "Less than 10GB disk space available. Deployment may fail."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    success "Prerequisites check passed"
}

# Interactive configuration
configure_deployment() {
    info "🔧 Deployment Configuration"
    echo
    
    # Deployment type
    echo -e "${CYAN}1. Deployment Type${NC}"
    PS3="Select deployment type: "
    options=("Local Development" "Production Server" "Custom Configuration")
    select opt in "${options[@]}"; do
        case $opt in
            "Local Development")
                DEPLOYMENT_TYPE="local"
                DEVICE_TYPE="cpu"
                break
                ;;
            "Production Server")
                DEPLOYMENT_TYPE="production"
                echo -n "Use GPU acceleration? (y/N): "
                read -r gpu_choice
                if [[ $gpu_choice =~ ^[Yy]$ ]]; then
                    DEVICE_TYPE="gpu"
                else
                    DEVICE_TYPE="cpu"
                fi
                break
                ;;
            "Custom Configuration")
                DEPLOYMENT_TYPE="custom"
                break
                ;;
            *) echo "Invalid option. Please try again.";;
        esac
    done
    
    # Bot configuration
    echo
    echo -e "${CYAN}2. Bot Configuration${NC}"
    read -p "Default bot name [$DEFAULT_BOT_NAME]: " BOT_NAME
    BOT_NAME=${BOT_NAME:-$DEFAULT_BOT_NAME}
    
    read -p "API authentication token [$DEFAULT_API_TOKEN]: " API_TOKEN
    API_TOKEN=${API_TOKEN:-$DEFAULT_API_TOKEN}
    
    read -p "Default transcription language [$DEFAULT_LANGUAGE]: " LANGUAGE
    LANGUAGE=${LANGUAGE:-$DEFAULT_LANGUAGE}
    
    # Port configuration
    echo
    echo -e "${CYAN}3. Port Configuration${NC}"
    read -p "API Gateway port [18056]: " API_PORT
    API_PORT=${API_PORT:-18056}
    
    read -p "Admin API port [18057]: " ADMIN_PORT
    ADMIN_PORT=${ADMIN_PORT:-18057}
    
    read -p "Traefik port [18080]: " TRAEFIK_PORT
    TRAEFIK_PORT=${TRAEFIK_PORT:-18080}
    
    # Advanced options
    if [[ "$DEPLOYMENT_TYPE" == "custom" ]]; then
        echo
        echo -e "${CYAN}4. Advanced Configuration${NC}"
        read -p "PostgreSQL port [15438]: " POSTGRES_PORT
        POSTGRES_PORT=${POSTGRES_PORT:-15438}
        
        read -p "Redis port [6379]: " REDIS_PORT
        REDIS_PORT=${REDIS_PORT:-6379}
        
        read -p "Device type (cpu/gpu) [$DEFAULT_DEVICE_TYPE]: " DEVICE_TYPE
        DEVICE_TYPE=${DEVICE_TYPE:-$DEFAULT_DEVICE_TYPE}
    fi
    
    # SSL/TLS configuration
    if [[ "$DEPLOYMENT_TYPE" == "production" ]]; then
        echo
        echo -e "${CYAN}5. SSL/TLS Configuration${NC}"
        read -p "Enable SSL/TLS? (y/N): " ssl_choice
        if [[ $ssl_choice =~ ^[Yy]$ ]]; then
            ENABLE_SSL=true
            read -p "Domain name: " DOMAIN_NAME
            read -p "Email for Let's Encrypt: " LE_EMAIL
        else
            ENABLE_SSL=false
        fi
    fi
    
    success "Configuration completed"
}

# Backup existing configuration
backup_config() {
    info "Creating backup of existing configuration..."
    
    if [ -f ".env" ]; then
        cp ".env" "$BACKUP_DIR/.env.backup"
        success "Backed up .env to $BACKUP_DIR"
    fi
    
    if [ -d "data" ]; then
        cp -r "data" "$BACKUP_DIR/data.backup" 2>/dev/null || true
        success "Backed up data directory"
    fi
}

# Generate environment configuration
generate_env() {
    info "Generating environment configuration..."
    
    # Backup existing .env
    [ -f ".env" ] && cp ".env" "$BACKUP_DIR/.env.backup"
    
    cat > .env << EOF
# Vexa AI Configuration - Generated $(date)
# Deployment Type: $DEPLOYMENT_TYPE

# Core API Configuration
ADMIN_API_TOKEN=$API_TOKEN
API_GATEWAY_HOST_PORT=$API_PORT
ADMIN_API_HOST_PORT=$ADMIN_PORT
TRANSCRIPTION_COLLECTOR_HOST_PORT=18123

# Database Configuration
POSTGRES_HOST_PORT=${POSTGRES_PORT:-15438}
POSTGRES_DB=vexa_db
POSTGRES_USER=vexa_user
POSTGRES_PASSWORD=vexa_secure_password

# Redis Configuration  
REDIS_PORT=${REDIS_PORT:-6379}

# Traefik Configuration (Fixed port conflict)
TRAEFIK_WEB_HOST_PORT=$TRAEFIK_PORT
TRAEFIK_DASHBOARD_HOST_PORT=18085

# WhisperLive Configuration
WHISPER_LIVE_URL=ws://whisperlive-cpu:9090
DEVICE_TYPE=$DEVICE_TYPE
WHISPER_MODEL_SIZE=medium
LANGUAGE_DETECTION_SEGMENTS=10
VAD_FILTER_THRESHOLD=0.2

# Bot Configuration
BOT_IMAGE_NAME=vexa-bot:node-proxy-fix
DEFAULT_BOT_NAME=$BOT_NAME
DEFAULT_LANGUAGE=$LANGUAGE

# Service URLs
AI_SERVICE_ADAPTER_URL=http://ai-service-adapter:8000
WEBSOCKET_PROXY_HOST=websocket-proxy
WEBSOCKET_PROXY_PORT=8090

EOF

    if [[ "$ENABLE_SSL" == "true" ]]; then
        cat >> .env << EOF

# SSL/TLS Configuration
ENABLE_SSL=true
DOMAIN_NAME=$DOMAIN_NAME
LE_EMAIL=$LE_EMAIL
EOF
    fi
    
    success "Environment configuration generated"
}

# Build and deploy services
deploy_services() {
    info "🚀 Starting Vexa services deployment..."
    
    # Stop existing services
    log "Stopping existing services..."
    docker-compose down -v 2>/dev/null || true
    
    # Build services
    log "Building Docker images..."
    if [[ "$DEVICE_TYPE" == "gpu" ]]; then
        COMPOSE_PROFILES=gpu docker-compose build --parallel
    else
        COMPOSE_PROFILES=cpu docker-compose build --parallel
    fi
    
    # Start services
    log "Starting services with $DEVICE_TYPE profile..."
    if [[ "$DEVICE_TYPE" == "gpu" ]]; then
        COMPOSE_PROFILES=gpu docker-compose up -d
    else
        COMPOSE_PROFILES=cpu docker-compose up -d
    fi
    
    success "Services deployment completed"
}

# Initialize database
init_database() {
    info "Initializing database..."
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U vexa_user -d vexa_db &>/dev/null; then
            break
        fi
        sleep 2
    done
    
    # Run migrations if available
    if docker-compose exec -T api-gateway python -c "import sys; sys.exit(0)" &>/dev/null; then
        log "Running database migrations..."
        docker-compose exec -T api-gateway python -m alembic upgrade head || warn "Migration failed or not available"
    fi
    
    success "Database initialization completed"
}

# Health check
health_check() {
    info "🏥 Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    # Define services to check
    local services=(
        "api-gateway:$API_PORT/health"
        "admin-api:$ADMIN_PORT/health"
        "transcription-collector:18123/health"
    )
    
    for service in "${services[@]}"; do
        local service_name=$(echo $service | cut -d: -f1)
        local endpoint=$(echo $service | cut -d: -f2)
        
        log "Checking $service_name..."
        attempt=1
        while [ $attempt -le $max_attempts ]; do
            if curl -f -s "http://localhost:$endpoint" >/dev/null 2>&1; then
                success "$service_name is healthy"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                warn "$service_name health check failed after $max_attempts attempts"
            else
                sleep 5
                ((attempt++))
            fi
        done
    done
    
    # Check Docker services
    log "Checking Docker services status..."
    docker-compose ps
    
    success "Health checks completed"
}

# Generate test bot deployment
generate_test_bot() {
    info "📝 Generating test bot deployment script..."
    
cat > test-bot-deployment.sh << EOF
#!/bin/bash
# Test Bot Deployment Script - Generated $(date)

echo "🤖 Testing Vexa Bot Deployment"

# Test API connectivity
echo "Testing API connectivity..."
curl -f http://localhost:$API_PORT/health || { echo "API Gateway not responding"; exit 1; }

# Deploy test bot (requires actual Teams meeting URL)
echo "To deploy a bot to your meeting, use:"
echo
echo "curl -X POST http://localhost:$API_PORT/bots \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'X-API-Key: $API_TOKEN' \\"
echo "  -d '{"
echo "    \"platform\": \"teams\","
echo "    \"native_meeting_id\": \"your_meeting_id\","
echo "    \"meeting_url\": \"https://teams.microsoft.com/l/meetup-join/...\","
echo "    \"bot_name\": \"$BOT_NAME\","
echo "    \"language\": \"$LANGUAGE\","
echo "    \"task\": \"transcribe\""
echo "  }'"
echo
echo "Then retrieve transcripts with:"
echo "curl -H 'X-API-Key: $API_TOKEN' \\"
echo "  http://localhost:$API_PORT/transcripts/teams/your_meeting_id"
EOF

    chmod +x test-bot-deployment.sh
    success "Test bot deployment script created: test-bot-deployment.sh"
}

# Display deployment summary
deployment_summary() {
    echo
    echo -e "${GREEN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                   🎉 DEPLOYMENT COMPLETED                       ║
╚══════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    log "${CYAN}📊 Deployment Summary:${NC}"
    log "  • Deployment Type: $DEPLOYMENT_TYPE"
    log "  • Device Type: $DEVICE_TYPE"
    log "  • API Gateway: http://localhost:$API_PORT"
    log "  • Admin API: http://localhost:$ADMIN_PORT"
    log "  • Traefik Dashboard: http://localhost:$TRAEFIK_PORT"
    log "  • Default Bot Name: $BOT_NAME"
    log "  • Default Language: $LANGUAGE"
    
    echo
    log "${CYAN}🔗 Service Endpoints:${NC}"
    log "  • API Documentation: http://localhost:$API_PORT/docs"
    log "  • Admin Documentation: http://localhost:$ADMIN_PORT/docs"
    log "  • Health Monitor: http://localhost:19000/status"
    
    echo
    log "${CYAN}🚀 Next Steps:${NC}"
    log "  1. Test API: curl http://localhost:$API_PORT/health"
    log "  2. Run test bot: ./test-bot-deployment.sh"
    log "  3. Check logs: docker-compose logs -f"
    log "  4. Deploy to meeting: See API documentation"
    
    echo
    log "${CYAN}📚 Documentation:${NC}"
    log "  • Troubleshooting: TROUBLESHOOTING.md"
    log "  • Quick fixes: DEPLOYMENT-QUICK-FIX.md"
    log "  • Main README: README.md"
    
    echo
    log "${YELLOW}💾 Backup created in: $BACKUP_DIR${NC}"
    log "${YELLOW}📋 Deployment log: $LOG_FILE${NC}"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        error_exit "Deployment failed! Check $LOG_FILE for details."
    fi
}

# Main deployment flow
main() {
    trap cleanup EXIT
    
    log "${BLUE}🚀 Starting Vexa AI deployment at $(date)${NC}"
    
    check_prerequisites
    configure_deployment
    backup_config
    generate_env
    deploy_services
    init_database
    health_check
    generate_test_bot
    deployment_summary
    
    success "🎉 Vexa AI stack deployed successfully!"
}

# Script help
show_help() {
    cat << EOF
Vexa AI Deployment Script

Usage: $0 [OPTIONS]

Options:
    -h, --help          Show this help message
    -q, --quiet         Suppress interactive prompts (use defaults)
    -f, --force         Force deployment (skip confirmations)
    --device TYPE       Set device type (cpu/gpu)
    --bot-name NAME     Set default bot name
    --api-token TOKEN   Set API authentication token

Examples:
    $0                                 # Interactive deployment
    $0 --quiet --device cpu            # Quick CPU deployment
    $0 --force --bot-name "MyBot"      # Force deployment with custom bot name

For troubleshooting, see TROUBLESHOOTING.md
EOF
}

# Command line argument parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -q|--quiet)
            QUIET_MODE=true
            shift
            ;;
        -f|--force)
            FORCE_MODE=true
            shift
            ;;
        --device)
            DEVICE_TYPE="$2"
            shift 2
            ;;
        --bot-name)
            BOT_NAME="$2"
            shift 2
            ;;
        --api-token)
            API_TOKEN="$2"
            shift 2
            ;;
        *)
            error_exit "Unknown option: $1. Use --help for usage information."
            ;;
    esac
done

# Run main function
main

exit 0