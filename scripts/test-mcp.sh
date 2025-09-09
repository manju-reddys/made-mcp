#!/bin/bash
# test-mcp.sh - Simple test script for MADE MCP Server

set -e

CONTAINER_NAME="made-mcp-server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to call MCP tool
call_tool() {
    local tool_name="$1"
    local arguments="${2:-{}}"
    
    echo -e "${BLUE}Testing: $tool_name${NC}"
    
    local request=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": $(date +%s),
  "method": "tools/call",
  "params": {
    "name": "$tool_name",
    "arguments": $arguments
  }
}
EOF
)
    
    echo "$request" | docker exec -i "$CONTAINER_NAME" node dist/server.js | jq '.'
    echo -e "${GREEN}✓ Completed${NC}\n"
}

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}Error: Container $CONTAINER_NAME is not running${NC}"
    echo "Start it with: docker-compose up -d made-mcp-server"
    exit 1
fi

echo -e "${YELLOW}Testing MADE MCP Server...${NC}\n"

# Test all tools
echo -e "${BLUE}=== Basic Tools ===${NC}"
call_tool "health_check"
call_tool "version"

echo -e "${BLUE}=== Component Discovery ===${NC}"
call_tool "list_components"
call_tool "list_tokens"

echo -e "${BLUE}=== Component Details ===${NC}"
call_tool "get_component" '{"name": "Button"}'

echo -e "${BLUE}=== Component Generation ===${NC}"
call_tool "scaffold_component" '{"name": "Button", "props": {"variant": "primary", "size": "large"}}'

echo -e "${BLUE}=== Search ===${NC}"
call_tool "search_examples" '{"query": "button primary"}'

echo -e "${BLUE}=== Validation ===${NC}"
call_tool "lint_markup" '{"html": "<button class=\"made-button made-button--primary\">Click me</button>"}'

echo -e "${GREEN}All tests completed!${NC}"