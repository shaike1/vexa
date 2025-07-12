#!/bin/bash

# Quick Cloudflare Setup Script
# Simplified version for immediate setup

echo "🚀 Quick Cloudflare DNS Setup for vexa.5173322.xyz"
echo "================================================="

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Installing jq..."
    sudo apt-get update && sudo apt-get install -y jq
fi

# Get Cloudflare credentials
echo "📝 You need:"
echo "1. Cloudflare API Token (Zone:Edit permissions)"
echo "2. Get it from: https://dash.cloudflare.com/profile/api-tokens"
echo ""
read -p "Enter your Cloudflare API Token: " CF_API_TOKEN
echo ""

# Get Zone ID for 5173322.xyz
echo "🔍 Getting Zone ID..."
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=5173322.xyz" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" | jq -r '.result[0].id')

if [ "$ZONE_ID" = "null" ] || [ -z "$ZONE_ID" ]; then
    echo "❌ Could not find zone for 5173322.xyz"
    echo "Make sure the domain is added to your Cloudflare account"
    exit 1
fi

echo "✅ Zone ID: $ZONE_ID"

# Get tunnel ID from running service
echo "🔍 Getting Tunnel ID..."
TUNNEL_TOKEN=$(sudo systemctl status cloudflared 2>/dev/null | grep -o 'eyJ[^[:space:]]*' | head -1)
TUNNEL_ID=$(echo "$TUNNEL_TOKEN" | base64 -d 2>/dev/null | jq -r '.t' 2>/dev/null)

if [ -z "$TUNNEL_ID" ] || [ "$TUNNEL_ID" = "null" ]; then
    echo "❌ Could not get tunnel ID from running service"
    exit 1
fi

echo "✅ Tunnel ID: $TUNNEL_ID"

# Create DNS records
echo "📝 Creating DNS records..."
TARGET="$TUNNEL_ID.cfargotunnel.com"

# Array of subdomains to create
declare -a subdomains=("vexa" "admin.vexa" "transcripts.vexa" "traefik.vexa")

for subdomain in "${subdomains[@]}"; do
    echo "Creating $subdomain.5173322.xyz → $TARGET"
    
    RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
            \"type\": \"CNAME\",
            \"name\": \"$subdomain\",
            \"content\": \"$TARGET\",
            \"ttl\": 300,
            \"proxied\": true
        }")
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
        echo "✅ $subdomain.5173322.xyz created"
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].message // "Unknown error"')
        echo "⚠️  $subdomain.5173322.xyz - $ERROR"
    fi
done

echo ""
echo "🎉 DNS Records Created!"
echo "======================="
echo ""
echo "📋 NEXT: Configure tunnel ingress rules manually:"
echo "1. Go to: https://one.dash.cloudflare.com/"
echo "2. Navigate to: Zero Trust → Networks → Tunnels"
echo "3. Click your tunnel → Public Hostnames tab"
echo "4. Add these routes:"
echo ""
echo "   vexa.5173322.xyz          → http://localhost:18056"
echo "   admin.vexa.5173322.xyz    → http://localhost:18057"
echo "   transcripts.vexa.5173322.xyz → http://localhost:18123"
echo "   traefik.vexa.5173322.xyz  → http://localhost:18085"
echo ""
echo "🌐 Your APIs will be available at:"
echo "   • https://vexa.5173322.xyz (Main API)"
echo "   • https://admin.vexa.5173322.xyz (Admin API)"
echo "   • https://transcripts.vexa.5173322.xyz (Transcripts)"
echo ""
echo "⏱️  DNS propagation takes 2-5 minutes"