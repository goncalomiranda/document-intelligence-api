# GitHub Actions + Docker Hub Deployment Guide

This guide explains how to set up automated Docker image builds using GitHub Actions and deploy to your Raspberry Pi.

## Architecture

1. **Push code** to GitHub (main branch or tag)
2. **GitHub Actions** automatically builds Docker image for ARM64 (Raspberry Pi) and AMD64 (x86)
3. **Push image** to Docker Hub
4. **Pull image** on Raspberry Pi and run

## Step 1: Set Up Docker Hub

### Create Docker Hub Account (if you don't have one)

1. Go to https://hub.docker.com/
2. Sign up for free account
3. Create repository: `document-intelligence-api`

### Create Access Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name it: `github-actions`
4. Permissions: Read, Write, Delete
5. **Copy the token** (you'll need it in next step)

## Step 2: Configure GitHub Secrets

1. Go to your GitHub repository: https://github.com/goncalomiranda/document-intelligence-api
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:

   **Secret 1:**
   - Name: `DOCKERHUB_USERNAME`
   - Value: Your Docker Hub username (e.g., `goncalomiranda`)

   **Secret 2:**
   - Name: `DOCKERHUB_TOKEN`
   - Value: The access token you copied from Docker Hub

## Step 3: Push Code to GitHub

The GitHub Actions workflow is already configured in `.github/workflows/docker-build.yml`.

```bash
# On your laptop
cd /home/gmiranda/Documents/GitHub/document-intelligence-api

# Add all files
git add .

# Commit
git commit -m "Add Docker build workflow and deployment scripts"

# Push to GitHub
git push origin main
```

## Step 4: Monitor Build

1. Go to your GitHub repository
2. Click **Actions** tab
3. You'll see the workflow running: "Build and Push Docker Image"
4. Build takes ~5-10 minutes (builds for both ARM64 and AMD64)
5. Once complete, your image will be on Docker Hub

## Step 5: Deploy on Raspberry Pi

### Create deployment directory

```bash
# SSH into your Raspberry Pi
ssh pi@raspberrypi.local

# Create deployment directory
mkdir -p ~/document-intelligence-api
cd ~/document-intelligence-api
```

### Create docker-compose.yml

```bash
nano docker-compose.yml
```

Paste this content (replace `YOUR_DOCKERHUB_USERNAME`):

```yaml
version: '3.8'

services:
  document-intelligence-api:
    image: YOUR_DOCKERHUB_USERNAME/document-intelligence-api:latest
    container_name: document-intelligence-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - API_KEY_CARDOC=${API_KEY_CARDOC}
      - API_KEY_MORTGAGE=${API_KEY_MORTGAGE}
      - OLLAMA_API_URL=http://host.docker.internal:11434
      - OLLAMA_MODEL=llama3.2:3b
      - OLLAMA_TIMEOUT=60000
      - OLLAMA_DEFAULT_PROMPT=Analyze this document and provide a concise summary with key information.
      - RATE_LIMIT_WINDOW_MS=900000
      - RATE_LIMIT_MAX_REQUESTS=100
      - MAX_FILE_SIZE=3145728
      - ALLOWED_MIME_TYPES=application/pdf,image/png,image/jpeg
      - DEBUG_SAVE_FILES=true
      - DEBUG_DIR=./debug
      - LOG_LEVEL=info
    volumes:
      - ./debug:/app/debug
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Create .env file

```bash
nano .env
```

Add your API keys:

```bash
API_KEY_CARDOC=your-actual-cardoc-key
API_KEY_MORTGAGE=your-actual-mortgage-key
```

### Pull and run the container

```bash
# Pull the latest image
docker pull YOUR_DOCKERHUB_USERNAME/document-intelligence-api:latest

# Start the container
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Step 6: Test the API

```bash
# Health check
curl http://localhost:3001/api/v1/health

# Test with a document
curl -X POST http://localhost:3001/api/v1/documents/analyze \
  -H "x-api-key: your-cardoc-api-key" \
  -H "x-prompt: Summarize this document" \
  -F "file=@test.pdf"
```

## Updating the Application

When you push new code to GitHub:

1. **GitHub Actions** automatically builds new image
2. **On Raspberry Pi**, update with:

```bash
cd ~/document-intelligence-api

# Pull latest image
docker-compose pull

# Restart with new image
docker-compose up -d

# View logs
docker-compose logs -f
```

## Tagging Releases

For production deployments, use version tags:

```bash
# On your laptop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

This creates images with multiple tags:
- `YOUR_USERNAME/document-intelligence-api:latest`
- `YOUR_USERNAME/document-intelligence-api:v1.0.0`
- `YOUR_USERNAME/document-intelligence-api:1.0`
- `YOUR_USERNAME/document-intelligence-api:1`

On Raspberry Pi, you can use specific versions:

```yaml
# docker-compose.yml
services:
  document-intelligence-api:
    image: YOUR_USERNAME/document-intelligence-api:v1.0.0  # Pin to specific version
```

## Automatic Updates (Optional)

Use Watchtower to automatically update containers:

```bash
# On Raspberry Pi
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 3600 \
  document-intelligence-api
```

This checks for new images every hour and updates automatically.

## Troubleshooting

### Build fails in GitHub Actions

Check the Actions logs:
1. Go to GitHub → Actions
2. Click on failed workflow
3. Check build logs for errors

### Image not found on Raspberry Pi

```bash
# Verify image exists on Docker Hub
docker search YOUR_USERNAME/document-intelligence-api

# Try pulling explicitly
docker pull YOUR_USERNAME/document-intelligence-api:latest
```

### Can't connect to Ollama from container

```bash
# Test Ollama from Raspberry Pi host
curl http://localhost:11434/api/tags

# Use host IP instead of host.docker.internal
# In docker-compose.yml:
- OLLAMA_API_URL=http://192.168.1.X:11434
```

## Monitoring

### View logs

```bash
docker-compose logs -f
```

### Check resource usage

```bash
docker stats document-intelligence-api
```

### Check container health

```bash
docker ps
docker inspect document-intelligence-api | grep Health -A 10
```

## Benefits of This Approach

✅ **Automated builds** - Push to GitHub, get Docker image automatically  
✅ **Multi-architecture** - Works on Raspberry Pi (ARM64) and regular servers (AMD64)  
✅ **Version control** - Tag releases, rollback if needed  
✅ **Fast deployment** - Just pull and run, no building on Pi  
✅ **Consistent** - Same image everywhere  
✅ **Free** - GitHub Actions + Docker Hub free tiers  

Your deployment pipeline is now fully automated! 🚀
