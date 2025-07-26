#!/bin/bash
# Disable all audio output immediately
amixer sset Master 0% mute 2>/dev/null || true
amixer sset PCM 0% mute 2>/dev/null || true  
pactl set-sink-mute 0 1 2>/dev/null || true
pactl set-sink-volume 0 0% 2>/dev/null || true
# Kill any existing audio processes
pkill -f speechSynthesis 2>/dev/null || true
pkill -f "speak" 2>/dev/null || true
echo "Audio output disabled"