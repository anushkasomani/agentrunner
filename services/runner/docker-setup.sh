#!/bin/bash

# Docker setup script for agent execution
echo "Setting up Docker for agent execution..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Create temp directory for agent execution
mkdir -p temp

# Set proper permissions
chmod 755 temp

echo "Docker setup complete!"
echo "Agents will be executed in isolated Docker containers for security."
