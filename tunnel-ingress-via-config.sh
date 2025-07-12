#!/bin/bash

# Alternative approach: Configure tunnel via service restart with ingress
set -e

echo "🔧 Configuring Cloudflare Tunnel with Ingress Rules"
echo "=================================================="

# Stop the current service
echo "⏹️  Stopping current cloudflared service..."
sudo systemctl stop cloudflared

# Remove the current service
echo "🗑️  Removing current service installation..."
sudo cloudflared service uninstall 2>/dev/null || true

# Create a new configuration file with ingress rules
echo "📝 Creating tunnel configuration with ingress rules..."
sudo mkdir -p /etc/cloudflared

cat << 'EOF' | sudo tee /etc/cloudflared/config.yml
tunnel: 67b2b5bf-a619-413f-bc67-f8ecb42df818
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: vexa.5173322.xyz
    service: http://localhost:18056
  - hostname: admin.vexa.5173322.xyz  
    service: http://localhost:18057
  - hostname: transcripts.vexa.5173322.xyz
    service: http://localhost:18123
  - hostname: traefik.vexa.5173322.xyz
    service: http://localhost:18085
  - service: http_status:404
EOF

# Create credentials from token
echo "🔑 Creating credentials file from token..."
TOKEN="eyJhIjoiMWUzMzMwZjI0OTY4OTg4ZDIyMzMxMDNiZjA4NzE4NjUiLCJ0IjoiNjdiMmI1YmYtYTYxOS00MTNmLWJjNjctZjhlY2I0MmRmODE4IiwicyI6IlpUUXhOVEEzWTJVdFl6SXhNQzAwWVRsa0xUbGpPVEl0TWpKak5UTXdNV0l3T1dFMiJ9"

# Decode token and create credentials
DECODED=$(echo "$TOKEN" | base64 -d 2>/dev/null || echo '{}')
ACCOUNT_TAG=$(echo "$DECODED" | jq -r '.a // "unknown"')
TUNNEL_SECRET=$(echo "$DECODED" | jq -r '.s // "unknown"')

# Create credentials file
cat << EOF | sudo tee /etc/cloudflared/credentials.json
{
  "AccountTag": "$ACCOUNT_TAG",
  "TunnelSecret": "$TUNNEL_SECRET",
  "TunnelID": "67b2b5bf-a619-413f-bc67-f8ecb42df818"
}
EOF

# Install service with config file
echo "🚀 Installing cloudflared service with configuration..."
sudo cloudflared service install

# Start the service
echo "▶️  Starting cloudflared service..."
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
echo "✅ Checking service status..."
sudo systemctl status cloudflared --no-pager -l

echo ""
echo "🎉 Configuration complete!"
echo "========================="
echo "Your APIs should be available at:"
echo "• https://vexa.5173322.xyz"
echo "• https://admin.vexa.5173322.xyz" 
echo "• https://transcripts.vexa.5173322.xyz"
echo "• https://traefik.vexa.5173322.xyz"
echo ""
echo "⏱️  Please wait 60 seconds for changes to propagate..."
EOF