#!/bin/bash

# Start X server
Xvfb :99 -screen 0 1280x720x24 > /dev/null 2>&1 &

# Start fluxbox window manager
fluxbox > /dev/null 2>&1 &

# Wait for X server to be ready
sleep 2

# Set up PulseAudio
pulseaudio --start --log-target=newfile:/tmp/pulse.log --log-level=notice

echo "Starting bot with runtime TypeScript compilation..."

# Use ts-node to run TypeScript directly
exec npx ts-node src/index.ts