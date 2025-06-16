#!/bin/bash

# Phion Toolbar Upload Script
# Usage: ./scripts/upload-toolbar.sh [version] [channel] [broadcast]
# Example: ./scripts/upload-toolbar.sh 0.2.1 stable true

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION=${1:-}
CHANNEL=${2:-stable}
BROADCAST=${3:-false}
RELEASE_NOTES=${4:-"Toolbar update"}

# API endpoints
API_URL="http://localhost:3004"
WS_URL="http://localhost:8080"

echo -e "${BLUE}🚀 Phion Toolbar Upload Script${NC}"
echo "================================="

# Validate inputs
if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ Error: Version is required${NC}"
    echo "Usage: $0 <version> [channel] [broadcast] [release_notes]"
    echo "Example: $0 0.2.1 stable true 'Bug fixes and improvements'"
    exit 1
fi

if [[ ! "$CHANNEL" =~ ^(stable|beta|dev)$ ]]; then
    echo -e "${RED}❌ Error: Channel must be 'stable', 'beta', or 'dev'${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Version: $VERSION"
echo "  Channel: $CHANNEL"
echo "  Broadcast: $BROADCAST"
echo "  Release Notes: $RELEASE_NOTES"
echo ""

# Step 1: Build toolbar
echo -e "${BLUE}🔧 Step 1: Building toolbar...${NC}"
cd packages/vite-plugin-phion
pnpm build
cd ../..

TOOLBAR_FILE="packages/vite-plugin-phion/dist/toolbar/index.global.js"

if [ ! -f "$TOOLBAR_FILE" ]; then
    echo -e "${RED}❌ Error: Toolbar file not found at $TOOLBAR_FILE${NC}"
    exit 1
fi

FILE_SIZE=$(ls -lh "$TOOLBAR_FILE" | awk '{print $5}')
echo -e "${GREEN}✅ Toolbar built successfully ($FILE_SIZE)${NC}"
echo ""

# Step 2: Upload to R2
echo -e "${BLUE}📤 Step 2: Uploading to R2...${NC}"

UPLOAD_RESPONSE=$(curl -s -X PUT "$API_URL/api/toolbar/upload" \
    -F "version=$VERSION" \
    -F "channel=$CHANNEL" \
    -F "releaseNotes=$RELEASE_NOTES" \
    -F "file=@$TOOLBAR_FILE")

if echo "$UPLOAD_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Upload successful!${NC}"
    
    # Extract URL from response
    URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}📍 URL: $URL${NC}"
else
    echo -e "${RED}❌ Upload failed:${NC}"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi
echo ""

# Step 3: Broadcast (optional)
if [ "$BROADCAST" = "true" ]; then
    echo -e "${BLUE}📡 Step 3: Broadcasting update...${NC}"
    
    BROADCAST_RESPONSE=$(curl -s -X POST "$WS_URL/api/toolbar/broadcast-update" \
        -H "Content-Type: application/json" \
        -d "{
            \"version\":\"$VERSION\",
            \"channel\":\"$CHANNEL\",
            \"forceUpdate\":false,
            \"releaseNotes\":\"$RELEASE_NOTES\"
        }")
    
    if echo "$BROADCAST_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Broadcast successful!${NC}"
        echo -e "${GREEN}📢 All users will receive the update${NC}"
    else
        echo -e "${YELLOW}⚠️  Broadcast failed (WebSocket server might be down):${NC}"
        echo "$BROADCAST_RESPONSE"
    fi
else
    echo -e "${YELLOW}📡 Step 3: Skipping broadcast (set 3rd parameter to 'true' to broadcast)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Toolbar v$VERSION successfully deployed to $CHANNEL channel!${NC}"
echo ""
echo -e "${BLUE}📊 Next steps:${NC}"
echo "  1. Check admin panel: $API_URL/admin/toolbar"
echo "  2. Users will auto-update within 5 minutes"
if [ "$BROADCAST" = "true" ]; then
    echo "  3. Active users will receive immediate update via WebSocket"
fi
echo "" 