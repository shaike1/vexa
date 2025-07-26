#!/bin/bash

# VexaAI Native Teams Bot Deployment Script
# This script sets up and deploys the native Teams bot

set -e

echo "🚀 VexaAI Native Teams Bot Deployment"
echo "====================================="

# Configuration
PROJECT_DIR="/root/vexa/native-teams-bot/VexaSpeakerBot"
MANIFEST_DIR="/root/vexa/native-teams-bot/teams-manifest"
SERVICE_NAME="vexa-teams-bot"

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

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check .NET
    if ! command -v dotnet &> /dev/null; then
        log_error ".NET SDK not found. Please install .NET 6.0 SDK"
        exit 1
    fi
    log_success ".NET SDK found: $(dotnet --version)"
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        log_warning "Redis CLI not found. Make sure Redis server is running"
    else
        if redis-cli ping &> /dev/null; then
            log_success "Redis server is running"
        else
            log_warning "Redis server not responding"
        fi
    fi
    
    # Check Node.js (for testing)
    if ! command -v node &> /dev/null; then
        log_warning "Node.js not found. Testing scripts won't work"
    else
        log_success "Node.js found: $(node --version)"
    fi
}

# Function to build the bot
build_bot() {
    log_info "Building native Teams bot..."
    
    cd "$PROJECT_DIR"
    
    # Restore packages
    log_info "Restoring NuGet packages..."
    dotnet restore
    
    # Build project
    log_info "Building project..."
    dotnet build --configuration Release --no-restore
    
    log_success "Bot built successfully"
}

# Function to configure environment
configure_environment() {
    log_info "Configuring environment..."
    
    # Check if appsettings.json has been configured
    local config_file="$PROJECT_DIR/appsettings.json"
    
    if [ -f "$config_file" ]; then
        # Check if placeholders are still in use
        if grep -q "INSERT_YOUR" "$config_file" || grep -q '""' "$config_file"; then
            log_warning "Configuration contains placeholders. Please update appsettings.json with your Azure credentials"
            log_info "Required fields:"
            echo "  - MicrosoftAppId"
            echo "  - MicrosoftAppPassword"
            echo "  - MicrosoftAppTenantId"
            echo "  - AzureSpeech.Key"
            echo "  - AzureSpeech.Region"
        else
            log_success "Configuration appears to be set up"
        fi
    else
        log_error "appsettings.json not found"
        exit 1
    fi
}

# Function to test the bot
test_bot() {
    log_info "Running integration tests..."
    
    # Run integration test if Node.js is available
    if command -v node &> /dev/null; then
        cd /root/vexa/services/vexa-bot/core
        if [ -f "test-full-integration.js" ]; then
            node test-full-integration.js
            log_success "Integration tests completed"
        else
            log_warning "Integration test script not found"
        fi
    else
        log_warning "Skipping tests - Node.js not available"
    fi
}

# Function to start the bot in development mode
start_dev() {
    log_info "Starting bot in development mode..."
    
    cd "$PROJECT_DIR"
    
    log_info "Bot will start on https://localhost:5001"
    log_info "For Teams integration, use ngrok: ngrok http 5001"
    log_info "Press Ctrl+C to stop the bot"
    
    dotnet run
}

# Function to create systemd service (for production)
create_service() {
    log_info "Creating systemd service..."
    
    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
    local working_dir="$PROJECT_DIR"
    local exec_start="$working_dir/bin/Release/net6.0/VexaSpeakerBot"
    
    # Build if not already built
    if [ ! -f "$exec_start" ]; then
        log_info "Release build not found, building..."
        build_bot
    fi
    
    # Create service file
    sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=VexaAI Native Teams Bot
After=network.target

[Service]
Type=notify
ExecStart=$exec_start
WorkingDirectory=$working_dir
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=$SERVICE_NAME
User=$USER
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://localhost:5000;https://localhost:5001

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    
    log_success "Systemd service created: $SERVICE_NAME"
    log_info "Use 'sudo systemctl start $SERVICE_NAME' to start the service"
    log_info "Use 'sudo systemctl status $SERVICE_NAME' to check status"
}

# Function to show deployment status
show_status() {
    log_info "Deployment Status:"
    
    echo "📁 Project Directory: $PROJECT_DIR"
    echo "📦 Teams Manifest: $MANIFEST_DIR"
    
    if [ -f "$PROJECT_DIR/bin/Release/net6.0/VexaSpeakerBot.dll" ]; then
        echo "🔨 Build Status: Ready"
    else
        echo "🔨 Build Status: Not built"
    fi
    
    if systemctl is-enabled "$SERVICE_NAME" &> /dev/null; then
        echo "🔧 Service Status: Enabled"
        if systemctl is-active "$SERVICE_NAME" &> /dev/null; then
            echo "🟢 Service Running: Yes"
        else
            echo "🔴 Service Running: No"
        fi
    else
        echo "🔧 Service Status: Not configured"
    fi
    
    echo ""
    log_info "Next Steps:"
    echo "1. Configure Azure credentials in appsettings.json"
    echo "2. Update Teams manifest with your App ID"
    echo "3. Build and test the bot: ./deploy.sh build && ./deploy.sh test"
    echo "4. Deploy to production: ./deploy.sh service"
    echo "5. Start the service: sudo systemctl start $SERVICE_NAME"
}

# Main script logic
case "${1:-help}" in
    "check")
        check_prerequisites
        ;;
    "build")
        check_prerequisites
        build_bot
        ;;
    "configure")
        configure_environment
        ;;
    "test")
        test_bot
        ;;
    "dev")
        check_prerequisites
        build_bot
        configure_environment
        start_dev
        ;;
    "service")
        check_prerequisites
        build_bot
        create_service
        ;;
    "status")
        show_status
        ;;
    "help"|*)
        echo "VexaAI Native Teams Bot Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  check      - Check prerequisites"
        echo "  build      - Build the bot"
        echo "  configure  - Check configuration"
        echo "  test       - Run integration tests"
        echo "  dev        - Start in development mode"
        echo "  service    - Create systemd service"
        echo "  status     - Show deployment status"
        echo "  help       - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 check           # Check if everything is installed"
        echo "  $0 build           # Build the bot"
        echo "  $0 dev             # Start for development with ngrok"
        echo "  $0 service         # Deploy as production service"
        ;;
esac