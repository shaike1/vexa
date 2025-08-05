const WebSocket = require('ws');
const fs = require('fs');

class EnhancedTeamsAudioCapture {
    constructor(config) {
        this.config = config;
        this.whisperSocket = null;
        this.isConnected = false;
        this.audioBuffer = [];
        this.sampleRate = 16000;
    }

    async injectAudioCapture() {
        return `
(async function() {
    console.log('[Enhanced Audio] Initializing Teams audio capture...');
    
    // Store original methods
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const originalRTCPeerConnection = window.RTCPeerConnection;
    
    let capturedAudioStream = null;
    let audioContext = null;
    let processor = null;
    
    // Enhanced audio processing function
    async function setupAudioProcessing(stream) {
        try {
            console.log('[Enhanced Audio] Setting up audio processing for stream');
            
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
                if (!window.isServerReady) return;
                
                const inputBuffer = event.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                
                // Convert to 16-bit PCM
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                }
                
                try {
                    await window.sendAudioToWhisper(Array.from(pcmData));
                } catch (error) {
                    console.log('[Enhanced Audio] Error sending audio:', error);
                }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            console.log('[Enhanced Audio] ✅ Audio processing setup complete');
            
        } catch (error) {
            console.log('[Enhanced Audio] ❌ Error setting up audio processing:', error);
        }
    }
    
    // Intercept all audio streams
    navigator.mediaDevices.getUserMedia = async function(constraints) {
        console.log('[Enhanced Audio] getUserMedia intercepted:', constraints);
        
        try {
            const stream = await originalGetUserMedia(constraints);
            
            if (constraints.audio && stream.getAudioTracks().length > 0) {
                console.log('[Enhanced Audio] 🎯 Audio stream captured!');
                capturedAudioStream = stream;
                await setupAudioProcessing(stream);
            }
            
            return stream;
        } catch (error) {
            console.log('[Enhanced Audio] getUserMedia error:', error);
            throw error;
        }
    };
    
    // Intercept WebRTC for meeting audio
    window.RTCPeerConnection = function(config) {
        console.log('[Enhanced Audio] RTCPeerConnection intercepted');
        const pc = new originalRTCPeerConnection(config);
        
        const originalAddTrack = pc.addTrack.bind(pc);
        pc.addTrack = function(track, stream) {
            console.log('[Enhanced Audio] Track added:', track.kind);
            
            if (track.kind === 'audio') {
                console.log('[Enhanced Audio] 🎯 Audio track detected in WebRTC!');
                if (stream) {
                    setupAudioProcessing(stream);
                }
            }
            
            return originalAddTrack(track, stream);
        };
        
        const originalOnTrack = pc.ontrack;
        pc.addEventListener('track', function(event) {
            console.log('[Enhanced Audio] Incoming track:', event.track.kind);
            
            if (event.track.kind === 'audio') {
                console.log('[Enhanced Audio] 🎯 Incoming audio track detected!');
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
    
    // Set up audio sending function
    window.sendAudioToWhisper = async function(audioData) {
        try {
            const response = await fetch('http://localhost:8080/audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionUid: '${this.config.connectionId}',
                    audioData: audioData
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send audio');
            }
        } catch (error) {
            console.log('[Enhanced Audio] Failed to send audio:', error);
        }
    };
    
    // Mark server as ready
    window.isServerReady = true;
    
    console.log('[Enhanced Audio] ✅ Enhanced audio capture initialized');
    
    // Try to capture existing audio elements
    const audioElements = document.querySelectorAll('audio, video');
    for (const element of audioElements) {
        if (element.srcObject) {
            console.log('[Enhanced Audio] Found existing media element');
            await setupAudioProcessing(element.srcObject);
        }
    }
    
})();
        `;
    }

    async connectToWhisperLive() {
        try {
            console.log('[Enhanced Audio] Connecting to WhisperLive...');
            
            this.whisperSocket = new WebSocket(this.config.whisperLiveUrl);
            
            return new Promise((resolve, reject) => {
                this.whisperSocket.on('open', () => {
                    console.log('[Enhanced Audio] ✅ Connected to WhisperLive');
                    
                    const initMessage = {
                        uid: this.config.connectionId,
                        language: this.config.language || 'en',
                        task: this.config.task || 'transcribe',
                        platform: this.config.platform || 'teams',
                        meeting_url: this.config.meetingUrl || '',
                        token: this.config.token || 'enhanced-token',
                        meeting_id: this.config.nativeMeetingId || 'enhanced-meeting'
                    };
                    
                    console.log('[Enhanced Audio] Sending init message:', initMessage);
                    this.whisperSocket.send(JSON.stringify(initMessage));
                    
                    this.isConnected = true;
                    resolve();
                });
                
                this.whisperSocket.on('message', (data) => {
                    const message = JSON.parse(data.toString());
                    console.log('[Enhanced Audio] WhisperLive response:', message);
                    
                    if (message.message && message.message !== 'SERVER_READY') {
                        console.log('[Enhanced Audio] 🎯 TRANSCRIPTION:', message.message);
                    }
                });
                
                this.whisperSocket.on('error', (error) => {
                    console.log('[Enhanced Audio] ❌ WhisperLive error:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.log('[Enhanced Audio] Failed to connect to WhisperLive:', error);
            throw error;
        }
    }

    async sendAudio(audioData) {
        if (!this.isConnected || !this.whisperSocket) {
            console.log('[Enhanced Audio] Not connected to WhisperLive');
            return;
        }
        
        try {
            // Send audio as binary data
            const buffer = Buffer.from(new Int16Array(audioData).buffer);
            this.whisperSocket.send(buffer);
        } catch (error) {
            console.log('[Enhanced Audio] Error sending audio:', error);
        }
    }
}

module.exports = EnhancedTeamsAudioCapture;