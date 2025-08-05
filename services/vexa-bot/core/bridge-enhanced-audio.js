const WebSocket = require('ws');
const fs = require('fs');

class BridgeEnhancedTeamsAudioCapture {
    constructor(config) {
        this.config = config;
        this.bridgeSocket = null;
        this.isConnected = false;
        this.audioBuffer = [];
        this.sampleRate = 16000;
        this.sessionId = `bridge-bot-${Date.now()}`;
        // Connect to bridge instead of direct WhisperLive
        this.bridgeUrl = 'ws://localhost:8770';
    }

    async injectAudioCapture() {
        return `
(async function() {
    console.log('[Bridge Audio] 🌉 Initializing Teams audio capture via Bridge...');
    
    // Store original methods
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const originalRTCPeerConnection = window.RTCPeerConnection;
    
    let capturedAudioStream = null;
    let audioContext = null;
    let processor = null;
    
    // Enhanced audio processing function
    async function setupAudioProcessing(stream) {
        try {
            console.log('[Bridge Audio] 🎯 Setting up audio processing for stream');
            
            if (audioContext) {
                audioContext.close();
            }
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            const source = audioContext.createMediaStreamSource(stream);
            
            // Create ScriptProcessorNode for audio capture
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = async function(event) {
                if (!window.isBridgeReady) return;
                
                const inputBuffer = event.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                
                // Check if audio contains actual sound (not just silence)
                const hasSound = inputData.some(sample => Math.abs(sample) > 0.01);
                
                if (hasSound) {
                    console.log('[Bridge Audio] 🎯 REAL AUDIO DETECTED! Processing...');
                    
                    // Convert to 16-bit PCM
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                    }
                    
                    try {
                        await window.sendAudioToBridge(pcmData);
                    } catch (error) {
                        console.log('[Bridge Audio] Error sending audio to bridge:', error);
                    }
                } else {
                    // Silent audio - log occasionally
                    if (Math.random() < 0.001) { // ~0.1% of the time
                        console.log('[Bridge Audio] 🔇 Silent audio, skipping...');
                    }
                }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            console.log('[Bridge Audio] ✅ Audio processing setup complete');
            
        } catch (error) {
            console.log('[Bridge Audio] ❌ Error setting up audio processing:', error);
        }
    }
    
    // Intercept all audio streams
    navigator.mediaDevices.getUserMedia = async function(constraints) {
        console.log('[Bridge Audio] 📹 getUserMedia intercepted:', constraints);
        
        try {
            const stream = await originalGetUserMedia(constraints);
            
            if (constraints.audio && stream.getAudioTracks().length > 0) {
                console.log('[Bridge Audio] 🎯 AUDIO STREAM CAPTURED!');
                capturedAudioStream = stream;
                await setupAudioProcessing(stream);
            }
            
            return stream;
        } catch (error) {
            console.log('[Bridge Audio] getUserMedia error:', error);
            throw error;
        }
    };
    
    // Intercept WebRTC for meeting audio
    window.RTCPeerConnection = function(config) {
        console.log('[Bridge Audio] 🔗 RTCPeerConnection intercepted');
        const pc = new originalRTCPeerConnection(config);
        
        const originalAddTrack = pc.addTrack.bind(pc);
        pc.addTrack = function(track, stream) {
            console.log('[Bridge Audio] 🎵 Track added:', track.kind);
            
            if (track.kind === 'audio') {
                console.log('[Bridge Audio] 🎯 AUDIO TRACK DETECTED IN WEBRTC!');
                if (stream) {
                    setupAudioProcessing(stream);
                }
            }
            
            return originalAddTrack(track, stream);
        };
        
        const originalOnTrack = pc.ontrack;
        pc.addEventListener('track', function(event) {
            console.log('[Bridge Audio] 📡 Incoming track:', event.track.kind);
            
            if (event.track.kind === 'audio') {
                console.log('[Bridge Audio] 🎯 INCOMING AUDIO TRACK DETECTED!');
                if (event.streams && event.streams[0]) {
                    setupAudioProcessing(event.streams[0]);
                }
            }
            
            if (originalOnTrack) {
                originalOnTrack.call(this, event);
            }
        });
        
        return pc;
    };
    
    // Set up bridge audio sending function
    window.sendAudioToBridge = async function(audioData) {
        try {
            // Send to bridge server instead of direct HTTP
            const response = await fetch('http://localhost:8081/bridge-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionUid: '${this.sessionId}',
                    audioData: Array.from(audioData),
                    timestamp: Date.now(),
                    source: 'teams-browser-bot'
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send audio to bridge');
            }
        } catch (error) {
            console.log('[Bridge Audio] Failed to send audio to bridge:', error);
        }
    };
    
    // Mark bridge as ready
    window.isBridgeReady = true;
    
    console.log('[Bridge Audio] ✅ Bridge-enabled audio capture initialized');
    console.log('[Bridge Audio] 🌉 Connected to WhisperLive Bridge on port 8770');
    
    // Try to capture existing audio elements
    const audioElements = document.querySelectorAll('audio, video');
    for (const element of audioElements) {
        if (element.srcObject) {
            console.log('[Bridge Audio] 📺 Found existing media element');
            await setupAudioProcessing(element.srcObject);
        }
    }
    
    // Monitor for new audio elements
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                    console.log('[Bridge Audio] 📺 New media element detected');
                    if (node.srcObject) {
                        setupAudioProcessing(node.srcObject);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
})();
        `;
    }

    async connectToBridge() {
        try {
            console.log(`[Bridge Audio] 🌉 Connecting to WhisperLive Bridge: ${this.bridgeUrl}`);
            
            this.bridgeSocket = new WebSocket(this.bridgeUrl);
            
            return new Promise((resolve, reject) => {
                this.bridgeSocket.on('open', () => {
                    console.log('[Bridge Audio] ✅ Connected to WhisperLive Bridge');
                    
                    // Send initialization message to bridge
                    const initMessage = {
                        type: 'init',
                        session_id: this.sessionId,
                        platform: 'teams-browser-bot',
                        meeting_url: this.config.meetingUrl || '',
                        meeting_id: this.config.nativeMeetingId || 'browser-meeting',
                        timestamp: Date.now()
                    };
                    
                    console.log('[Bridge Audio] 📤 Sending init message to bridge:', initMessage);
                    this.bridgeSocket.send(JSON.stringify(initMessage));
                    
                    this.isConnected = true;
                    resolve();
                });
                
                this.bridgeSocket.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        console.log('[Bridge Audio] 📥 Bridge response:', message);
                        
                        if (message.type === 'transcription') {
                            const status = message.partial ? 'LIVE' : 'FINAL';
                            console.log(`[Bridge Audio] 🗣️ ${status} TRANSCRIPTION: ${message.text}`);
                        }
                    } catch (error) {
                        console.log('[Bridge Audio] 📥 Bridge binary response:', data.length, 'bytes');
                    }
                });
                
                this.bridgeSocket.on('error', (error) => {
                    console.log('[Bridge Audio] ❌ Bridge connection error:', error);
                    reject(error);
                });
                
                this.bridgeSocket.on('close', () => {
                    console.log('[Bridge Audio] 🔌 Bridge connection closed');
                    this.isConnected = false;
                });
            });
        } catch (error) {
            console.log('[Bridge Audio] ❌ Failed to connect to bridge:', error);
            throw error;
        }
    }

    async sendAudio(audioData) {
        if (!this.isConnected || !this.bridgeSocket) {
            console.log('[Bridge Audio] ⚠️ Not connected to bridge');
            return;
        }
        
        try {
            // Send audio as binary data to bridge
            const buffer = Buffer.from(new Int16Array(audioData).buffer);
            this.bridgeSocket.send(buffer);
            
            // Log occasionally to avoid spam
            if (Math.random() < 0.01) { // 1% of the time
                console.log(`[Bridge Audio] 🎵 Sent ${buffer.length} bytes to bridge`);
            }
        } catch (error) {
            console.log('[Bridge Audio] ❌ Error sending audio to bridge:', error);
        }
    }

    async disconnect() {
        if (this.bridgeSocket) {
            this.bridgeSocket.close();
            this.isConnected = false;
            console.log('[Bridge Audio] 🔌 Disconnected from bridge');
        }
    }
}

module.exports = BridgeEnhancedTeamsAudioCapture;