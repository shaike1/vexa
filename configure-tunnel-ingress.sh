#!/bin/bash

# Configure Cloudflare Tunnel Ingress Rules via API
set -e

# Configuration
CF_API_TOKEN="h7HknzxAAmg-uJMZwJSp6SgxM5dmbhINunn_1QGH"
TUNNEL_ID="67b2b5bf-a619-413f-bc67-f8ecb42df818"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚇 Configuring Cloudflare Tunnel Ingress Rules${NC}"
echo "=============================================="

# First, get the account ID
echo -e "${YELLOW}🔍 Getting Account ID...${NC}"
ACCOUNT_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" | jq -r '.result[0].id')

if [ "$ACCOUNT_ID" = "null" ] || [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Could not get account ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Account ID: $ACCOUNT_ID${NC}"

# Configure ingress rules
echo -e "${YELLOW}📝 Configuring ingress rules...${NC}"

# Create the ingress configuration
INGRESS_CONFIG='{
  "config": {
    "ingress": [
      {
        "hostname": "vexa.5173322.xyz",
        "service": "http://localhost:18056",
        "originRequest": {
          "httpHostHeader": "vexa.5173322.xyz",
          "connectTimeout": "30s",
          "tlsTimeout": "10s",
          "keepAliveConnections": 100,
          "keepAliveTimeout": "90s"
        }
      },
      {
        "hostname": "admin.vexa.5173322.xyz",
        "service": "http://localhost:18057",
        "originRequest": {
          "httpHostHeader": "admin.vexa.5173322.xyz",
          "connectTimeout": "30s",
          "tlsTimeout": "10s",
          "keepAliveConnections": 100,
          "keepAliveTimeout": "90s"
        }
      },
      {
        "hostname": "transcripts.vexa.5173322.xyz",
        "service": "http://localhost:18123",
        "originRequest": {
          "httpHostHeader": "transcripts.vexa.5173322.xyz",
          "connectTimeout": "30s",
          "tlsTimeout": "10s",
          "keepAliveConnections": 100,
          "keepAliveTimeout": "90s"
        }
      },
      {
        "hostname": "traefik.vexa.5173322.xyz",
        "service": "http://localhost:18085",
        "originRequest": {
          "httpHostHeader": "traefik.vexa.5173322.xyz",
          "connectTimeout": "30s",
          "tlsTimeout": "10s",
          "keepAliveConnections": 100,
          "keepAliveTimeout": "90s"
        }
      },
      {
        "service": "http_status:404"
      }
    ]
  }
}'

# Update tunnel configuration
echo -e "${YELLOW}🔧 Updating tunnel configuration...${NC}"
RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$INGRESS_CONFIG")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Tunnel ingress rules configured successfully!${NC}"
    
    echo -e "\n${GREEN}🎉 Configuration Complete!${NC}"
    echo "========================="
    echo "Your APIs are now accessible at:"
    echo "• https://vexa.5173322.xyz (Main API)"
    echo "• https://admin.vexa.5173322.xyz (Admin API)" 
    echo "• https://transcripts.vexa.5173322.xyz (Transcripts)"
    echo "• https://traefik.vexa.5173322.xyz (Traefik Dashboard)"
    
    echo -e "\n${YELLOW}⏱️  Please wait 30-60 seconds for changes to propagate...${NC}"
    
else
    echo -e "${RED}❌ Failed to configure tunnel${NC}"
    ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].message // "Unknown error"')
    echo -e "${RED}Error: $ERROR${NC}"
    echo -e "\n${YELLOW}Response:${NC}"
    echo "$RESPONSE" | jq .
    exit 1
fi

# Wait and test
echo -e "\n${YELLOW}🧪 Testing endpoints in 60 seconds...${NC}"
sleep 60

echo -e "${YELLOW}Testing endpoints...${NC}"

test_endpoint() {
    local url=$1
    local name=$2
    echo -n "Testing $name ... "
    
    if curl -s -f -m 10 "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
}

test_endpoint "https://vexa.5173322.xyz/health" "Main API Health"
test_endpoint "https://admin.vexa.5173322.xyz/health" "Admin API Health"
test_endpoint "https://transcripts.vexa.5173322.xyz/health" "Transcripts Health"

echo -e "\n${GREEN}🚀 Setup Complete! Your Vexa API is live!${NC}"