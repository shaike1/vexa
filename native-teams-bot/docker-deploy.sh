#!/bin/bash

# VexaAI Native Teams Bot Docker Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Docker and Docker Compose are installed"
}

# Build the Docker image
build_image() {
    log_info "Building VexaAI Native Teams Bot Docker image..."
    
    # Stop existing services first
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build the image
    docker-compose build --no-cache
    
    log_success "Docker image built successfully"
}

# Start the services
start_services() {
    log_info "Starting VexaAI Native Teams Bot services..."
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        log_warning ".env file not found. Using default configuration."
        log_info "Create .env file from .env.example for production deployment"
    fi
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    check_health
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    # Check Redis
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis is healthy"
    else
        log_error "Redis is not responding"
        return 1
    fi
    
    # Check Teams Bot
    if curl -s -f http://localhost:5000/api/messages > /dev/null 2>&1; then
        log_success "Teams Bot is healthy and responding"
    else
        log_warning "Teams Bot might still be starting up..."
        sleep 5
        if curl -s -f http://localhost:5000/api/messages > /dev/null 2>&1; then
            log_success "Teams Bot is now healthy"
        else
            log_error "Teams Bot is not responding"
            return 1
        fi
    fi
}

# Test the deployment
test_deployment() {
    log_info "Testing Docker deployment..."
    
    # Test Redis connection
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log_success "Redis connection test passed"
    else
        log_error "Redis connection test failed"
        return 1
    fi
    
    # Test bot API endpoint
    if curl -s -I http://localhost:5000/api/messages | grep -q "405"; then
        log_success "Bot API endpoint test passed"
    else
        log_error "Bot API endpoint test failed"
        return 1
    fi
    
    # Test Redis command sending
    log_info "Testing Redis command integration..."
    
    # Send test command
    docker-compose exec -T redis redis-cli publish bot_commands:working-speaker '{"action":"speak","message":"Docker deployment test successful"}'
    
    log_success "Docker deployment test completed successfully"
}

# Show logs
show_logs() {
    log_info "Showing service logs..."
    docker-compose logs --tail=50 -f
}

# Show status
show_status() {
    log_info "Docker Deployment Status:"
    echo ""
    
    # Show running containers
    docker-compose ps
    echo ""
    
    # Show service health
    log_info "Service Health:"
    
    # Redis health
    if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "🟢 Redis: Healthy"
    else
        echo "🔴 Redis: Unhealthy"
    fi
    
    # Bot health
    if curl -s -f http://localhost:5000/api/messages > /dev/null 2>&1; then
        echo "🟢 Teams Bot: Healthy"
    else
        echo "🔴 Teams Bot: Unhealthy"
    fi
    
    echo ""
    log_info "Exposed Ports:"
    echo "  - Teams Bot: http://localhost:5000, https://localhost:5001"
    echo "  - Redis: localhost:6379"
}

# Stop services
stop_services() {
    log_info "Stopping VexaAI Native Teams Bot services..."
    docker-compose down
    log_success "Services stopped"
}

# Clean up everything
cleanup() {
    log_info "Cleaning up Docker resources..."
    docker-compose down --volumes --remove-orphans
    docker system prune -f
    log_success "Cleanup completed"
}

# Update existing deployment
update_deployment() {
    log_info "Updating VexaAI Native Teams Bot deployment..."
    
    # Pull latest changes and rebuild
    build_image
    
    # Restart services
    docker-compose up -d
    
    # Wait and check health
    sleep 10
    check_health
    
    log_success "Deployment updated successfully"
}

# Main script logic
case "${1:-help}" in
    "build")
        check_docker
        build_image
        ;;
    "start")
        check_docker
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        start_services
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "test")
        test_deployment
        ;;
    "update")
        update_deployment
        ;;
    "clean")
        cleanup
        ;;
    "deploy")
        check_docker
        build_image
        start_services
        test_deployment
        ;;
    "help"|*)
        echo "VexaAI Native Teams Bot Docker Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build      - Build Docker image"
        echo "  start      - Start services"
        echo "  stop       - Stop services"
        echo "  restart    - Restart services"
        echo "  logs       - Show service logs"
        echo "  status     - Show deployment status"
        echo "  test       - Test deployment"
        echo "  update     - Update deployment"
        echo "  clean      - Clean up all resources"
        echo "  deploy     - Complete deployment (build + start + test)"
        echo "  help       - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 deploy          # Complete deployment"
        echo "  $0 start           # Start services"
        echo "  $0 logs            # View logs"
        echo "  $0 status          # Check status"
        echo ""
        echo "Configuration:"
        echo "  Copy .env.example to .env and update with your Azure credentials"
        ;;
esac