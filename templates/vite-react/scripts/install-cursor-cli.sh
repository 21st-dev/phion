#!/bin/bash

# Install Cursor CLI command
# This script creates a symlink to make "cursor" command available system-wide

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Cursor app exists
CURSOR_APP_PATH="/Applications/Cursor.app"
CURSOR_BIN_PATH="/Applications/Cursor.app/Contents/Resources/app/bin/code"
SYMLINK_PATH="/usr/local/bin/cursor"

print_status "Installing Cursor CLI command..."

# Check if Cursor app is installed
if [ ! -d "$CURSOR_APP_PATH" ]; then
    print_error "Cursor app not found at $CURSOR_APP_PATH"
    print_error "Please install Cursor app first from https://cursor.sh/"
    exit 1
fi

# Check if the binary exists
if [ ! -f "$CURSOR_BIN_PATH" ]; then
    print_error "Cursor binary not found at $CURSOR_BIN_PATH"
    exit 1
fi

print_status "Found Cursor app at $CURSOR_APP_PATH"

# Create /usr/local/bin directory if it doesn't exist
if [ ! -d "/usr/local/bin" ]; then
    print_status "Creating /usr/local/bin directory..."
    sudo mkdir -p /usr/local/bin
fi

# Check existing symlink
if [ -L "$SYMLINK_PATH" ]; then
    print_status "Cursor symlink already exists - skipping creation"
elif [ -f "$SYMLINK_PATH" ]; then
    print_warning "Found existing cursor file, backing it up..."
    sudo mv "$SYMLINK_PATH" "${SYMLINK_PATH}.backup"
    print_status "Creating symlink at $SYMLINK_PATH..."
    sudo ln -s "$CURSOR_BIN_PATH" "$SYMLINK_PATH"
    sudo chmod +x "$SYMLINK_PATH"
else
    # Create new symlink
    print_status "Creating symlink at $SYMLINK_PATH..."
    sudo ln -s "$CURSOR_BIN_PATH" "$SYMLINK_PATH"
    sudo chmod +x "$SYMLINK_PATH"
fi

# Check if /usr/local/bin is in PATH
if [[ ":$PATH:" != *":/usr/local/bin:"* ]]; then
    print_warning "/usr/local/bin is not in your PATH"
    
    # Detect shell and add to appropriate config file
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        "bash")
            SHELL_CONFIG="$HOME/.bashrc"
            if [ ! -f "$SHELL_CONFIG" ]; then
                SHELL_CONFIG="$HOME/.bash_profile"
            fi
            ;;
        "zsh")
            SHELL_CONFIG="$HOME/.zshrc"
            ;;
        "fish")
            SHELL_CONFIG="$HOME/.config/fish/config.fish"
            ;;
        *)
            SHELL_CONFIG="$HOME/.profile"
            ;;
    esac
    
    print_status "Adding /usr/local/bin to PATH in $SHELL_CONFIG"
    
    # Add PATH export to shell config if not already present
    if ! grep -q "export PATH.*\/usr\/local\/bin" "$SHELL_CONFIG" 2>/dev/null; then
        echo '' >> "$SHELL_CONFIG"
        echo '# Added by Cursor CLI installer' >> "$SHELL_CONFIG"
        echo 'export PATH="/usr/local/bin:$PATH"' >> "$SHELL_CONFIG"
        print_status "Added PATH export to $SHELL_CONFIG"
    else
        print_status "PATH already includes /usr/local/bin in $SHELL_CONFIG"
    fi
    
    # Source the config file
    print_status "Sourcing $SHELL_CONFIG to update current session..."
    source "$SHELL_CONFIG" 2>/dev/null || true
else
    print_status "/usr/local/bin is already in your PATH"
fi

# Test the installation
print_status "Testing cursor command..."
if command -v cursor >/dev/null 2>&1; then
    print_status "✅ Cursor CLI installed successfully!"
else
    print_error "❌ Installation failed - cursor command not found"
    print_error "You may need to restart your terminal or run: source $SHELL_CONFIG"
    exit 1
fi

print_status "Installation complete! 🎉"
