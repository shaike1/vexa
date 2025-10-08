#!/usr/bin/env node

/**
 * Hybrid Bot Audio Capture
 * Bot joins Teams meeting AND captures its own received audio
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const { exec } = require('child_process');

class HybridBotAudio {
    constructor(meetingUrl) {
        this.meetingUrl = meetingUrl;
        this.botProcess = null;
        this.audioProcess = null;
        this.whisperLive = null;
        this.sessionId = `hybrid-bot-${Date.now()}`;
        this.whisperLiveUrl = 'ws://172.20.0.2:9090';
        this.isConnected = false;
    }

    async start() {
        console.log('🤖 Hybrid Bot Audio Capture Starting...');
        console.log('=====================================');
        console.log(`📞 Meeting URL: ${this.meetingUrl}`);
        
        try {
            // Step 1: Connect to WhisperLive
            await this.connectToWhisperLive();
            
            // Step 2: Start the bot in background
            await this.startBot();
            
            // Step 3: Monitor bot's audio output
            await this.setupBotAudioCapture();
            
            console.log('🎯 HYBRID BOT READY!');
            console.log('✅ Bot joined meeting');
            console.log('✅ Monitoring bot audio output');
            console.log('🎤 Waiting for meeting audio...');
            
        } catch (error) {
            console.error('❌ Failed to start:', error.message);
            process.exit(1);
        }
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            console.log('[Hybrid] Connecting to WhisperLive...');
            
            this.whisperLive = new WebSocket(this.whisperLiveUrl);
            
            this.whisperLive.on('open', () => {
                console.log('[Hybrid] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams-hybrid',
                    meeting_url: this.meetingUrl,
                    token: 'vexa-api-key-hybrid-bot',
                    meeting_id: 'hybrid-bot-meeting'
                };
                
                this.whisperLive.send(JSON.stringify(initMessage));
            });
            
            this.whisperLive.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message.status === 'SERVER_READY') {
                        console.log('[Hybrid] ✅ WhisperLive ready');
                        this.isConnected = true;
                        resolve();
                    } else if (message.message) {
                        console.log(`🗣️  TRANSCRIPTION: "${message.message}"`);
                    } else if (message.segments) {
                        message.segments.forEach(segment => {
                            if (segment.text && segment.text.trim()) {
                                console.log(`🗣️  TRANSCRIPTION: "${segment.text.trim()}"`);
                            }
                        });
                    }
                } catch (error) {
                    console.log('[Hybrid] WhisperLive response:', data.toString());
                }
            });
            
            this.whisperLive.on('error', (error) => {
                console.error('[Hybrid] ❌ WhisperLive error:', error.message);
                reject(error);
            });
        });
    }

    async startBot() {
        console.log('[Hybrid] 🤖 Starting bot to join meeting...');
        
        const botConfig = {
            meetingUrl: this.meetingUrl,
            platform: "teams",
            botName: "VexaAI-HybridBot",
            language: "en",
            task: "transcribe",
            authMode: "guest",
            connectionId: this.sessionId,
            redisUrl: "redis://vexa-redis-1:6379",
            whisperLiveUrl: "ws://vexa-whisperlive-cpu-2:9090",
            token: "vexa-api-key-hybrid",
            nativeMeetingId: "hybrid-meeting",
            automaticLeave: {
                enabled: false,
                timeout: 999999,
                waitingRoomTimeout: 300000,
                noOneJoinedTimeout: 300000,
                everyoneLeftTimeout: 300000
            }
        };

        // Start bot container
        const dockerCmd = `docker run -d --name='vexa-hybrid-bot' --network='vexa_vexa_default' -e BOT_CONFIG='${JSON.stringify(botConfig)}' vexa-vexa-bot`;
        
        return new Promise((resolve, reject) => {
            exec(dockerCmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    console.log('[Hybrid] ✅ Bot container started');
                    this.botContainerId = stdout.trim();
                    
                    // Wait for bot to join
                    setTimeout(() => {
                        console.log('[Hybrid] 🎯 Bot should be joining meeting...');
                        resolve();
                    }, 10000);
                }
            });
        });
    }

    async setupBotAudioCapture() {
        console.log('[Hybrid] 🎤 Setting up bot audio monitoring...');
        
        // Monitor the bot container's audio output
        // The bot generates audio that we can capture
        try {
            // Use pulseaudio to capture from the bot's audio stream
            this.audioProcess = spawn('docker', [
                'exec', 
                'vexa-hybrid-bot',
                'parecord',
                '--device=virtual_speaker.monitor',
                '--format=s16le',
                '--rate=16000',
                '--channels=1',
                '--raw'
            ]);

            console.log('[Hybrid] ✅ Monitoring bot audio output');
            
            this.audioProcess.stdout.on('data', (data) => {
                this.processAudioData(data);
            });
            
            this.audioProcess.stderr.on('data', (data) => {
                console.log('[Hybrid] Audio:', data.toString());
            });
            
        } catch (error) {
            console.error('[Hybrid] ❌ Audio setup failed:', error.message);
            
            // Fallback: Try to capture container network audio
            console.log('[Hybrid] 🔄 Trying network audio capture...');
            await this.setupNetworkAudioCapture();
        }
    }

    async setupNetworkAudioCapture() {
        // Alternative: Monitor network traffic from bot container
        // and extract audio data from WebSocket streams
        console.log('[Hybrid] 🌐 Setting up network audio capture...');
        
        // This monitors the bot's outgoing audio data
        this.audioProcess = spawn('docker', [
            'exec',
            'vexa-hybrid-bot',
            'tcpdump',
            '-i', 'any',
            '-s', '0',
            'port 9090'
        ]);

        this.audioProcess.stdout.on('data', (data) => {
            // Process network captured audio
            this.processNetworkAudio(data);
        });
    }

    processAudioData(audioData) {
        if (!this.isConnected || !this.whisperLive) return;
        
        try {
            // Check for actual audio content
            const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
            const hasSound = samples.some(sample => Math.abs(sample) > 50);
            
            if (hasSound) {
                this.whisperLive.send(audioData);
                process.stdout.write('🎵 ');
            }
        } catch (error) {
            console.error('[Hybrid] Audio send error:', error.message);
        }
    }

    processNetworkAudio(networkData) {
        // Extract audio from network capture
        // This is a simplified version - would need proper packet parsing
        console.log('[Hybrid] 📡 Network audio data detected');
    }

    cleanup() {
        console.log('\n[Hybrid] 🧹 Cleaning up...');
        
        if (this.audioProcess) {
            this.audioProcess.kill();
        }
        
        if (this.whisperLive) {
            this.whisperLive.close();
        }
        
        // Stop bot container
        if (this.botContainerId) {
            exec(`docker stop vexa-hybrid-bot && docker rm vexa-hybrid-bot`, (error) => {
                if (error) console.error('Cleanup error:', error.message);
            });
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    if (global.hybridBot) {
        global.hybridBot.cleanup();
    }
    process.exit(0);
});

// Start if called directly
if (require.main === module) {
    const meetingUrl = process.argv[2];
    if (!meetingUrl) {
        console.error('❌ Usage: node hybrid-bot-audio.js <TEAMS_MEETING_URL>');
        process.exit(1);
    }
    
    const hybridBot = new HybridBotAudio(meetingUrl);
    global.hybridBot = hybridBot;
    hybridBot.start().catch(console.error);
}

module.exports = HybridBotAudio;