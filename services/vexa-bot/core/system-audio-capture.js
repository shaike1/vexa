const { spawn } = require('child_process');
const WebSocket = require('ws');

class SystemAudioCapture {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.whisperSocket = null;
        this.audioProcess = null;
        this.isConnected = false;
    }

    async start() {
        try {
            console.log('[System Audio] 🎯 Starting system-level audio capture...');
            
            // Connect to WhisperLive
            await this.connectToWhisperLive();
            
            // Start system audio capture
            await this.startSystemAudioCapture();
            
            console.log('[System Audio] ✅ System audio capture active!');
            
        } catch (error) {
            console.log('[System Audio] ❌ Error starting system audio:', error);
        }
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[System Audio] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams',
                    meeting_url: '',
                    token: `system-${this.sessionId}`,
                    meeting_id: this.sessionId
                };
                
                this.whisperSocket.send(JSON.stringify(initMessage));
                this.isConnected = true;
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[System Audio] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async startSystemAudioCapture() {
        try {
            console.log('[System Audio] 🎤 Starting system microphone capture...');
            
            // Use arecord to capture system audio
            this.audioProcess = spawn('arecord', [
                '-D', 'pulse',
                '-f', 'S16_LE',
                '-r', '16000',
                '-c', '1',
                '-t', 'raw'
            ]);
            
            this.audioProcess.stdout.on('data', (data) => {
                if (this.isConnected && this.whisperSocket.readyState === WebSocket.OPEN) {
                    // Send raw audio data directly to WhisperLive
                    this.whisperSocket.send(data);
                    console.log('[System Audio] 📡 Sent', data.length, 'bytes to WhisperLive');
                }
            });
            
            this.audioProcess.stderr.on('data', (data) => {
                console.log('[System Audio] arecord:', data.toString());
            });
            
            this.audioProcess.on('close', (code) => {
                console.log('[System Audio] arecord process closed with code', code);
            });
            
            console.log('[System Audio] ✅ arecord process started');
            
        } catch (error) {
            console.log('[System Audio] ❌ Failed to start system audio capture:', error);
        }
    }

    stop() {
        if (this.audioProcess) {
            this.audioProcess.kill();
        }
        if (this.whisperSocket) {
            this.whisperSocket.close();
        }
    }
}

module.exports = SystemAudioCapture;