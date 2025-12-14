#!/bin/bash

# Document Intelligence API Setup Script
# This script will help you set up the application

set -e

echo "🚀 Document Intelligence API Setup"
echo "===================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo "   Install it with: curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi
echo "✅ Ollama detected"

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "⚠️  Ollama is not running. Starting it..."
    sudo systemctl start ollama 2>/dev/null || echo "   Please start Ollama manually: ollama serve"
fi

# Check for llama3.2:3b model
if ! ollama list | grep -q "llama3.2:3b"; then
    echo "⚠️  Model llama3.2:3b not found. Pulling it now..."
    ollama pull llama3.2:3b
fi
echo "✅ Ollama model llama3.2:3b available"

# Check pdftocairo
if ! command -v pdftocairo &> /dev/null; then
    echo "❌ pdftocairo is not installed."
    echo "   Install it with: sudo apt-get install poppler-utils"
    exit 1
fi
echo "✅ pdftocairo (poppler-utils) detected"

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from template"
    
    # Generate random API keys
    CARDOC_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    MORTGAGE_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    
    # Update .env with generated keys
    sed -i "s/your-cardoc-api-key-here/$CARDOC_KEY/" .env
    sed -i "s/your-mortgage-api-key-here/$MORTGAGE_KEY/" .env
    
    echo "✅ Generated API keys:"
    echo "   CarDoc:   $CARDOC_KEY"
    echo "   Mortgage: $MORTGAGE_KEY"
    echo ""
    echo "⚠️  Save these keys! You'll need them to call the API."
else
    echo "⚠️  .env file already exists, skipping..."
fi

echo ""
echo "🏗️  Building TypeScript..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review your .env file: nano .env"
echo "  2. Start development server: npm run dev"
echo "  3. Test health endpoint: curl http://localhost:3000/api/v1/health"
echo ""
echo "📚 See README.md for API documentation"
