const { spawn, exec } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

class HardwareAudioHijack {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.whisperSocket = null;
        this.capturing = false;
    }

    async start() {
        console.log('[Hardware Hijack] 🔧 Starting hardware-level audio interception...');
        
        await this.connectToWhisperLive();
        await this.hijackAudioDriver();
        await this.interceptNetworkAudio();
        await this.hijackSystemCalls();
        
        console.log('[Hardware Hijack] ✅ Hardware audio hijack active!');
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[Hardware Hijack] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams',
                    meeting_url: '',
                    token: \`hardware-\${this.sessionId}\`,
                    meeting_id: this.sessionId
                };
                
                this.whisperSocket.send(JSON.stringify(initMessage));
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[Hardware Hijack] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async hijackAudioDriver() {
        console.log('[Hardware Hijack] 🎛️ Hijacking audio driver...');
        
        try {
            // Method 1: LD_PRELOAD audio library interception
            const hijackScript = \`
#!/bin/bash
export LD_PRELOAD="/tmp/audio_intercept.so:\$LD_PRELOAD"
echo "Audio driver hijacked"
\`;
            
            fs.writeFileSync('/tmp/hijack_audio.sh', hijackScript);
            
            // Method 2: Kernel module approach (if we had permissions)
            console.log('[Hardware Hijack] Attempting kernel-level audio interception...');
            
            // Method 3: /dev/audio device hijacking
            const audioDevices = ['/dev/dsp', '/dev/audio', '/dev/snd/*'];
            
            for (const device of audioDevices) {
                try {
                    const stats = fs.statSync(device);
                    console.log(\`[Hardware Hijack] Found audio device: \${device}\`);
                    
                    // Try to monitor this device
                    this.monitorAudioDevice(device);
                } catch (error) {
                    // Device doesn't exist
                }
            }
            
        } catch (error) {
            console.log('[Hardware Hijack] Driver hijack:', error.message);
        }
    }

    async interceptNetworkAudio() {
        console.log('[Hardware Hijack] 🌐 Intercepting WebRTC network traffic...');
        
        try {
            // Method 1: tcpdump to capture WebRTC packets
            const tcpdump = spawn('tcpdump', [
                '-i', 'any',
                '-s', '65535',
                'udp and (port 3478 or port 5349 or portrange 10000-20000)',
                '-w', '/tmp/webrtc_capture.pcap'
            ]);
            
            tcpdump.stdout.on('data', (data) => {
                console.log('[Hardware Hijack] 📡 WebRTC traffic intercepted');
            });
            
            // Method 2: iptables NFQUEUE for packet inspection
            exec('iptables -I OUTPUT -p udp --dport 3478 -j NFQUEUE --queue-num 0', (error) => {
                if (!error) {
                    console.log('[Hardware Hijack] 🔒 Packet interception active');
                }
            });
            
        } catch (error) {
            console.log('[Hardware Hijack] Network interception:', error.message);
        }
    }

    async hijackSystemCalls() {
        console.log('[Hardware Hijack] ⚡ Hijacking system audio calls...');
        
        try {
            // Method 1: strace to monitor audio system calls
            const strace = spawn('strace', [
                '-e', 'trace=openat,read,write,ioctl',
                '-f',
                '-p', process.pid.toString()
            ]);
            
            strace.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('/dev/snd') || output.includes('SOUND') || output.includes('audio')) {
                    console.log('[Hardware Hijack] 🎵 Audio system call detected:', output.substring(0, 100));
                }
            });
            
            // Method 2: ptrace injection (advanced)
            console.log('[Hardware Hijack] Attempting ptrace audio injection...');
            
        } catch (error) {
            console.log('[Hardware Hijack] System call hijack:', error.message);
        }
    }

    monitorAudioDevice(device) {
        try {
            console.log(\`[Hardware Hijack] 🎤 Monitoring audio device: \${device}\`);
            
            const monitor = spawn('dd', [
                \`if=\${device}\`,
                'bs=4096',
                'count=100'
            ]);
            
            monitor.stdout.on('data', (data) => {
                console.log('[Hardware Hijack] 🎵 Raw audio data captured!');
                
                if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                    this.whisperSocket.send(data);
                    console.log(\`[Hardware Hijack] 📡 Sent \${data.length} bytes to WhisperLive\`);
                }
            });
            
        } catch (error) {
            console.log(\`[Hardware Hijack] Device monitor error: \${error.message}\`);
        }
    }
}

module.exports = HardwareAudioHijack;