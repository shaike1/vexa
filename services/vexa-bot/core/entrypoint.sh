#!/bin/bash
# Start a virtual framebuffer in the background
Xvfb :99 -screen 0 1920x1080x24 &

# Start PulseAudio for audio capture and processing
pulseaudio --start --exit-idle-time=-1 &

# Wait a moment for PulseAudio to initialize
sleep 2

# Set up a virtual audio source for microphone simulation
pactl load-module module-null-sink sink_name=virtual_microphone sink_properties=device.description=VirtualMicrophone
pactl load-module module-virtual-source source_name=virtual_microphone_source

# Finally, run the bot using the built production wrapper
# This wrapper (e.g., docker.js generated from docker.ts) will read the BOT_CONFIG env variable.
node dist/docker.js
