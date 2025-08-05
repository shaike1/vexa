const { spawn } = require('child_process');
const WebSocket = require('ws');

class HostAudioCapture {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.whisperSocket = null;
        this.audioProcess = null;
    }

    async start() {
        console.log('[Host Audio] 🎯 Starting host system audio capture...');
        
        await this.connectToWhisperLive();
        await this.captureHostAudio();
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[Host Audio] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams',
                    meeting_url: '',
                    token: `host-${this.sessionId}`,
                    meeting_id: this.sessionId
                };
                
                this.whisperSocket.send(JSON.stringify(initMessage));
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[Host Audio] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async captureHostAudio() {
        console.log('[Host Audio] 🎤 Capturing ALL host system audio...');
        
        // Try multiple audio capture approaches
        const commands = [
            // PulseAudio monitor
            ['parecord', ['--monitor', '-d', 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor', '--rate=16000', '--format=s16le', '--channels=1', '--raw']],
            // ALSA loopback
            ['arecord', ['-D', 'pulse', '-f', 'S16_LE', '-r', '16000', '-c', '1', '-t', 'raw']],
            // FFmpeg system audio
            ['ffmpeg', ['-f', 'pulse', '-i', 'default', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-f', 'wav', 'pipe:1']]
        ];
        
        for (const [cmd, args] of commands) {
            try {
                console.log(`[Host Audio] Trying ${cmd}...`);
                
                this.audioProcess = spawn(cmd, args);
                
                this.audioProcess.stdout.on('data', (data) => {
                    if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                        this.whisperSocket.send(data);
                        console.log(`[Host Audio] 📡 Sent ${data.length} bytes to WhisperLive`);
                    }
                });
                
                this.audioProcess.stderr.on('data', (data) => {
                    console.log(`[Host Audio] ${cmd}:`, data.toString());
                });
                
                this.audioProcess.on('error', (error) => {
                    console.log(`[Host Audio] ${cmd} failed:`, error.message);
                });
                
                // If process starts successfully, break
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (this.audioProcess && !this.audioProcess.killed) {
                    console.log(`[Host Audio] ✅ ${cmd} started successfully!`);
                    break;
                }
                
            } catch (error) {
                console.log(`[Host Audio] ${cmd} error:`, error.message);
            }
        }
    }
}

module.exports = HostAudioCapture;