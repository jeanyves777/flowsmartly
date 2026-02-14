# Start TorchServe Docker container for AnimatedDrawings
# This provides automatic character detection + pose estimation

Write-Host "Starting TorchServe for AnimatedDrawings..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "Error: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if image exists
$imageExists = docker images -q docker_torchserve 2>$null
if (-not $imageExists) {
    Write-Host "Building TorchServe Docker image (this takes 5-7 minutes)..." -ForegroundColor Yellow
    Set-Location "$PSScriptRoot\..\..\..\AnimatedDrawings\torchserve"
    docker build -t docker_torchserve .
    Set-Location "$PSScriptRoot\.."
}

# Check if container already running
$containerRunning = docker ps --filter "name=docker_torchserve" -q 2>$null
if ($containerRunning) {
    Write-Host "TorchServe is already running!" -ForegroundColor Green
} else {
    # Check if container exists but stopped
    $containerExists = docker ps -a --filter "name=docker_torchserve" -q 2>$null
    if ($containerExists) {
        Write-Host "Starting existing TorchServe container..." -ForegroundColor Yellow
        docker start docker_torchserve
    } else {
        Write-Host "Creating and starting TorchServe container..." -ForegroundColor Yellow
        docker run -d --name docker_torchserve -p 8080:8080 -p 8081:8081 docker_torchserve
    }
}

# Wait for TorchServe to be healthy
Write-Host "Waiting for TorchServe to initialize..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/ping" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "TorchServe is healthy and ready!" -ForegroundColor Green
            Write-Host "Character detection + pose estimation available at http://localhost:8080" -ForegroundColor Cyan
            exit 0
        }
    } catch {
        # Not ready yet
    }
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "  Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
}

Write-Host "Warning: TorchServe may still be initializing. Try again in a few seconds." -ForegroundColor Yellow
Write-Host "You can check status with: curl http://localhost:8080/ping" -ForegroundColor Gray
