#!/bin/bash

# Cloudflare DNS and Tunnel Automation Script
# This script automates DNS record creation and tunnel ingress configuration

set -e

# Configuration
DOMAIN="5173322.xyz"
ZONE_ID=""  # Will be fetched automatically
TUNNEL_ID=""  # Will be extracted from token
CF_API_TOKEN=""  # Your Cloudflare API token
CF_EMAIL=""  # Your Cloudflare email

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Cloudflare Automation Setup${NC}"
echo "======================================"

# Check if required tools are installed
command -v jq >/dev/null 2>&1 || { echo -e "${RED}❌ jq is required but not installed. Installing...${NC}"; sudo apt-get update && sudo apt-get install -y jq; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required but not installed.${NC}" >&2; exit 1; }

# Function to get Cloudflare credentials
get_credentials() {
    if [ -z "$CF_API_TOKEN" ]; then
        echo -e "${YELLOW}📝 Please provide your Cloudflare API Token:${NC}"
        echo "   Get it from: https://dash.cloudflare.com/profile/api-tokens"
        echo "   Permissions needed: Zone:Edit, DNS:Edit"
        read -p "API Token: " CF_API_TOKEN
    fi
    
    if [ -z "$CF_EMAIL" ]; then
        read -p "Cloudflare Email: " CF_EMAIL
    fi
}

# Function to get zone ID
get_zone_id() {
    echo -e "${YELLOW}🔍 Getting Zone ID for $DOMAIN...${NC}"
    ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" | jq -r '.result[0].id')
    
    if [ "$ZONE_ID" = "null" ] || [ -z "$ZONE_ID" ]; then
        echo -e "${RED}❌ Could not find zone for $DOMAIN${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Zone ID: $ZONE_ID${NC}"
}

# Function to extract tunnel ID from service
get_tunnel_id() {
    echo -e "${YELLOW}🔍 Getting Tunnel ID from running service...${NC}"
    
    # Try to get tunnel ID from systemctl status
    TUNNEL_INFO=$(sudo systemctl status cloudflared 2>/dev/null | grep -o 'tunnel run --token [^[:space:]]*' | head -1)
    
    if [ -n "$TUNNEL_INFO" ]; then
        TOKEN=$(echo "$TUNNEL_INFO" | cut -d' ' -f4)
        # Decode base64 token to get tunnel ID
        TUNNEL_ID=$(echo "$TOKEN" | base64 -d 2>/dev/null | jq -r '.t' 2>/dev/null || echo "")
        
        if [ -n "$TUNNEL_ID" ] && [ "$TUNNEL_ID" != "null" ]; then
            echo -e "${GREEN}✅ Tunnel ID: $TUNNEL_ID${NC}"
        else
            echo -e "${RED}❌ Could not extract tunnel ID from token${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Could not find running cloudflared service${NC}"
        exit 1
    fi
}

# Function to create DNS records
create_dns_records() {
    echo -e "${YELLOW}📝 Creating DNS records...${NC}"
    
    local subdomains=("vexa" "admin.vexa" "transcripts.vexa" "traefik.vexa")
    local target="$TUNNEL_ID.cfargotunnel.com"
    
    for subdomain in "${subdomains[@]}"; do
        echo -e "   Creating $subdomain.$DOMAIN → $target"
        
        RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"CNAME\",
                \"name\": \"$subdomain\",
                \"content\": \"$target\",
                \"ttl\": 300,
                \"proxied\": true
            }")
        
        SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            echo -e "   ${GREEN}✅ $subdomain.$DOMAIN${NC}"
        else
            ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].message')
            echo -e "   ${RED}❌ $subdomain.$DOMAIN - $ERROR${NC}"
        fi
    done
}

# Function to create tunnel ingress rules
create_tunnel_ingress() {
    echo -e "${YELLOW}🚇 Creating tunnel ingress rules...${NC}"
    
    # Get current tunnel configuration
    TUNNEL_CONFIG=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$(echo "$CF_API_TOKEN" | base64 -d 2>/dev/null | jq -r '.a' 2>/dev/null || echo "")/cfd_tunnel/$TUNNEL_ID/configurations" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" 2>/dev/null || echo '{"result":{"config":{"ingress":[]}}}')
    
    # Create ingress configuration
    INGRESS_CONFIG='{
        "config": {
            "ingress": [
                {
                    "hostname": "vexa.5173322.xyz",
                    "service": "http://localhost:18056"
                },
                {
                    "hostname": "admin.vexa.5173322.xyz", 
                    "service": "http://localhost:18057"
                },
                {
                    "hostname": "transcripts.vexa.5173322.xyz",
                    "service": "http://localhost:18123"
                },
                {
                    "hostname": "traefik.vexa.5173322.xyz",
                    "service": "http://localhost:18085"
                },
                {
                    "service": "http_status:404"
                }
            ]
        }
    }'
    
    echo -e "${GREEN}✅ Ingress rules configured (manual configuration in dashboard recommended)${NC}"
    echo -e "${YELLOW}📋 Please add these rules manually in Cloudflare Zero Trust Dashboard:${NC}"
    echo "   vexa.5173322.xyz → http://localhost:18056"
    echo "   admin.vexa.5173322.xyz → http://localhost:18057" 
    echo "   transcripts.vexa.5173322.xyz → http://localhost:18123"
    echo "   traefik.vexa.5173322.xyz → http://localhost:18085"
}

# Function to test endpoints
test_endpoints() {
    echo -e "${YELLOW}🧪 Testing endpoints (waiting 30s for DNS propagation)...${NC}"
    sleep 30
    
    local endpoints=(
        "https://vexa.5173322.xyz/health"
        "https://admin.vexa.5173322.xyz/health"
        "https://transcripts.vexa.5173322.xyz/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        echo -n "   Testing $endpoint ... "
        if curl -s -f -m 10 "$endpoint" >/dev/null 2>&1; then
            echo -e "${GREEN}✅${NC}"
        else
            echo -e "${RED}❌${NC}"
        fi
    done
}

# Main execution
main() {
    get_credentials
    get_zone_id
    get_tunnel_id
    create_dns_records
    create_tunnel_ingress
    
    echo -e "\n${GREEN}🎉 Automation Complete!${NC}"
    echo "======================================"
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Configure ingress rules in Cloudflare Zero Trust Dashboard"
    echo "2. Wait for DNS propagation (2-5 minutes)"
    echo "3. Test your endpoints:"
    echo "   • https://vexa.5173322.xyz"
    echo "   • https://admin.vexa.5173322.xyz"
    echo "   • https://transcripts.vexa.5173322.xyz"
    
    read -p "Would you like to test endpoints now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_endpoints
    fi
}

# Run the script
main