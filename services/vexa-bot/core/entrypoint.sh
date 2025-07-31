#!/bin/bash
# Start a virtual framebuffer in the background
Xvfb :99 -screen 0 1920x1080x24 &

# Start PulseAudio for audio capture and processing with enhanced configuration
pulseaudio --start --exit-idle-time=-1 --log-level=debug &

# Wait a moment for PulseAudio to initialize
sleep 3

# Set up comprehensive virtual audio system for both input and output
echo "Setting up virtual audio devices..."

# Create a virtual speaker sink for audio output
pactl load-module module-null-sink sink_name=virtual_speaker sink_properties=device.description=VirtualSpeaker

# Create a virtual microphone source for audio input
pactl load-module module-null-sink sink_name=virtual_microphone sink_properties=device.description=VirtualMicrophone
pactl load-module module-virtual-source source_name=virtual_microphone_source

# Create a loopback from virtual speaker to virtual microphone (so bot can "hear" its own speech)
pactl load-module module-loopback source=virtual_speaker.monitor sink=virtual_microphone latency_msec=1

# Set the virtual speaker as the default sink (for audio output)
pactl set-default-sink virtual_speaker

# Set the virtual microphone source as the default source (for audio input)
pactl set-default-source virtual_microphone_source

# Ensure maximum volume for output
pactl set-sink-volume virtual_speaker 100%
pactl set-sink-mute virtual_speaker false

echo "Audio system configuration complete"
pactl list sinks short
pactl list sources short

# Start the WebSocket bridge server in background
echo "Starting WebSocket bridge server..."
node bridge-server.js &

# Wait a moment for bridge server to initialize
sleep 2

# Finally, run the bot using the built production wrapper
# This wrapper (e.g., docker.js generated from docker.ts) will read the BOT_CONFIG env variable.
node dist/docker.js
