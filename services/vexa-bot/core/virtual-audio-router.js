const { spawn, exec } = require('child_process');
const WebSocket = require('ws');
const util = require('util');
const execAsync = util.promisify(exec);

class VirtualAudioRouter {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.whisperSocket = null;
        this.captureProcess = null;
    }

    async start() {
        console.log('[Virtual Audio] 🎯 Setting up virtual audio routing...');
        
        try {
            await this.setupVirtualAudioDevices();
            await this.connectToWhisperLive();
            await this.startAudioCapture();
            await this.routeContainerAudio();
            
            console.log('[Virtual Audio] ✅ Virtual audio routing active!');
            
        } catch (error) {
            console.log('[Virtual Audio] ❌ Setup failed:', error);
        }
    }

    async setupVirtualAudioDevices() {
        console.log('[Virtual Audio] 🔧 Creating virtual audio devices...');
        
        try {
            // Create a null sink for capturing system audio
            await execAsync('pactl load-module module-null-sink sink_name=vexa_capture sink_properties=device.description="Vexa_Audio_Capture"');
            
            // Create a virtual source from the sink's monitor
            await execAsync('pactl load-module module-virtual-source source_name=vexa_capture_source master=vexa_capture.monitor source_properties=device.description="Vexa_Capture_Source"');
            
            // Set the default sink to route ALL system audio through our capture
            await execAsync('pactl set-default-sink vexa_capture');
            
            // Create a loopback to also play audio normally
            await execAsync('pactl load-module module-loopback source=vexa_capture.monitor sink=alsa_output.pci-0000_00_1f.3.analog-stereo');
            
            console.log('[Virtual Audio] ✅ Virtual audio devices created');
            
        } catch (error) {
            console.log('[Virtual Audio] Virtual device setup:', error.message);
        }
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[Virtual Audio] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams',
                    meeting_url: '',
                    token: `virtual-${this.sessionId}`,
                    meeting_id: this.sessionId
                };
                
                this.whisperSocket.send(JSON.stringify(initMessage));
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[Virtual Audio] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async startAudioCapture() {
        console.log('[Virtual Audio] 🎤 Starting virtual audio capture...');
        
        // Capture from our virtual source
        this.captureProcess = spawn('parecord', [
            '--device=vexa_capture_source',
            '--rate=16000',
            '--format=s16le',
            '--channels=1',
            '--raw'
        ]);
        
        this.captureProcess.stdout.on('data', (data) => {
            if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                // Check if audio contains actual sound
                const audioArray = new Int16Array(data.buffer);
                const hasSound = audioArray.some(sample => Math.abs(sample) > 100);
                
                if (hasSound) {
                    console.log('[Virtual Audio] 🎵 REAL AUDIO CAPTURED!');
                    this.whisperSocket.send(data);
                    console.log('[Virtual Audio] 📡 Sent', data.length, 'bytes to WhisperLive');
                }
            }
        });
        
        this.captureProcess.stderr.on('data', (data) => {
            console.log('[Virtual Audio] parecord:', data.toString());
        });
        
        this.captureProcess.on('close', (code) => {
            console.log('[Virtual Audio] Capture process closed:', code);
        });
    }

    async routeContainerAudio() {
        console.log('[Virtual Audio] 🔀 Routing container audio...');
        
        try {
            // Route all container audio output to our capture sink
            await execAsync('pactl set-default-sink vexa_capture');
            
            // Show current audio setup
            const { stdout } = await execAsync('pactl list short sinks');
            console.log('[Virtual Audio] Current sinks:', stdout);
            
            const { stdout: sources } = await execAsync('pactl list short sources');
            console.log('[Virtual Audio] Current sources:', sources);
            
        } catch (error) {
            console.log('[Virtual Audio] Audio routing:', error.message);
        }
    }

    stop() {
        if (this.captureProcess) {
            this.captureProcess.kill();
        }
        if (this.whisperSocket) {
            this.whisperSocket.close();
        }
    }
}

module.exports = VirtualAudioRouter;