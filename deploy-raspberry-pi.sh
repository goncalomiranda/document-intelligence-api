#!/bin/bash
# Deployment script for Raspberry Pi

set -e

echo "🥧 Document Intelligence API - Raspberry Pi Deployment"
echo "======================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed. Please log out and back in for group changes to take effect."
    exit 0
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker-compose
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if Ollama is running
echo "🔍 Checking Ollama service..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama is running"
    
    # Check if llama3.2:3b is installed
    if curl -s http://localhost:11434/api/tags | grep -q "llama3.2:3b"; then
        echo "✅ Model llama3.2:3b is installed"
    else
        echo "⚠️  Model llama3.2:3b not found. Would you like to pull it? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            ollama pull llama3.2:3b
        fi
    fi
else
    echo "❌ Ollama is not running. Please start Ollama first:"
    echo "   sudo systemctl start ollama"
    exit 1
fi
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.docker .env
    echo "⚠️  Please edit .env file and update your API keys:"
    echo "   nano .env"
    echo ""
    echo "Press Enter when you're done editing..."
    read -r
fi

# Build the Docker image
echo "🔨 Building Docker image..."
docker-compose build --no-cache

# Stop existing container if running
if [ "$(docker ps -q -f name=document-intelligence-api)" ]; then
    echo "🛑 Stopping existing container..."
    docker-compose down
fi

# Start the container
echo "🚀 Starting container..."
docker-compose up -d

# Wait for service to be ready
echo "⏳ Waiting for service to start..."
sleep 5

# Check health
echo "🏥 Checking health..."
if curl -s http://localhost:3001/api/v1/health > /dev/null 2>&1; then
    echo "✅ Service is healthy!"
    echo ""
    echo "📊 Container Status:"
    docker-compose ps
    echo ""
    echo "📝 View logs with: docker-compose logs -f"
    echo "🧪 Test endpoint: curl http://localhost:3001/api/v1/health"
    echo ""
    echo "🎉 Deployment complete!"
else
    echo "❌ Service health check failed. Checking logs..."
    docker-compose logs --tail=50
    exit 1
fi
