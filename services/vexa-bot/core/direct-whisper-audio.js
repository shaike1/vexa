const { spawn } = require('child_process');
const WebSocket = require('ws');

class DirectWhisperAudio {
    constructor() {
        this.whisperUrl = 'ws://localhost:9090';
        this.whisperSocket = null;
        this.recording = false;
        this.audioProcess = null;
        this.sessionId = `direct-audio-${Date.now()}`;
    }

    async connectToWhisperLive() {
        try {
            console.log('[Direct Audio] 🎯 Connecting directly to WhisperLive...');
            
            this.whisperSocket = new WebSocket(this.whisperUrl);
            
            return new Promise((resolve, reject) => {
                this.whisperSocket.on('open', () => {
                    console.log('[Direct Audio] ✅ Connected to WhisperLive');
                    
                    // Send WhisperLive initialization
                    const initMessage = {
                        uid: this.sessionId,
                        language: 'en',
                        task: 'transcribe',
                        platform: 'direct-audio',
                        meeting_url: 'direct://microphone-capture',
                        token: 'vexa-direct-audio-token',
                        meeting_id: `direct-${Date.now()}`
                    };
                    
                    this.whisperSocket.send(JSON.stringify(initMessage));
                    console.log('[Direct Audio] 📤 Sent initialization to WhisperLive');
                    resolve();
                });
                
                this.whisperSocket.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.message === 'SERVER_READY') {
                            console.log('[Direct Audio] 🟢 WhisperLive server ready!');
                        } else if (message.message && message.message.includes('transcription')) {
                            console.log(`[Direct Audio] 🗣️ TRANSCRIPTION: ${message.text || message.message}`);
                        } else {
                            console.log('[Direct Audio] 📨 WhisperLive message:', message);
                        }
                    } catch (error) {
                        // Binary or non-JSON data
                        console.log('[Direct Audio] 📦 Received binary data from WhisperLive');
                    }
                });
                
                this.whisperSocket.on('error', (error) => {
                    console.error('[Direct Audio] ❌ WhisperLive error:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('[Direct Audio] ❌ Connection failed:', error);
            throw error;
        }
    }

    async startMicrophoneCapture() {
        try {
            console.log('[Direct Audio] 🎤 Starting microphone capture...');
            
            // Use parecord to capture from default microphone
            this.audioProcess = spawn('parecord', [
                '--format=s16le',    // 16-bit signed little endian
                '--rate=16000',      // 16kHz sample rate
                '--channels=1',      // Mono
                '--raw',             // Raw PCM output
                '--device=@DEFAULT_SOURCE@'  // Default microphone
            ]);

            this.audioProcess.stdout.on('data', (audioData) => {
                if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                    // Send raw audio data directly to WhisperLive
                    this.whisperSocket.send(audioData);
                    
                    // Log occasionally
                    if (Math.random() < 0.01) { // 1% of the time
                        console.log(`[Direct Audio] 🎵 Sent ${audioData.length} bytes to WhisperLive`);
                    }
                }
            });

            this.audioProcess.stderr.on('data', (data) => {
                const error = data.toString();
                if (!error.includes('Warning')) {
                    console.log('[Direct Audio] PulseAudio:', error.trim());
                }
            });

            this.audioProcess.on('close', (code) => {
                console.log(`[Direct Audio] 🔴 Audio capture stopped (code: ${code})`);
                this.recording = false;
            });

            this.recording = true;
            console.log('[Direct Audio] ✅ Microphone capture started');
            console.log('[Direct Audio] 🎤 SPEAK NOW - Your voice will be transcribed in real-time!');

        } catch (error) {
            console.error('[Direct Audio] ❌ Failed to start microphone capture:', error);
            throw error;
        }
    }

    async stop() {
        console.log('[Direct Audio] 🛑 Stopping audio capture...');
        
        this.recording = false;
        
        if (this.audioProcess) {
            this.audioProcess.kill('SIGTERM');
            this.audioProcess = null;
        }
        
        if (this.whisperSocket) {
            this.whisperSocket.close();
            this.whisperSocket = null;
        }
        
        console.log('[Direct Audio] ✅ Audio capture stopped');
    }

    isRecording() {
        return this.recording;
    }
}

module.exports = { DirectWhisperAudio };

// If run directly
if (require.main === module) {
    const directAudio = new DirectWhisperAudio();
    
    async function main() {
        try {
            console.log('🎯 Direct WhisperLive Audio Capture Starting...');
            console.log('===============================================');
            
            await directAudio.connectToWhisperLive();
            await directAudio.startMicrophoneCapture();
            
            console.log('\n🎤 READY FOR REAL-TIME TRANSCRIPTION!');
            console.log('Speak into your microphone...');
            console.log('Press Ctrl+C to stop...');
            
            // Keep running
            process.on('SIGINT', async () => {
                console.log('\n🛑 Shutting down...');
                await directAudio.stop();
                process.exit(0);
            });
            
        } catch (error) {
            console.error('❌ Direct audio capture failed:', error);
            process.exit(1);
        }
    }
    
    main();
}