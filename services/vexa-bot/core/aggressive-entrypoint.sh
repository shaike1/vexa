#!/bin/bash

echo "Setting up virtual audio devices..."
pulseaudio --start --verbose --exit-idle-time=-1 --system=false --daemonize=false &
sleep 2

# Create virtual audio devices
pactl load-module module-null-sink sink_name=virtual_speaker sink_properties=device.description="Virtual_Speaker"
pactl load-module module-null-sink sink_name=virtual_microphone sink_properties=device.description="Virtual_Microphone"
pactl load-module module-virtual-source source_name=virtual_microphone_source master=virtual_microphone.monitor source_properties=device.description="Virtual_Microphone_Source"

echo "Audio system configuration complete"
pactl list short sinks
pactl list short sources

# Start the WebSocket bridge server in background
echo "Starting WebSocket bridge server..."
node bridge-server.js &

# Wait a moment for bridge server to initialize
sleep 3

echo "Starting aggressive audio bot..."

# Inject aggressive audio capture directly into the bot runtime
export AGGRESSIVE_AUDIO="true"

# Start the main bot
node dist/index.js