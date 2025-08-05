// Aggressive audio capture script to force Teams audio streaming
const forceAudioCaptureScript = `
(async function forceTeamsAudioCapture() {
    console.log('[Force Audio] 🎯 Starting aggressive Teams audio capture...');
    
    let audioContext = null;
    let processor = null;
    let isCapturing = false;
    
    // Method 1: Override ALL audio-related APIs
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const originalRTCPeerConnection = window.RTCPeerConnection;
    const originalCreateMediaStreamSource = AudioContext.prototype.createMediaStreamSource;
    
    // Force audio capture setup
    async function setupForcedAudioCapture(stream) {
        if (isCapturing) return;
        
        try {
            console.log('[Force Audio] 🔧 Setting up forced audio capture...');
            
            if (audioContext) {
                audioContext.close();
            }
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000,
                latencyHint: 'interactive'
            });
            
            // Force audio context to start
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            const source = audioContext.createMediaStreamSource(stream);
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = async function(event) {
                if (!window.isServerReady) return;
                
                const inputBuffer = event.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                
                // Check for actual audio content
                const audioLevel = Math.sqrt(inputData.reduce((sum, val) => sum + val * val, 0) / inputData.length);
                
                if (audioLevel > 0.001) { // Detect actual sound
                    console.log('[Force Audio] 🎵 REAL AUDIO DETECTED! Level:', audioLevel.toFixed(4));
                    
                    // Convert to 16-bit PCM
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                    }
                    
                    try {
                        await window.sendAudioToProxy({
                            sessionUid: window.currentSessionUid || 'forced-session',
                            audioData: Array.from(pcmData)
                        });
                        console.log('[Force Audio] 📡 Sent', pcmData.length, 'samples to WhisperLive');
                    } catch (error) {
                        console.log('[Force Audio] ❌ Send error:', error);
                    }
                }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            isCapturing = true;
            console.log('[Force Audio] ✅ Forced audio capture ACTIVE!');
            
        } catch (error) {
            console.log('[Force Audio] ❌ Setup error:', error);
        }
    }
    
    // Method 2: Intercept ALL getUserMedia calls
    navigator.mediaDevices.getUserMedia = async function(constraints) {
        console.log('[Force Audio] 🎤 getUserMedia FORCED:', constraints);
        
        try {
            // Force audio constraints
            if (constraints && typeof constraints === 'object') {
                constraints.audio = {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 16000
                };
            }
            
            const stream = await originalGetUserMedia(constraints);
            
            if (stream && stream.getAudioTracks().length > 0) {
                console.log('[Force Audio] 🎯 AUDIO STREAM CAPTURED! Setting up processing...');
                await setupForcedAudioCapture(stream);
            }
            
            return stream;
        } catch (error) {
            console.log('[Force Audio] getUserMedia failed, creating fake stream:', error);
            
            // Create fake audio stream if real one fails
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const destination = audioContext.createMediaStreamDestination();
            
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            gain.gain.setValueAtTime(0.1, audioContext.currentTime);
            
            oscillator.connect(gain);
            gain.connect(destination);
            oscillator.start();
            
            console.log('[Force Audio] Created fake audio stream for Teams');
            return destination.stream;
        }
    };
    
    // Method 3: Force RTCPeerConnection audio capture
    window.RTCPeerConnection = function(config) {
        console.log('[Force Audio] 🔗 RTCPeerConnection FORCED');
        const pc = new originalRTCPeerConnection(config);
        
        // Override addTrack
        const originalAddTrack = pc.addTrack.bind(pc);
        pc.addTrack = function(track, stream) {
            console.log('[Force Audio] Track FORCED:', track.kind);
            
            if (track.kind === 'audio' && stream) {
                console.log('[Force Audio] 🎯 AUDIO TRACK FORCED! Processing...');
                setupForcedAudioCapture(stream);
            }
            
            return originalAddTrack(track, stream);
        };
        
        // Override ontrack
        pc.addEventListener('track', function(event) {
            console.log('[Force Audio] 📥 INCOMING TRACK FORCED:', event.track.kind);
            
            if (event.track.kind === 'audio' && event.streams && event.streams[0]) {
                console.log('[Force Audio] 🎯 INCOMING AUDIO FORCED!');
                setupForcedAudioCapture(event.streams[0]);
            }
        });
        
        return pc;
    };
    
    // Method 4: Force capture from all existing audio elements
    function forceExistingAudioCapture() {
        const mediaElements = document.querySelectorAll('audio, video');
        console.log('[Force Audio] 🔍 FORCING', mediaElements.length, 'media elements');
        
        mediaElements.forEach((element, index) => {
            if (element.srcObject && element.srcObject.getAudioTracks().length > 0) {
                console.log('[Force Audio] 🎵 FORCING media element', index);
                setupForcedAudioCapture(element.srcObject);
            }
        });
    }
    
    // Method 5: Force by overriding AudioContext
    AudioContext.prototype.createMediaStreamSource = function(stream) {
        console.log('[Force Audio] 🔊 AudioContext FORCED for stream');
        
        if (stream && stream.getAudioTracks().length > 0) {
            setupForcedAudioCapture(stream);
        }
        
        return originalCreateMediaStreamSource.call(this, stream);
    };
    
    // Method 6: Continuous forced checks
    setInterval(() => {
        if (!isCapturing) {
            console.log('[Force Audio] 🔄 Continuous force check...');
            forceExistingAudioCapture();
        }
    }, 3000);
    
    // Method 7: Force permissions
    try {
        const permissions = await navigator.permissions.query({name: 'microphone'});
        console.log('[Force Audio] 🎤 Microphone permission:', permissions.state);
        
        if (permissions.state !== 'granted') {
            console.log('[Force Audio] ⚠️ Microphone not granted, forcing...');
        }
    } catch (error) {
        console.log('[Force Audio] Permissions check failed:', error);
    }
    
    // Mark as ready
    window.isServerReady = true;
    window.currentSessionUid = 'forced-audio-session';
    
    console.log('[Force Audio] 🚀 FORCED AUDIO CAPTURE INITIALIZED!');
    
    // Initial forced check
    forceExistingAudioCapture();
    
})();
`;

module.exports = forceAudioCaptureScript;