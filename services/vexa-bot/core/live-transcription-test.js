#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');

console.log('🎤 Live Transcription Test - Direct WhisperLive Connection');

// Connect directly to WhisperLive
const ws = new WebSocket('ws://vexa-whisperlive-cpu-1:9090');

ws.on('open', function() {
    console.log('✅ Connected to WhisperLive');
    
    // Initialize session
    const initMessage = {
        uid: "live-test-session",
        language: "en",
        task: "transcribe", 
        model: "small",
        use_vad: false,
        save_output_recording: false,
        return_timestamps: true,
        platform: "teams",
        meeting_url: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZGIyNDI5MTYtY2ZiYS00MTZiLTkxNjktMmE2OTM0MGIxZDVl%40thread.v2/0",
        token: "vexa-api-key-live-test-2024",
        meeting_id: "live-test-meeting"
    };
    
    console.log('📡 Sending initialization message...');
    ws.send(JSON.stringify(initMessage));
});

ws.on('message', function(data) {
    try {
        const message = JSON.parse(data);
        console.log('📥 WhisperLive Response:', message);
        
        if (message.message === 'SERVER_READY') {
            console.log('🟢 WhisperLive is ready for audio streaming!');
            console.log('🎯 SPEAK NOW - Your speech will be transcribed in real-time');
            
            // Send some test audio data
            setTimeout(() => {
                console.log('📡 Sending test audio chunk...');
                const audioData = fs.readFileSync('/tmp/speech_audio.b64', 'utf8').slice(0, 1000);
                ws.send(audioData);
            }, 1000);
        }
        
        if (message.text) {
            console.log('🗣️  TRANSCRIPTION:', message.text);
        }
    } catch (e) {
        console.log('📥 Raw message:', data.toString());
    }
});

ws.on('error', function(error) {
    console.error('❌ WebSocket Error:', error);
});

ws.on('close', function() {
    console.log('🔌 WhisperLive connection closed');
});

// Keep the process running
console.log('🎧 Waiting for WhisperLive connection...');