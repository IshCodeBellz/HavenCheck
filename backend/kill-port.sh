#!/bin/bash

# Quick script to kill processes on port 3001
# Usage: ./kill-port.sh [PORT]

PORT=${1:-3001}

echo "🔍 Checking for processes on port $PORT..."

PIDS=$(lsof -ti:$PORT)

if [ -z "$PIDS" ]; then
    echo "✅ Port $PORT is free"
    exit 0
fi

echo "⚠️  Found processes on port $PORT: $PIDS"
echo "🛑 Killing processes..."

for PID in $PIDS; do
    kill -9 $PID 2>/dev/null && echo "   Killed process $PID" || echo "   Failed to kill process $PID"
done

sleep 1

# Verify
if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "❌ Port $PORT is still in use"
    exit 1
else
    echo "✅ Port $PORT is now free"
    exit 0
fi

