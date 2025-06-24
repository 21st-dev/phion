#!/bin/bash

# Phion Next.js Project Setup Script
echo "🚀 Setting up your Next.js project..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start development server
echo "🔥 Starting Next.js development server..."
pnpm run dev 