#!/bin/bash

# MADE MCP Server Docker Build Script
# This script builds the Docker image for the MADE MCP Server (always uses the default branch of MADE)

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
    echo "Usage: $0 [IMAGE_TAG]"
    echo ""
    echo "Arguments:"
    echo "  IMAGE_TAG     Optional. Docker image tag (default: made-mcp-server:latest)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build with default tag made-mcp-server:latest"
    echo "  $0 my-custom-tag      # Build with custom tag"
}



# Get image tag from argument or use default
IMAGE_TAG="${1:-made-mcp-server:latest}"

# Get the current commit hash of the made-repo submodule
MADE_COMMIT_HASH=$(git -C made-repo rev-parse --short HEAD)
print_info "Using MADE commit hash: $MADE_COMMIT_HASH"


print_info "Building MADE MCP Server Docker image..."
print_info "Image Tag: $IMAGE_TAG"
echo ""

# Check if git is available (needed for cloning)
if ! command -v git &> /dev/null; then
    print_error "Git is required but not installed. Please install git and try again."
    exit 1
fi



# Build the Docker image
print_info "Starting Docker build..."
if docker build \
    --build-arg MADE_COMMIT_HASH="$MADE_COMMIT_HASH" \
    --tag "$IMAGE_TAG" \
    --progress=plain \
    .; then
    print_success "Docker image built successfully!"
    print_info "Image: $IMAGE_TAG"
    echo ""
    print_info "To run the container:"
    echo "  docker run -p 3000:3000 $IMAGE_TAG"
    echo ""
    print_info "To run with Docker Compose:"
    echo "  docker-compose up"
else
    print_error "Docker build failed!"
    echo ""
    print_info "Common issues:"
    echo "  - Network connectivity issues"
    echo "  - Docker daemon not running"
    exit 1
fi