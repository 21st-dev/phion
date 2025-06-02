#!/bin/bash

echo "🚀 Starting Shipvibes.dev platform..."

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the shipvibes root directory."
    exit 1
fi

# Устанавливаем зависимости если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Запускаем все сервисы
echo "🌐 Starting web server and WebSocket server..."
pnpm run dev:all

echo "✅ Shipvibes platform is running!"
echo "📱 Open http://localhost:3004 to create projects"
echo "🔌 WebSocket server is running on port 8080"
echo ""
echo "Press Ctrl+C to stop all services" 