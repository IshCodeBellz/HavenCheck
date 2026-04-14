#!/bin/bash

# Haven Flow Carer App - Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Haven Flow Carer App - Setup Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

if ! command -v psql &> /dev/null && ! command -v createdb &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL commands not found. Make sure PostgreSQL is installed.${NC}"
    echo -e "${YELLOW}   You may need to set up the database manually.${NC}"
fi

echo -e "${GREEN}✅ Prerequisites check complete${NC}"
echo ""

# Backend setup
echo "🔧 Setting up backend..."
cd backend

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "📝 Creating .env file from .env.example..."
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please edit backend/.env with your database credentials!${NC}"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
else
    echo "✅ .env file already exists"
fi

echo "📦 Installing backend dependencies..."
npm install

echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Before continuing, please:${NC}"
echo "   1. Edit backend/.env with your PostgreSQL credentials"
echo "   2. Create the database: createdb havenflow (or use psql)"
echo "   3. Run: cd backend && npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed"
echo ""

# Web portal setup
echo "🌐 Setting up web portal..."
cd ../web-portal

if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    echo 'NEXT_PUBLIC_API_URL=http://localhost:3001/api' > .env.local
    echo -e "${GREEN}✅ Created .env.local${NC}"
else
    echo "✅ .env.local already exists"
fi

echo "📦 Installing web portal dependencies..."
npm install

echo -e "${GREEN}✅ Web portal setup complete${NC}"
echo ""

# Mobile app setup
echo "📱 Setting up mobile app..."
cd ../mobile-app

echo "📦 Installing mobile app dependencies..."
npm install

echo -e "${GREEN}✅ Mobile app setup complete${NC}"
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}✅ Setup script completed!${NC}"
echo ""
echo "📋 Next steps:"
echo "   1. Edit backend/.env with your database credentials"
echo "   2. Create PostgreSQL database: createdb havenflow"
echo "   3. Run database migrations:"
echo "      cd backend"
echo "      npm run prisma:generate"
echo "      npm run prisma:migrate"
echo "      npm run prisma:seed"
echo ""
echo "   4. Start the servers:"
echo "      Backend:    cd backend && npm run dev"
echo "      Web Portal: cd web-portal && npm run dev"
echo "      Mobile App: cd mobile-app && npm start"
echo ""
echo "📖 For detailed instructions, see QUICK_SETUP.md"

