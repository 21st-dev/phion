#!/bin/bash

set -e

echo "🚀 Starting Phion project setup..."
echo ""

OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Cygwin;;
    MINGW*)     MACHINE=MinGw;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "🔍 Detected OS: ${MACHINE}"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

install_macos() {
    echo "📦 Setting up development environment for macOS..."
    
    if ! command_exists brew; then
        echo "⚙️ Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        if [[ $(uname -m) == 'arm64' ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    else
        echo "✅ Homebrew already installed"
    fi
    
    if ! command_exists node; then
        echo "⚙️ Installing Node.js..."
        brew install node
    else
        echo "✅ Node.js already installed ($(node --version))"
    fi
    
    if ! command_exists pnpm; then
        echo "⚙️ Installing pnpm..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
        
        echo 'export PNPM_HOME="$HOME/.local/share/pnpm"' >> ~/.zshrc
        echo 'export PATH="$PNPM_HOME:$PATH"' >> ~/.zshrc
    else
        echo "✅ pnpm already installed ($(pnpm --version))"
    fi
}

install_linux() {
    echo "📦 Setting up development environment for Linux..."
    
    if command_exists apt-get; then
        PKG_MANAGER="apt-get"
        UPDATE_CMD="sudo apt-get update"
        INSTALL_CMD="sudo apt-get install -y"
    elif command_exists yum; then
        PKG_MANAGER="yum"
        UPDATE_CMD="sudo yum update"
        INSTALL_CMD="sudo yum install -y"
    elif command_exists dnf; then
        PKG_MANAGER="dnf"
        UPDATE_CMD="sudo dnf update"
        INSTALL_CMD="sudo dnf install -y"
    else
        echo "❌ Unsupported package manager. Please install Node.js manually."
        exit 1
    fi
    
    echo "🔄 Updating package lists..."
    $UPDATE_CMD
    
    if ! command_exists node; then
        echo "⚙️ Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        $INSTALL_CMD nodejs
    else
        echo "✅ Node.js already installed ($(node --version))"
    fi
    
    if ! command_exists pnpm; then
        echo "⚙️ Installing pnpm..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -
    else
        echo "✅ pnpm already installed ($(pnpm --version))"
    fi
}

install_windows() {
    echo "📦 Setting up development environment for Windows..."
    echo "⚠️  For Windows, please:"
    echo "   1. Install Node.js from https://nodejs.org/"
    echo "   2. Run: npm install -g pnpm"
    echo "   3. Restart your terminal"
    echo "   4. Run: pnpm start"
    exit 1
}

case "${MACHINE}" in
    Mac)     install_macos;;
    Linux)   install_linux;;
    *)       install_windows;;
esac

echo ""
echo "✅ Environment setup complete!"
echo ""

if [[ "${MACHINE}" == "Mac" ]]; then
    if [[ $(uname -m) == 'arm64' ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

# Skip shell config sourcing in setup script
# Users can restart terminal or source configs manually if needed

echo "🔍 Checking installed versions:"
if command_exists node; then
    echo "   Node.js: $(node --version)"
else
    echo "   ❌ Node.js not found in PATH"
fi

if command_exists npm; then
    echo "   npm: $(npm --version)"
else
    echo "   ❌ npm not found in PATH"
fi

if command_exists pnpm; then
    echo "   pnpm: $(pnpm --version)"
else
    echo "   ❌ pnpm not found in PATH"
fi

echo ""
echo "🚀 Starting your Phion project..."
echo ""

if command_exists pnpm; then
    pnpm install
    node scripts/install-browser-extension.js
    echo ""
    echo "✅ Dependencies installed!"
    echo "🧹 Clearing development ports..."
    pnpm run clear:ports
    echo "🌐 Starting development server and sync agent..."
    echo ""
    pnpm start
else
    echo "❌ pnpm still not available. Please restart your terminal and run:"
    echo "   pnpm start"
fi 