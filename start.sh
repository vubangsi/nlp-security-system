#!/bin/bash

# Natural Language Security Control Application Startup Script

echo "🚀 Starting Natural Language Security Control Application"
echo "=========================================================="

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "📝 Please edit .env file with your configuration:"
    echo "   - Set your GROQ_API_KEY (optional, fallback NLP available)"
    echo "   - Update ADMIN_PIN if desired (default: 0000)"
    echo "   - Set a secure JWT_SECRET for production"
    echo ""
    read -p "Press Enter to continue with default configuration or Ctrl+C to edit .env first..."
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker first."
    exit 1
fi

echo ""
echo "🔧 Building and starting containers..."
echo "   This may take a few minutes on first run..."

# Build and start the application
docker-compose up --build

echo ""
echo "🎉 Application startup complete!"
echo ""
echo "📱 Access the application:"
echo "   Frontend: http://localhost:3002"
echo "   Backend API: http://localhost:3001"
echo ""
echo "🔐 Default login:"
echo "   PIN: 0000"
echo ""
echo "🛑 To stop the application:"
echo "   Press Ctrl+C or run: docker-compose down"
