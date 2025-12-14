# Raspberry Pi Deployment - Quick Start Guide

## On Your Raspberry Pi

### 1. Create deployment directory

```bash
mkdir -p ~/document-intelligence-api
cd ~/document-intelligence-api
```

### 2. Create .env file

```bash
nano .env
```

Paste this (update the API keys):

```bash
# Required - Update these!
API_KEY_CARDOC=your-cardoc-secret-key-here
API_KEY_MORTGAGE=your-mortgage-secret-key-here

# Optional - defaults are usually fine
OLLAMA_API_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT=60000
```

Save with `Ctrl+X`, then `Y`, then `Enter`

### 3. Create docker-compose.yml

```bash
nano docker-compose.yml
```

Paste this:

```yaml
version: '3.8'

services:
  document-intelligence-api:
    image: gmiranda/document-intelligence-api:latest
    container_name: document-intelligence-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file:
      - .env
    volumes:
      - ./debug:/app/debug
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Save with `Ctrl+X`, then `Y`, then `Enter`

### 4. Start the service

```bash
# Pull and start
docker-compose up -d

# View logs
docker-compose logs -f
```

### 5. Test it

```bash
# Health check
curl http://localhost:3001/api/v1/health

# Should return: {"success":true,"message":"Document Intelligence API is running",...}
```

## That's it! ✅

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update to latest image
docker-compose pull
docker-compose up -d

# Check status
docker-compose ps
```

## Troubleshooting

### Can't connect to Ollama?

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
sudo systemctl start ollama
```

### Container crashes?

```bash
# Check logs
docker-compose logs --tail=100

# Check Raspberry Pi memory
free -h
```

### Need to update?

```bash
cd ~/document-intelligence-api
docker-compose pull
docker-compose up -d
```
