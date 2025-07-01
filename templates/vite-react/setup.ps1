# Phion Project Setup Script for Windows
# PowerShell script to set up development environment

# Set execution policy for current session
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to refresh environment variables
function Update-EnvironmentPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# Function to install Scoop with multiple fallback methods
function Install-Scoop {
    Write-Host "[INSTALL] Installing Scoop..." -ForegroundColor Yellow
    
    # Method 1: Standard installation with TLS 1.2
    try {
        Write-Host "    Trying standard installation with TLS 1.2..." -ForegroundColor Gray
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
        Update-EnvironmentPath
        Write-Host "[OK] Scoop installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "    Standard installation failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Method 2: Alternative download method
    try {
        Write-Host "    Trying alternative download method..." -ForegroundColor Gray
        $scoopScript = Invoke-WebRequest -Uri https://get.scoop.sh -UseBasicParsing
        Invoke-Expression $scoopScript.Content
        Update-EnvironmentPath
        Write-Host "[OK] Scoop installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "    Alternative method failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Method 3: Manual GitHub download
    try {
        Write-Host "    Trying manual GitHub download..." -ForegroundColor Gray
        $tempDir = [System.IO.Path]::GetTempPath()
        $scoopPath = Join-Path $tempDir "install-scoop.ps1"
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ScoopInstaller/Install/master/install.ps1" -OutFile $scoopPath -UseBasicParsing
        & $scoopPath
        Update-EnvironmentPath
        Write-Host "[OK] Scoop installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "    Manual download failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    return $false
}

# Function to install Node.js manually
function Install-NodeManually {
    Write-Host "[INSTALL] Installing Node.js manually..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Scoop installation failed. Please install Node.js manually:" -ForegroundColor Cyan
    Write-Host "1. Visit: https://nodejs.org/en/download/" -ForegroundColor White
    Write-Host "2. Download the Windows Installer (.msi)" -ForegroundColor White
    Write-Host "3. Run the installer and follow the instructions" -ForegroundColor White
    Write-Host "4. Restart PowerShell and run this script again" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "Have you installed Node.js? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Update-EnvironmentPath
        if (Test-Command "node") {
            $nodeVersion = node --version
            Write-Host "[OK] Node.js detected ($nodeVersion)" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "[ERROR] Node.js not found. Please restart PowerShell." -ForegroundColor Red
            return $false
        }
    }
    return $false
}

# Function to install pnpm manually
function Install-PnpmManually {
    Write-Host "[INSTALL] Installing pnpm manually..." -ForegroundColor Yellow
    
    # Try npm install method
    if (Test-Command "npm") {
        try {
            Write-Host "    Installing pnpm via npm..." -ForegroundColor Gray
            npm install -g pnpm
            Update-EnvironmentPath
            Write-Host "[OK] pnpm installed successfully!" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "    npm installation failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Try PowerShell install method
    try {
        Write-Host "    Installing pnpm via PowerShell..." -ForegroundColor Gray
        iwr https://get.pnpm.io/install.ps1 -useb | iex
        Update-EnvironmentPath
        Write-Host "[OK] pnpm installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "    PowerShell installation failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Manual pnpm installation required:" -ForegroundColor Cyan
    Write-Host "1. Run: npm install -g pnpm" -ForegroundColor White
    Write-Host "2. Or visit: https://pnpm.io/installation" -ForegroundColor White
    Write-Host ""
    
    return $false
}

# Main setup function
function Start-PhionSetup {
    Write-Host "[*] Starting Phion project setup..." -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[*] Detected OS: Windows" -ForegroundColor Cyan
    Write-Host "[*] Setting up development environment for Windows..." -ForegroundColor Cyan
    Write-Host ""

    # Refresh environment variables to detect manually installed tools
    Write-Host "[*] Refreshing environment variables..." -ForegroundColor Cyan
    Update-EnvironmentPath
    Write-Host ""

    # Check if scoop is installed
    $scoopInstalled = $false
    if (-not (Test-Command "scoop")) {
        $scoopInstalled = Install-Scoop
        if (-not $scoopInstalled) {
            Write-Host "[WARNING] Scoop installation failed. Falling back to manual installation methods." -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "[OK] Scoop already installed" -ForegroundColor Green
        $scoopInstalled = $true
    }

    # Check if node is installed
    if (-not (Test-Command "node")) {
        if ($scoopInstalled) {
            Write-Host "[INSTALL] Installing Node.js via Scoop..." -ForegroundColor Yellow
            try {
                scoop install nodejs-lts
                Update-EnvironmentPath
                Write-Host "[OK] Node.js installation completed!" -ForegroundColor Green
            }
            catch {
                Write-Host "[ERROR] Failed to install Node.js via Scoop: $($_.Exception.Message)" -ForegroundColor Red
                if (-not (Install-NodeManually)) {
                    exit 1
                }
            }
        }
        else {
            if (-not (Install-NodeManually)) {
                exit 1
            }
        }
    }
    else {
        $nodeVersion = node --version
        Write-Host "[OK] Node.js already installed ($nodeVersion)" -ForegroundColor Green
    }

    # Check if pnpm is installed
    if (-not (Test-Command "pnpm")) {
        if ($scoopInstalled) {
            Write-Host "[INSTALL] Installing pnpm via Scoop..." -ForegroundColor Yellow
            try {
                scoop install pnpm
                Update-EnvironmentPath
                Write-Host "[OK] pnpm installation completed!" -ForegroundColor Green
            }
            catch {
                Write-Host "[ERROR] Failed to install pnpm via Scoop: $($_.Exception.Message)" -ForegroundColor Red
                Install-PnpmManually
            }
        }
        else {
            Install-PnpmManually
        }
    }
    else {
        $pnpmVersion = pnpm --version
        Write-Host "[OK] pnpm already installed ($pnpmVersion)" -ForegroundColor Green
    }

    # Check if git is installed
    if (-not (Test-Command "git")) {
        if ($scoopInstalled) {
            Write-Host "[INSTALL] Installing Git via Scoop..." -ForegroundColor Yellow
            try {
                scoop install git
                Update-EnvironmentPath
                Write-Host "[OK] Git installation completed!" -ForegroundColor Green
            }
            catch {
                Write-Host "[ERROR] Failed to install Git via Scoop: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "[INFO] Please install Git manually from: https://git-scm.com/download/win" -ForegroundColor Cyan
            }
        }
        else {
            Write-Host "[INFO] Git not found. Please install Git manually from: https://git-scm.com/download/win" -ForegroundColor Cyan
        }
    }
    else {
        $gitVersion = git --version
        Write-Host "[OK] Git already installed ($gitVersion)" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "[OK] Environment setup complete!" -ForegroundColor Green
    Write-Host ""

    # Display installed versions
    Write-Host "[*] Checking installed versions:" -ForegroundColor Cyan
    
    if (Test-Command "node") {
        $nodeVersion = node --version
        Write-Host "    Node.js: $nodeVersion" -ForegroundColor White
    }
    else {
        Write-Host "    [X] Node.js not found in PATH" -ForegroundColor Red
    }

    if (Test-Command "npm") {
        $npmVersion = npm --version
        Write-Host "    npm: $npmVersion" -ForegroundColor White
    }
    else {
        Write-Host "    [X] npm not found in PATH" -ForegroundColor Red
    }

    if (Test-Command "pnpm") {
        $pnpmVersion = pnpm --version
        Write-Host "    pnpm: $pnpmVersion" -ForegroundColor White
    }
    else {
        Write-Host "    [X] pnpm not found in PATH" -ForegroundColor Red
    }

    if (Test-Command "git") {
        $gitVersion = git --version
        Write-Host "    Git: $gitVersion" -ForegroundColor White
    }
    else {
        Write-Host "    [X] Git not found in PATH" -ForegroundColor Red
    }

    # Run additional setup scripts
    Write-Host ""
    Write-Host "[*] Running additional setup scripts..." -ForegroundColor Cyan
    if (Test-Path "scripts\check-updates.js") {
        try {
            node scripts\check-updates.js
        }
        catch {
            Write-Host "[WARNING] Failed to run check-updates.js: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "[*] Project setup complete!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[*] The Phion extension should start the project automatically" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[*] If the extension doesn't start, try:" -ForegroundColor Cyan
    Write-Host "    1. Open Cursor's command palette (Ctrl + Shift + P)" -ForegroundColor White
    Write-Host "    2. Find and run 'Phion: Start Project' command" -ForegroundColor White
    Write-Host "    3. If command doesn't exist or errors occur, reopen your IDE" -ForegroundColor White
    Write-Host ""

    # Network troubleshooting tips
    if (-not $scoopInstalled -and (-not (Test-Command "node") -or -not (Test-Command "pnpm"))) {
        Write-Host ""
        Write-Host "[TROUBLESHOOTING] Network issues detected:" -ForegroundColor Yellow
        Write-Host "If you're behind a corporate firewall or proxy:" -ForegroundColor Cyan
        Write-Host "1. Configure PowerShell proxy settings" -ForegroundColor White
        Write-Host "2. Use manual installation methods" -ForegroundColor White
        Write-Host "3. Contact your IT administrator" -ForegroundColor White
        Write-Host ""
    }

        
    # Start the development server
    Write-Host "[*] Starting development server..." -ForegroundColor Cyan
    if (Test-Command "pnpm") {
        try {
            Write-Host "    Running: pnpm run start" -ForegroundColor Gray
            pnpm run start
        }
        catch {
            Write-Host "[ERROR] Failed to start development server: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "    You can manually run: pnpm run start" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "[ERROR] pnpm not found. Please install pnpm and run: pnpm run start" -ForegroundColor Red
    }
}

# Execute the main setup function
Start-PhionSetup
