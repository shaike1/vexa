const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');

class MemoryAudioScanner {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.whisperSocket = null;
        this.browserPid = null;
        this.scanning = false;
    }

    async start() {
        console.log('[Memory Scanner] 🧠 Starting memory audio buffer scanning...');
        
        try {
            await this.connectToWhisperLive();
            await this.findBrowserProcess();
            await this.startMemoryScanning();
            
            console.log('[Memory Scanner] ✅ Memory scanning active!');
            
        } catch (error) {
            console.log('[Memory Scanner] ❌ Failed to start memory scanning:', error);
        }
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[Memory Scanner] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams',
                    meeting_url: '',
                    token: \`memory-\${this.sessionId}\`,
                    meeting_id: this.sessionId
                };
                
                this.whisperSocket.send(JSON.stringify(initMessage));
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[Memory Scanner] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async findBrowserProcess() {
        console.log('[Memory Scanner] 🔍 Finding browser process...');
        
        return new Promise((resolve, reject) => {
            const ps = spawn('ps', ['aux']);
            let output = '';
            
            ps.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            ps.on('close', () => {
                // Look for Chrome/Chromium processes
                const lines = output.split('\\n');
                const browserProcess = lines.find(line => 
                    line.includes('chrome') || 
                    line.includes('chromium') || 
                    line.includes('node')
                );
                
                if (browserProcess) {
                    this.browserPid = browserProcess.split(/\\s+/)[1];
                    console.log(\`[Memory Scanner] 📍 Found browser PID: \${this.browserPid}\`);
                    resolve();
                } else {
                    reject(new Error('Browser process not found'));
                }
            });
        });
    }

    async startMemoryScanning() {
        console.log('[Memory Scanner] 🔎 Starting memory scan for audio patterns...');
        
        this.scanning = true;
        
        // Scan memory every 100ms for audio patterns
        const scanInterval = setInterval(async () => {
            if (!this.scanning) {
                clearInterval(scanInterval);
                return;
            }
            
            try {
                await this.scanForAudioBuffers();
            } catch (error) {
                console.log('[Memory Scanner] Scan error:', error.message);
            }
        }, 100);
    }

    async scanForAudioBuffers() {
        try {
            // Read process memory maps
            const mapsPath = \`/proc/\${this.browserPid}/maps\`;
            const maps = fs.readFileSync(mapsPath, 'utf8');
            
            // Find heap and stack regions
            const regions = maps.split('\\n').filter(line => 
                line.includes('[heap]') || 
                line.includes('[stack]') ||
                line.includes('rw-p')
            );
            
            for (const region of regions.slice(0, 3)) { // Limit to avoid overwhelming
                const parts = region.split(/\\s+/);
                if (parts.length < 2) continue;
                
                const [start, end] = parts[0].split('-');
                const startAddr = parseInt(start, 16);
                const endAddr = parseInt(end, 16);
                const size = Math.min(endAddr - startAddr, 1024 * 1024); // Max 1MB per scan
                
                if (size > 0) {
                    await this.scanMemoryRegion(startAddr, size);
                }
            }
            
        } catch (error) {
            // Memory access might fail, which is expected
        }
    }

    async scanMemoryRegion(startAddr, size) {
        try {
            // Try to read memory region
            const memPath = \`/proc/\${this.browserPid}/mem\`;
            const fd = fs.openSync(memPath, 'r');
            const buffer = Buffer.alloc(size);
            
            fs.readSync(fd, buffer, 0, size, startAddr);
            fs.closeSync(fd);
            
            // Look for audio patterns (16-bit PCM signatures)
            await this.analyzeForAudioData(buffer);
            
        } catch (error) {
            // Expected - memory regions often not readable
        }
    }

    async analyzeForAudioData(buffer) {
        // Look for patterns that suggest 16-bit audio data
        const samples = new Int16Array(buffer.buffer);
        
        // Check for audio-like patterns
        let consecutiveNonZero = 0;
        let audioLikeSequences = 0;
        
        for (let i = 0; i < Math.min(samples.length, 4096); i++) {
            const sample = samples[i];
            
            if (Math.abs(sample) > 100 && Math.abs(sample) < 32000) {
                consecutiveNonZero++;
            } else {
                if (consecutiveNonZero > 100) {
                    audioLikeSequences++;
                }
                consecutiveNonZero = 0;
            }
        }
        
        // If we found audio-like patterns, send to WhisperLive
        if (audioLikeSequences > 2) {
            console.log('[Memory Scanner] 🎵 POTENTIAL AUDIO FOUND!');
            
            // Extract what looks like audio data
            const audioData = samples.slice(0, 4096);
            const audioBuffer = Buffer.from(audioData.buffer);
            
            if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                this.whisperSocket.send(audioBuffer);
                console.log(\`[Memory Scanner] 📡 Sent \${audioBuffer.length} bytes to WhisperLive\`);
            }
        }
    }

    stop() {
        this.scanning = false;
        if (this.whisperSocket) {
            this.whisperSocket.close();
        }
    }
}

module.exports = MemoryAudioScanner;