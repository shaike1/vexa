#!/usr/bin/env node

/**
 * Teams Desktop Audio Capture
 * Captures system audio from Teams desktop app and streams to WhisperLive
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TeamsDesktopAudioCapture {
    constructor() {
        this.whisperLive = null;
        this.audioProcess = null;
        this.sessionId = `teams-desktop-${Date.now()}`;
        this.whisperLiveUrl = 'ws://172.20.0.2:9090';
        this.isConnected = false;
        this.audioBuffer = Buffer.alloc(0);
    }

    async start() {
        console.log('🎤 Teams Desktop Audio Capture Starting...');
        console.log('=====================================');
        
        try {
            await this.connectToWhisperLive();
            await this.setupSystemAudioCapture();
            
            console.log('🎯 READY FOR TEAMS MEETING TRANSCRIPTION!');
            console.log('📋 Instructions:');
            console.log('   1. Join your Teams meeting using the DESKTOP app');
            console.log('   2. Ensure meeting audio is playing through speakers');
            console.log('   3. Speak or have others speak in the meeting');
            console.log('   4. Watch for transcription output below');
            console.log('');
            
        } catch (error) {
            console.error('❌ Failed to start:', error.message);
            process.exit(1);
        }
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            console.log(`[Teams Audio] Connecting to WhisperLive at ${this.whisperLiveUrl}...`);
            
            this.whisperLive = new WebSocket(this.whisperLiveUrl);
            
            this.whisperLive.on('open', () => {
                console.log('[Teams Audio] ✅ Connected to WhisperLive');
                
                // Send initialization message
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams-desktop',
                    meeting_url: 'teams-desktop-audio',
                    token: 'vexa-api-key-teams-desktop',
                    meeting_id: 'teams-desktop-meeting'
                };
                
                this.whisperLive.send(JSON.stringify(initMessage));
                console.log('[Teams Audio] 📤 Sent WhisperLive initialization');
            });
            
            this.whisperLive.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message.status === 'SERVER_READY') {
                        console.log('[Teams Audio] ✅ WhisperLive ready for audio');
                        this.isConnected = true;
                        resolve();
                    } else if (message.message) {
                        // Transcription result
                        console.log(`🗣️  TRANSCRIPTION: "${message.message}"`);
                    } else if (message.segments) {
                        // Handle segment-based transcription
                        message.segments.forEach(segment => {
                            if (segment.text && segment.text.trim()) {
                                console.log(`🗣️  TRANSCRIPTION: "${segment.text.trim()}"`);
                            }
                        });
                    }
                } catch (error) {
                    console.log('[Teams Audio] Raw WhisperLive response:', data.toString());
                }
            });
            
            this.whisperLive.on('error', (error) => {
                console.error('[Teams Audio] ❌ WhisperLive error:', error.message);
                reject(error);
            });
            
            this.whisperLive.on('close', () => {
                console.log('[Teams Audio] ❌ WhisperLive connection closed');
                this.isConnected = false;
                // Attempt reconnection
                setTimeout(() => this.connectToWhisperLive(), 5000);
            });
        });
    }

    async setupSystemAudioCapture() {
        console.log('[Teams Audio] 🎤 Setting up system audio capture...');
        
        // Setup PulseAudio for system audio capture
        try {
            // Create monitor source for capturing system audio
            const pactl = spawn('pactl', ['load-module', 'module-null-sink', 'sink_name=teams_capture', 'sink_properties=device.description="Teams_Audio_Capture"']);
            await this.waitForProcess(pactl);
            
            console.log('[Teams Audio] ✅ Created Teams audio capture sink');
            
            // Start audio capture from system default output (what you hear)
            this.audioProcess = spawn('parec', [
                '--device=@DEFAULT_MONITOR@',  // Capture what's playing on speakers
                '--format=s16le',              // 16-bit signed little endian
                '--rate=16000',                // 16kHz for WhisperLive
                '--channels=1',                // Mono
                '--raw'                        // Raw PCM output
            ]);
            
            console.log('[Teams Audio] ✅ Started system audio monitoring');
            
            this.audioProcess.stdout.on('data', (data) => {
                this.processAudioData(data);
            });
            
            this.audioProcess.stderr.on('data', (data) => {
                console.log('[Teams Audio] Audio process:', data.toString());
            });
            
            this.audioProcess.on('error', (error) => {
                console.error('[Teams Audio] ❌ Audio process error:', error.message);
            });
            
            this.audioProcess.on('close', (code) => {
                console.log(`[Teams Audio] Audio process exited with code ${code}`);
            });
            
        } catch (error) {
            console.error('[Teams Audio] ❌ Failed to setup audio capture:', error.message);
            throw error;
        }
    }

    processAudioData(audioData) {
        if (!this.isConnected || !this.whisperLive) {
            return;
        }
        
        // Add to buffer
        this.audioBuffer = Buffer.concat([this.audioBuffer, audioData]);
        
        // Send in chunks of ~1024 bytes (64ms at 16kHz mono)
        const chunkSize = 1024;
        while (this.audioBuffer.length >= chunkSize) {
            const chunk = this.audioBuffer.subarray(0, chunkSize);
            this.audioBuffer = this.audioBuffer.subarray(chunkSize);
            
            // Check if chunk contains actual audio (not silence)
            const samples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
            const hasSound = samples.some(sample => Math.abs(sample) > 100);
            
            if (hasSound) {
                try {
                    this.whisperLive.send(chunk);
                    // Show activity indicator occasionally
                    if (Math.random() < 0.01) { // 1% of chunks
                        process.stdout.write('🎵 ');
                    }
                } catch (error) {
                    console.error('[Teams Audio] ❌ Failed to send audio:', error.message);
                }
            }
        }
    }

    waitForProcess(process) {
        return new Promise((resolve, reject) => {
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Process exited with code ${code}`));
                }
            });
            
            process.on('error', reject);
        });
    }

    cleanup() {
        console.log('\n[Teams Audio] 🧹 Cleaning up...');
        
        if (this.audioProcess) {
            this.audioProcess.kill();
        }
        
        if (this.whisperLive) {
            this.whisperLive.close();
        }
        
        // Remove PulseAudio module
        spawn('pactl', ['unload-module', 'module-null-sink']);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Teams Audio] 🛑 Received SIGINT, shutting down...');
    if (global.teamsAudio) {
        global.teamsAudio.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Teams Audio] 🛑 Received SIGTERM, shutting down...');
    if (global.teamsAudio) {
        global.teamsAudio.cleanup();
    }
    process.exit(0);
});

// Start the Teams desktop audio capture
if (require.main === module) {
    const teamsAudio = new TeamsDesktopAudioCapture();
    global.teamsAudio = teamsAudio;
    teamsAudio.start().catch(console.error);
}

module.exports = TeamsDesktopAudioCapture;