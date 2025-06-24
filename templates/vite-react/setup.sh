#!/bin/bash

set -e

# Parse command line arguments
PROJECT_ID="$1"
WS_URL="$2"
DEBUG_MODE="$3"

echo "🚀 Starting Phion project setup..."
echo ""

# Validate required arguments
if [[ -z "$PROJECT_ID" ]]; then
    echo "❌ Error: PROJECT_ID is required as first argument"
    echo "Usage: $0 <projectId> <wsUrl> <debug>"
    exit 1
fi

if [[ -z "$WS_URL" ]]; then
    echo "❌ Error: WS_URL is required as second argument"
    echo "Usage: $0 <projectId> <wsUrl> <debug>"
    exit 1
fi

if [[ -z "$DEBUG_MODE" ]]; then
    echo "❌ Error: DEBUG_MODE is required as third argument"
    echo "Usage: $0 <projectId> <wsUrl> <debug>"
    exit 1
fi

echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   WebSocket URL: $WS_URL"
echo "   Debug Mode: $DEBUG_MODE"
echo ""

OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Windows;;
    MINGW*)     MACHINE=Windows;;
    MSYS*)      MACHINE=Windows;;
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
    echo "🪟 Setting up development environment for Windows..."
    echo ""
    
    if ! command_exists node; then
        echo "⚙️ Installing Node.js..."
        echo ""
        echo "   📥 Downloading Node.js LTS..."
        
        # Detect architecture
        if [[ "$PROCESSOR_ARCHITECTURE" == "AMD64" ]] || [[ "$PROCESSOR_ARCHITEW6432" == "AMD64" ]]; then
            NODE_ARCH="x64"
        else
            NODE_ARCH="x86"
        fi
        
        NODE_VERSION="v20.10.0"
        NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-${NODE_ARCH}.zip"
        NODE_DIR="node-${NODE_VERSION}-win-${NODE_ARCH}"
        
        echo "   🌐 Downloading from: ${NODE_URL}"
        
        # Download Node.js
        if command_exists curl; then
            curl -L -o "nodejs.zip" "${NODE_URL}"
        elif command_exists wget; then
            wget -O "nodejs.zip" "${NODE_URL}"
        else
            echo "   ❌ Neither curl nor wget found. Please download Node.js manually:"
            echo "      https://nodejs.org/en/download/"
            echo ""
            echo "   📋 Manual installation steps:"
            echo "      1. Download Node.js LTS from https://nodejs.org/"
            echo "      2. Run the installer (.msi file)"
            echo "      3. Restart your terminal"
            echo "      4. Run this script again"
            exit 1
        fi
        
        # Extract Node.js using Windows expand command
        if command_exists expand; then
            echo "   📦 Extracting Node.js using Windows expand..."
            expand -F:* nodejs.zip .
            
            # Create local bin directory
            mkdir -p "$HOME/.local/bin"
            
            # Copy Node.js binaries
            cp "${NODE_DIR}/node.exe" "$HOME/.local/bin/"
            cp "${NODE_DIR}/npm" "$HOME/.local/bin/"
            cp "${NODE_DIR}/npm.cmd" "$HOME/.local/bin/"
            cp -r "${NODE_DIR}/node_modules" "$HOME/.local/bin/"
            
            # Add to PATH
            export PATH="$HOME/.local/bin:$PATH"
            
            # Add to shell profile
            if [[ -f "$HOME/.bashrc" ]]; then
                echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
            fi
            if [[ -f "$HOME/.bash_profile" ]]; then
                echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bash_profile"
            fi
            
            # Cleanup
            rm -f "nodejs.zip"
            rm -rf "${NODE_DIR}"
            
            echo "   ✅ Node.js installed locally"
        elif command_exists powershell; then
            echo "   📦 Extracting Node.js using PowerShell..."
            powershell -Command "Expand-Archive -Path 'nodejs.zip' -DestinationPath '.'"
            
            # Create local bin directory
            mkdir -p "$HOME/.local/bin"
            
            # Copy Node.js binaries
            cp "${NODE_DIR}/node.exe" "$HOME/.local/bin/"
            cp "${NODE_DIR}/npm" "$HOME/.local/bin/"
            cp "${NODE_DIR}/npm.cmd" "$HOME/.local/bin/"
            cp -r "${NODE_DIR}/node_modules" "$HOME/.local/bin/"
            
            # Add to PATH
            export PATH="$HOME/.local/bin:$PATH"
            
            # Add to shell profile
            if [[ -f "$HOME/.bashrc" ]]; then
                echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
            fi
            if [[ -f "$HOME/.bash_profile" ]]; then
                echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bash_profile"
            fi
            
            # Cleanup
            rm -f "nodejs.zip"
            rm -rf "${NODE_DIR}"
            
            echo "   ✅ Node.js installed locally"
        else
            echo "   ❌ Neither expand nor PowerShell found for extraction."
            echo "   Please install Node.js manually:"
            echo "      https://nodejs.org/en/download/"
            rm -f "nodejs.zip"
            exit 1
        fi
    else
        echo "✅ Node.js already installed ($(node --version))"
    fi
    
    if ! command_exists pnpm; then
        echo "⚙️ Installing pnpm..."
        
        if command_exists npm; then
            npm install -g pnpm
        else
            echo "   📥 Installing pnpm standalone..."
            
            # Install pnpm standalone
            if command_exists curl; then
                curl -fsSL https://get.pnpm.io/install.sh | sh -
            elif command_exists wget; then
                wget -qO- https://get.pnpm.io/install.sh | sh -
            else
                echo "   ❌ Cannot install pnpm automatically."
                echo "   Please install manually after Node.js is available:"
                echo "      npm install -g pnpm"
                exit 1
            fi
            
            # Add pnpm to PATH
            export PNPM_HOME="$HOME/.local/share/pnpm"
            export PATH="$PNPM_HOME:$PATH"
            
            # Add to shell profiles
            if [[ -f "$HOME/.bashrc" ]]; then
                echo 'export PNPM_HOME="$HOME/.local/share/pnpm"' >> "$HOME/.bashrc"
                echo 'export PATH="$PNPM_HOME:$PATH"' >> "$HOME/.bashrc"
            fi
            if [[ -f "$HOME/.bash_profile" ]]; then
                echo 'export PNPM_HOME="$HOME/.local/share/pnpm"' >> "$HOME/.bash_profile"
                echo 'export PATH="$PNPM_HOME:$PATH"' >> "$HOME/.bash_profile"
            fi
        fi
    else
        echo "✅ pnpm already installed ($(pnpm --version))"
    fi
    
    echo ""
    echo "🎉 Windows setup complete!"
    echo ""
    echo "💡 Windows Tips:"
    echo "   • Use Windows Terminal for better experience"
    echo "   • Consider using Git Bash or PowerShell"
    echo "   • Restart your terminal to ensure PATH is updated"
    echo "   • If you encounter issues, try running as Administrator"
    echo ""
}

case "${MACHINE}" in
    Mac)     install_macos;;
    Linux)   install_linux;;
    Windows) install_windows;;
    *)       
        echo "❌ Unsupported operating system: ${MACHINE}"
        echo "Please install Node.js and pnpm manually, then run: pnpm start"
        exit 1
        ;;
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

chmod +x ./scripts/install-cursor-cli.sh && ./scripts/install-cursor-cli.sh
node scripts/check-updates.js

echo ""
echo "⚙️ Configuring Phion project..."

# Update phion.config.json with provided values
if [[ -f "phion.config.json" ]]; then
    echo "   📝 Updating phion.config.json..."
    
    # Create a temporary file for sed operations
    TEMP_CONFIG=$(mktemp)
    
    # Replace placeholders in phion.config.json
    sed "s/__PROJECT_ID__/$PROJECT_ID/g" phion.config.json > "$TEMP_CONFIG"
    sed "s|__WS_URL__|$WS_URL|g" "$TEMP_CONFIG" > phion.config.json.tmp
    sed "s/__DEBUG_MODE__/$DEBUG_MODE/g" phion.config.json.tmp > "$TEMP_CONFIG"
    
    # Move the final result back
    mv "$TEMP_CONFIG" phion.config.json
    rm -f phion.config.json.tmp
    
    echo "   ✅ Configuration updated successfully"
    echo "      Project ID: $PROJECT_ID"
    echo "      WebSocket URL: $WS_URL"
    echo "      Debug Mode: $DEBUG_MODE"
else
    echo "   ⚠️ phion.config.json not found, skipping configuration update"
fi

echo ""
echo "🚀 Starting your Phion project..."
echo ""

if command_exists pnpm; then
    pnpm install
    echo ""
    echo "✅ Dependencies installed!"
    echo "🧹 Clearing development ports..."
    pnpm run clear:ports
    echo "🌐 Starting development server and sync agent..."
else
    echo "❌ pnpm still not available. Please restart your terminal and run:"
    echo "   pnpm start"
fi 