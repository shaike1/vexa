const { spawn } = require('child_process');
const WebSocket = require('ws');

class DesktopAudioRouter {
    constructor(bridgeUrl = 'ws://localhost:8771') {
        this.bridgeUrl = bridgeUrl;
        this.bridgeSocket = null;
        this.recording = false;
        this.audioProcess = null;
        this.sessionId = `desktop-audio-${Date.now()}`;
    }

    async connectToBridge() {
        try {
            console.log('[Desktop Audio] 🌉 Connecting to WhisperLive Bridge...');
            
            this.bridgeSocket = new WebSocket(this.bridgeUrl);
            
            return new Promise((resolve, reject) => {
                this.bridgeSocket.on('open', () => {
                    console.log('[Desktop Audio] ✅ Connected to bridge');
                    
                    // Send initialization
                    const initMessage = {
                        type: 'init',
                        session_id: this.sessionId,
                        platform: 'desktop-audio-router',
                        timestamp: Date.now(),
                        // Add WhisperLive connection details
                        uid: this.sessionId,
                        language: 'en',
                        task: 'transcribe',
                        meeting_url: 'desktop://microphone-capture',
                        token: 'vexa-desktop-audio-token',
                        meeting_id: `desktop-${Date.now()}`
                    };
                    
                    this.bridgeSocket.send(JSON.stringify(initMessage));
                    resolve();
                });
                
                this.bridgeSocket.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.type === 'transcription') {
                            const status = message.partial ? 'LIVE' : 'FINAL';
                            console.log(`[Desktop Audio] 🗣️ ${status}: ${message.text}`);
                        }
                    } catch (error) {
                        // Binary data, ignore
                    }
                });
                
                this.bridgeSocket.on('error', reject);
            });
        } catch (error) {
            console.error('[Desktop Audio] ❌ Bridge connection failed:', error);
            throw error;
        }
    }

    async startDesktopAudioCapture() {
        try {
            console.log('[Desktop Audio] 🎤 Starting desktop audio capture...');
            
            // Use parecord to capture from default source (microphone)
            this.audioProcess = spawn('parecord', [
                '--format=s16le',    // 16-bit signed little endian
                '--rate=16000',      // 16kHz sample rate
                '--channels=1',      // Mono
                '--raw',             // Raw PCM output
                '--device=@DEFAULT_SOURCE@'  // Default microphone
            ]);

            this.audioProcess.stdout.on('data', (audioData) => {
                if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
                    // Send raw audio data to bridge
                    this.bridgeSocket.send(audioData);
                    
                    // Log occasionally
                    if (Math.random() < 0.001) { // 0.1% of the time
                        console.log(`[Desktop Audio] 🎵 Sent ${audioData.length} bytes to bridge`);
                    }
                }
            });

            this.audioProcess.stderr.on('data', (data) => {
                const error = data.toString();
                if (!error.includes('Warning')) {
                    console.log('[Desktop Audio] PulseAudio:', error.trim());
                }
            });

            this.audioProcess.on('close', (code) => {
                console.log(`[Desktop Audio] 🔴 Audio capture stopped (code: ${code})`);
                this.recording = false;
            });

            this.recording = true;
            console.log('[Desktop Audio] ✅ Desktop audio capture started');
            console.log('[Desktop Audio] 🎤 Speak into your microphone for transcription!');

        } catch (error) {
            console.error('[Desktop Audio] ❌ Failed to start audio capture:', error);
            throw error;
        }
    }

    async startSystemAudioCapture() {
        try {
            console.log('[Desktop Audio] 🔊 Starting system audio capture...');
            
            // Capture system audio (speakers/output)
            this.audioProcess = spawn('parecord', [
                '--format=s16le',
                '--rate=16000', 
                '--channels=1',
                '--raw',
                '--device=@DEFAULT_SINK@.monitor'  // System audio output
            ]);

            this.audioProcess.stdout.on('data', (audioData) => {
                if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
                    this.bridgeSocket.send(audioData);
                    
                    if (Math.random() < 0.001) {
                        console.log(`[Desktop Audio] 🔊 System audio: ${audioData.length} bytes`);
                    }
                }
            });

            this.audioProcess.stderr.on('data', (data) => {
                const error = data.toString();
                if (!error.includes('Warning')) {
                    console.log('[Desktop Audio] PulseAudio:', error.trim());
                }
            });

            this.recording = true;
            console.log('[Desktop Audio] ✅ System audio capture started');
            console.log('[Desktop Audio] 🔊 Playing audio from Teams will be transcribed!');

        } catch (error) {
            console.error('[Desktop Audio] ❌ Failed to start system audio capture:', error);
            throw error;
        }
    }

    async stop() {
        console.log('[Desktop Audio] 🛑 Stopping audio capture...');
        
        this.recording = false;
        
        if (this.audioProcess) {
            this.audioProcess.kill('SIGTERM');
            this.audioProcess = null;
        }
        
        if (this.bridgeSocket) {
            this.bridgeSocket.close();
            this.bridgeSocket = null;
        }
        
        console.log('[Desktop Audio] ✅ Audio capture stopped');
    }

    isRecording() {
        return this.recording;
    }
}

module.exports = { DesktopAudioRouter };

// If run directly
if (require.main === module) {
    const router = new DesktopAudioRouter();
    
    async function main() {
        try {
            console.log('🎤 Desktop Audio Router Starting...');
            console.log('=====================================');
            
            await router.connectToBridge();
            
            // Get command line argument for audio source
            const audioSource = process.argv[2] || 'microphone';
            
            if (audioSource === 'system') {
                console.log('🔊 Capturing SYSTEM AUDIO (Teams meeting audio)');
                await router.startSystemAudioCapture();
            } else {
                console.log('🎤 Capturing MICROPHONE AUDIO (your voice)');
                await router.startDesktopAudioCapture();
            }
            
            console.log('\n🎯 READY FOR TRANSCRIPTION!');
            console.log('Press Ctrl+C to stop...');
            
            // Keep running
            process.on('SIGINT', async () => {
                console.log('\n🛑 Shutting down...');
                await router.stop();
                process.exit(0);
            });
            
        } catch (error) {
            console.error('❌ Desktop audio router failed:', error);
            process.exit(1);
        }
    }
    
    main();
}