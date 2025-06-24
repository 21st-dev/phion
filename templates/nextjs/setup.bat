@echo off

REM Phion Next.js Project Setup Script
echo 🚀 Setting up your Next.js project...

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 Installing pnpm...
    npm install -g pnpm
)

REM Install dependencies
echo 📦 Installing dependencies...
pnpm install

REM Start development server
echo 🔥 Starting Next.js development server...
pnpm run dev 