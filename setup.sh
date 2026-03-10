#!/bin/bash
set -e

echo "=== AgentOS Setup ==="
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

# Generate session secret if not set
if ! grep -q "^SESSION_SECRET=.\+" .env 2>/dev/null; then
    SECRET=$(openssl rand -hex 32)
    if grep -q "^SESSION_SECRET=" .env; then
        sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$SECRET/" .env
    else
        echo "SESSION_SECRET=$SECRET" >> .env
    fi
    echo "Generated SESSION_SECRET"
fi

# Prompt for PostgreSQL password
if ! grep -q "^PG_PASSWORD=.\+" .env 2>/dev/null || grep -q "^PG_PASSWORD=changeme" .env; then
    read -sp "PostgreSQL password [changeme]: " PG_PWD
    PG_PWD=${PG_PWD:-changeme}
    echo ""
    sed -i "s/^PG_PASSWORD=.*/PG_PASSWORD=$PG_PWD/" .env
fi

echo ""
echo "Starting services..."
docker compose -f docker-compose.production.yml --env-file .env up -d --build

echo ""
echo "Waiting for database to be ready..."
sleep 5

echo ""
echo "================================================"
echo "  AgentOS is running at http://localhost:3001"
echo "  Open the URL to create your owner account."
echo "================================================"
