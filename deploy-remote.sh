#!/bin/bash

# Vexa AI Remote Deployment Script
# Deploy Vexa stack to remote servers via SSH

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                 🌐 VEXA AI REMOTE DEPLOYMENT                    ║
║            Deploy to remote servers via SSH/SCP                 ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Default configuration
REMOTE_USER="root"
REMOTE_PORT="22"
REMOTE_DIR="/opt/vexa"
DEPLOYMENT_SCRIPT="./deploy-vexa.sh"

# Logging
log() {
    echo -e "$1"
}

error_exit() {
    log "${RED}❌ ERROR: $1${NC}"
    exit 1
}

success() {
    log "${GREEN}✅ $1${NC}"
}

info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites for remote deployment..."
    
    # Check if SSH is available
    if ! command -v ssh &> /dev/null; then
        error_exit "SSH client is not installed."
    fi
    
    # Check if SCP is available
    if ! command -v scp &> /dev/null; then
        error_exit "SCP is not available."
    fi
    
    # Check if deployment script exists
    if [ ! -f "$DEPLOYMENT_SCRIPT" ]; then
        error_exit "Local deployment script not found: $DEPLOYMENT_SCRIPT"
    fi
    
    success "Prerequisites check passed"
}

# Get remote server details
configure_remote() {
    info "🌐 Remote Server Configuration"
    echo
    
    read -p "Remote server IP/hostname: " REMOTE_HOST
    [ -z "$REMOTE_HOST" ] && error_exit "Remote host is required"
    
    read -p "SSH username [$REMOTE_USER]: " input_user
    REMOTE_USER=${input_user:-$REMOTE_USER}
    
    read -p "SSH port [$REMOTE_PORT]: " input_port
    REMOTE_PORT=${input_port:-$REMOTE_PORT}
    
    read -p "Remote deployment directory [$REMOTE_DIR]: " input_dir
    REMOTE_DIR=${input_dir:-$REMOTE_DIR}
    
    # SSH key configuration
    read -p "SSH private key file (leave empty for default): " SSH_KEY
    if [ -n "$SSH_KEY" ]; then
        [ ! -f "$SSH_KEY" ] && error_exit "SSH key file not found: $SSH_KEY"
        SSH_OPTIONS="-i $SSH_KEY"
    else
        SSH_OPTIONS=""
    fi
    
    # Test SSH connection
    info "Testing SSH connection to $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT..."
    if ! ssh $SSH_OPTIONS -p $REMOTE_PORT -o ConnectTimeout=10 -o BatchMode=yes $REMOTE_USER@$REMOTE_HOST "echo 'SSH connection successful'" 2>/dev/null; then
        error_exit "Cannot connect to remote server. Please check SSH configuration."
    fi
    
    success "SSH connection verified"
}

# Transfer files to remote server
transfer_files() {
    info "📤 Transferring files to remote server..."
    
    # Create remote directory
    ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR"
    
    # Create list of files to transfer
    local transfer_files=(
        "deploy-vexa.sh"
        "docker-compose.yml"
        "Makefile"
        "env-example.cpu"
        "env-example.gpu"
        "TROUBLESHOOTING.md"
        "DEPLOYMENT-QUICK-FIX.md"
        "README.md"
    )
    
    # Transfer core files
    for file in "${transfer_files[@]}"; do
        if [ -f "$file" ]; then
            info "Transferring $file..."
            scp $SSH_OPTIONS -P $REMOTE_PORT "$file" $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/
        else
            log "${YELLOW}⚠️  File not found: $file (skipping)${NC}"
        fi
    done
    
    # Transfer services directory
    if [ -d "services" ]; then
        info "Transferring services directory..."
        scp $SSH_OPTIONS -P $REMOTE_PORT -r "services" $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/
    fi
    
    # Transfer libs directory if it exists
    if [ -d "libs" ]; then
        info "Transferring libs directory..."
        scp $SSH_OPTIONS -P $REMOTE_PORT -r "libs" $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/
    fi
    
    # Make deployment script executable
    ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "chmod +x $REMOTE_DIR/deploy-vexa.sh"
    
    success "File transfer completed"
}

# Remote deployment execution
execute_remote_deployment() {
    info "🚀 Executing deployment on remote server..."
    
    # Get deployment options
    echo
    log "${CYAN}Deployment Options:${NC}"
    read -p "Device type (cpu/gpu) [cpu]: " device_type
    device_type=${device_type:-cpu}
    
    read -p "Bot name [VexaAI-Remote]: " bot_name
    bot_name=${bot_name:-VexaAI-Remote}
    
    read -p "API token [token]: " api_token
    api_token=${api_token:-token}
    
    # Prepare deployment command
    local deploy_cmd="cd $REMOTE_DIR && ./deploy-vexa.sh --quiet --device $device_type --bot-name '$bot_name' --api-token '$api_token'"
    
    # Execute deployment
    log "Executing: $deploy_cmd"
    echo
    
    ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "$deploy_cmd" || error_exit "Remote deployment failed"
    
    success "Remote deployment completed"
}

# Verify remote deployment
verify_deployment() {
    info "🔍 Verifying remote deployment..."
    
    # Check if services are running
    local check_cmd="cd $REMOTE_DIR && docker-compose ps && curl -f http://localhost:18056/health"
    
    if ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "$check_cmd" 2>/dev/null; then
        success "Remote deployment verification passed"
        
        echo
        log "${GREEN}🎉 Remote Deployment Summary:${NC}"
        log "  • Server: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT"
        log "  • Directory: $REMOTE_DIR"
        log "  • API Gateway: http://$REMOTE_HOST:18056"
        log "  • Admin API: http://$REMOTE_HOST:18057"
        log "  • Bot Name: $bot_name"
        
        echo
        log "${CYAN}🔗 Remote Access:${NC}"
        log "  • SSH: ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
        log "  • Logs: ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR && docker-compose logs -f'"
        log "  • Status: ssh $SSH_OPTIONS -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR && docker-compose ps'"
        
    else
        error_exit "Remote deployment verification failed"
    fi
}

# Show help
show_help() {
    cat << EOF
Vexa AI Remote Deployment Script

Usage: $0 [OPTIONS]

This script deploys the Vexa AI stack to a remote server via SSH.

Prerequisites:
  • SSH access to remote server
  • Docker and Docker Compose installed on remote server
  • Sufficient disk space (>10GB) on remote server

Options:
    -h, --help          Show this help message
    --host HOST         Remote server hostname/IP
    --user USER         SSH username (default: root)
    --port PORT         SSH port (default: 22)
    --key KEYFILE       SSH private key file
    --dir DIRECTORY     Remote deployment directory (default: /opt/vexa)

Examples:
    $0                                      # Interactive deployment
    $0 --host 192.168.1.100 --user ubuntu  # Deploy to specific server
    $0 --host server.com --key ~/.ssh/key   # Use specific SSH key

The script will:
  1. Test SSH connectivity
  2. Transfer all necessary files
  3. Execute the deployment script remotely
  4. Verify the deployment

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
        --host)
            REMOTE_HOST="$2"
            shift 2
            ;;
        --user)
            REMOTE_USER="$2"
            shift 2
            ;;
        --port)
            REMOTE_PORT="$2"
            shift 2
            ;;
        --key)
            SSH_KEY="$2"
            SSH_OPTIONS="-i $SSH_KEY"
            shift 2
            ;;
        --dir)
            REMOTE_DIR="$2"
            shift 2
            ;;
        *)
            error_exit "Unknown option: $1. Use --help for usage information."
            ;;
    esac
done

# Main execution
main() {
    log "${BLUE}🚀 Starting Vexa AI remote deployment$(date)${NC}"
    
    check_prerequisites
    
    if [ -z "$REMOTE_HOST" ]; then
        configure_remote
    else
        info "Using provided remote configuration: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT"
    fi
    
    transfer_files
    execute_remote_deployment
    verify_deployment
    
    success "🎉 Remote deployment completed successfully!"
}

# Run main function
main

exit 0