const CDP = require('chrome-remote-interface');
const WebSocket = require('ws');

class CDPAudioHack {
    constructor(whisperLiveUrl, sessionId) {
        this.whisperLiveUrl = whisperLiveUrl;
        this.sessionId = sessionId;
        this.client = null;
        this.whisperSocket = null;
    }

    async start() {
        console.log('[CDP Hack] 🔧 Starting Chrome DevTools Protocol audio hack...');
        
        try {
            // Connect to Chrome DevTools
            this.client = await CDP();
            const { Page, Runtime, Debugger, Network } = this.client;
            
            await Promise.all([
                Page.enable(),
                Runtime.enable(),
                Debugger.enable(),
                Network.enable()
            ]);
            
            console.log('[CDP Hack] ✅ Connected to Chrome DevTools');
            
            // Connect to WhisperLive
            await this.connectToWhisperLive();
            
            // Hook into WebRTC APIs
            await this.hookWebRTC();
            
            // Monitor network for WebRTC traffic
            await this.monitorWebRTCTraffic();
            
            console.log('[CDP Hack] 🎯 CDP audio hack active!');
            
        } catch (error) {
            console.log('[CDP Hack] ❌ Failed to start CDP hack:', error);
        }
    }

    async connectToWhisperLive() {
        return new Promise((resolve, reject) => {
            this.whisperSocket = new WebSocket(this.whisperLiveUrl);
            
            this.whisperSocket.on('open', () => {
                console.log('[CDP Hack] ✅ Connected to WhisperLive');
                
                const initMessage = {
                    uid: this.sessionId,
                    language: 'en',
                    task: 'transcribe',
                    platform: 'teams',
                    meeting_url: '',
                    token: `cdp-${this.sessionId}`,
                    meeting_id: this.sessionId
                };
                
                this.whisperSocket.send(JSON.stringify(initMessage));
                resolve();
            });
            
            this.whisperSocket.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.text && message.text.trim()) {
                    console.log('[CDP Hack] 🗣️ TRANSCRIPTION:', message.text);
                }
            });
            
            this.whisperSocket.on('error', reject);
        });
    }

    async hookWebRTC() {
        const { Runtime } = this.client;
        
        // Hook RTCPeerConnection
        const hookScript = \`
        (function() {
            console.log('[CDP Hack] Hooking WebRTC APIs...');
            
            const originalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = function(config) {
                console.log('[CDP Hack] 🔗 RTCPeerConnection intercepted!');
                const pc = new originalRTCPeerConnection(config);
                
                // Hook ontrack for incoming audio
                pc.addEventListener('track', function(event) {
                    console.log('[CDP Hack] 📥 Track received:', event.track.kind);
                    
                    if (event.track.kind === 'audio') {
                        console.log('[CDP Hack] 🎯 AUDIO TRACK DETECTED!');
                        
                        // Create audio context to process the track
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const source = audioContext.createMediaStreamSource(event.streams[0]);
                        const processor = audioContext.createScriptProcessor(4096, 1, 1);
                        
                        processor.onaudioprocess = function(e) {
                            const inputData = e.inputBuffer.getChannelData(0);
                            
                            // Check for actual audio
                            const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
                            if (hasAudio) {
                                console.log('[CDP Hack] 🎵 REAL AUDIO DETECTED!');
                                
                                // Convert to 16-bit PCM and send via CDP
                                const pcmData = new Int16Array(inputData.length);
                                for (let i = 0; i < inputData.length; i++) {
                                    pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                                }
                                
                                window.cdpSendAudio && window.cdpSendAudio(Array.from(pcmData));
                            }
                        };
                        
                        source.connect(processor);
                        processor.connect(audioContext.destination);
                    }
                });
                
                return pc;
            };
            
            // Hook getUserMedia
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async function(constraints) {
                console.log('[CDP Hack] 🎤 getUserMedia hooked!');
                
                const stream = await originalGetUserMedia(constraints);
                
                if (constraints.audio && stream.getAudioTracks().length > 0) {
                    console.log('[CDP Hack] 🎯 MICROPHONE STREAM CAPTURED!');
                    
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioContext.createMediaStreamSource(stream);
                    const processor = audioContext.createScriptProcessor(4096, 1, 1);
                    
                    processor.onaudioprocess = function(e) {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
                        
                        if (hasAudio) {
                            console.log('[CDP Hack] 🎵 MIC AUDIO!');
                            const pcmData = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                            }
                            window.cdpSendAudio && window.cdpSendAudio(Array.from(pcmData));
                        }
                    };
                    
                    source.connect(processor);
                    processor.connect(audioContext.destination);
                }
                
                return stream;
            };
            
            console.log('[CDP Hack] ✅ WebRTC hooks installed!');
        })();
        \`;
        
        // Add audio sender function
        await Runtime.evaluate({
            expression: \`
            window.cdpSendAudio = function(audioData) {
                // This will be intercepted by CDP
                console.log('[CDP Hack] Sending audio data:', audioData.length);
            };
            \`
        });
        
        // Inject the hook script
        await Runtime.evaluate({ expression: hookScript });
    }

    async monitorWebRTCTraffic() {
        const { Network } = this.client;
        
        Network.responseReceived((params) => {
            if (params.response.url.includes('webrtc') || 
                params.response.mimeType.includes('audio') ||
                params.response.url.includes('media')) {
                console.log('[CDP Hack] 📡 WebRTC traffic detected:', params.response.url);
            }
        });
        
        Network.webSocketFrameReceived((params) => {
            console.log('[CDP Hack] 🔌 WebSocket frame received, might contain audio data');
        });
    }
}

module.exports = CDPAudioHack;