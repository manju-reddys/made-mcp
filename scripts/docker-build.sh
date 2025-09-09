#!/bin/bash

# MADE MCP Server Docker Build Script
# This script builds the Docker image with a specific MADE design system version

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <MADE_VERSION> [IMAGE_TAG]"
    echo ""
    echo "Arguments:"
    echo "  MADE_VERSION  Required. The MADE design system version to use"
    echo "                Examples: v3.0.0, v2.3.0, main, develop"
    echo "  IMAGE_TAG     Optional. Docker image tag (default: made-mcp-server:MADE_VERSION)"
    echo ""
    echo "Examples:"
    echo "  $0 v3.0.0                    # Build with MADE v3.0.0"
    echo "  $0 main my-custom-tag        # Build with MADE main branch, custom tag"
    echo "  $0 v2.3.0 made-mcp:v2.3.0   # Build with MADE v2.3.0, specific tag"
    echo ""
    echo "Available MADE versions can be found at:"
    echo "https://github.com/Mastercard/made/tags"
}

# Check if MADE_VERSION is provided
if [ -z "$1" ]; then
    print_error "MADE_VERSION is required!"
    echo ""
    show_usage
    exit 1
fi

MADE_VERSION="$1"
IMAGE_TAG="${2:-made-mcp-server:$MADE_VERSION}"

print_info "Building MADE MCP Server Docker image..."
print_info "MADE Version: $MADE_VERSION"
print_info "Image Tag: $IMAGE_TAG"
echo ""

# Check if git is available (needed for cloning)
if ! command -v git &> /dev/null; then
    print_error "Git is required but not installed. Please install git and try again."
    exit 1
fi

# Verify the MADE version exists (optional check)
print_info "Verifying MADE version exists..."
if git ls-remote --exit-code --heads --tags https://github.com/Mastercard/made.git "$MADE_VERSION" > /dev/null 2>&1; then
    print_success "MADE version '$MADE_VERSION' found"
else
    print_warning "Could not verify MADE version '$MADE_VERSION'. Building anyway..."
    print_warning "If the build fails, check available versions at: https://github.com/Mastercard/made/tags"
fi

echo ""

# Build the Docker image
print_info "Starting Docker build..."
if docker build \
    --build-arg MADE_VERSION="$MADE_VERSION" \
    --tag "$IMAGE_TAG" \
    --progress=plain \
    .; then
    
    print_success "Docker image built successfully!"
    print_info "Image: $IMAGE_TAG"
    print_info "MADE Version: $MADE_VERSION"
    echo ""
    print_info "To run the container:"
    echo "  docker run -p 3000:3000 $IMAGE_TAG"
    echo ""
    print_info "To run with Docker Compose:"
    echo "  MADE_VERSION=$MADE_VERSION docker-compose up"
    
else
    print_error "Docker build failed!"
    echo ""
    print_info "Common issues:"
    echo "  - Invalid MADE version specified"
    echo "  - Network connectivity issues"
    echo "  - Docker daemon not running"
    echo ""
    print_info "Check available MADE versions at:"
    echo "  https://github.com/Mastercard/made/tags"
    exit 1
fi