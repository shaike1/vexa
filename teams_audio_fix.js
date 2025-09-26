// Teams Audio Fix - WebRTC Participant Audio Capture
// This replaces the broken getUserMedia() approach with WebRTC stream interception

console.log('🔧 TEAMS AUDIO FIX: WebRTC Participant Capture');
console.log('================================================');
console.log('This script demonstrates how to capture PARTICIPANT audio instead of bot microphone');
console.log('');

// Function to inject into Teams page to capture participant audio
const teamsAudioFix = `
// FIXED TEAMS AUDIO CAPTURE - Intercepts WebRTC streams
(function() {
    console.log('🎯 INJECTING TEAMS AUDIO FIX - WebRTC Stream Interception');
    
    let participantStreams = [];
    let audioContext = null;
    let audioProcessor = null;
    
    // Step 1: Intercept RTCPeerConnection to capture remote audio
    const originalRTCPeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = function(...args) {
        console.log('🔗 New RTCPeerConnection created');
        const pc = new originalRTCPeerConnection(...args);
        
        // Listen for remote audio tracks (participant audio)
        pc.addEventListener('track', (event) => {
            if (event.track.kind === 'audio') {
                console.log('🎵 FOUND PARTICIPANT AUDIO TRACK:', event.track.id);
                
                if (event.streams && event.streams.length > 0) {
                    const stream = event.streams[0];
                    participantStreams.push(stream);
                    console.log('✅ Added participant stream. Total streams:', participantStreams.length);
                    
                    // Process this participant's audio for transcription
                    processParticipantAudio(stream);
                }
            } else if (event.track.kind === 'video') {
                console.log('📹 Found video track (ignoring for audio fix)');
            }
        });
        
        return pc;
    };
    
    // Step 2: Process participant audio for transcription
    function processParticipantAudio(stream) {
        try {
            console.log('🎵 Processing participant audio stream for transcription...');
            
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('✅ Created audio context for participant audio');
            }
            
            // Create audio source from participant stream
            const source = audioContext.createMediaStreamSource(stream);
            
            // Create processor for real-time analysis
            audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            audioProcessor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                
                // Calculate audio levels
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += Math.abs(inputData[i]);
                }
                const avgLevel = sum / inputData.length;
                
                // Log audio levels periodically
                if (Math.random() < 0.01) { // 1% of the time
                    if (avgLevel > 0.001) {
                        console.log('🎵 PARTICIPANT AUDIO LEVEL:', avgLevel.toFixed(6), '(REAL AUDIO!)');
                    } else {
                        console.log('🔇 PARTICIPANT AUDIO LEVEL:', avgLevel.toFixed(6), '(silence)');
                    }
                }
                
                // If we have real audio, resample and send to WhisperLive
                if (avgLevel > 0.0001) {
                    // Resample to 16kHz for Whisper
                    const targetLength = Math.round(inputData.length * (16000 / audioContext.sampleRate));
                    const resampledData = new Float32Array(targetLength);
                    
                    // Simple resampling
                    const ratio = (inputData.length - 1) / (targetLength - 1);
                    for (let i = 0; i < targetLength; i++) {
                        const index = i * ratio;
                        const leftIndex = Math.floor(index);
                        const rightIndex = Math.ceil(index);
                        const fraction = index - leftIndex;
                        
                        if (rightIndex < inputData.length) {
                            resampledData[i] = inputData[leftIndex] + 
                                (inputData[rightIndex] - inputData[leftIndex]) * fraction;
                        } else {
                            resampledData[i] = inputData[leftIndex];
                        }
                    }
                    
                    // Send to WhisperLive via the existing proxy function
                    if (window.sendAudioToProxy) {
                        window.sendAudioToProxy({
                            sessionUid: 'fixed-audio-session',
                            audioData: Array.from(resampledData)
                        }).catch(err => {
                            console.log('❌ Error sending participant audio:', err.message);
                        });
                        
                        // Occasional success logging
                        if (Math.random() < 0.001) {
                            console.log('✅ FIXED: Sent participant audio to WhisperLive');
                        }
                    } else {
                        console.log('⚠️ sendAudioToProxy function not available');
                    }
                }
            };
            
            // Connect audio processing pipeline
            source.connect(audioProcessor);
            audioProcessor.connect(audioContext.destination);
            
            console.log('✅ FIXED AUDIO PIPELINE: Participant → WhisperLive');
            
        } catch (error) {
            console.log('❌ Error processing participant audio:', error.message);
        }
    }
    
    // Step 3: Also try to find existing audio elements
    function findExistingAudioElements() {
        console.log('🔍 Searching for existing audio elements...');
        
        const audioElements = document.querySelectorAll('audio, video');
        console.log('Found', audioElements.length, 'media elements');
        
        audioElements.forEach((element, index) => {
            if (element.srcObject instanceof MediaStream) {
                const stream = element.srcObject;
                const audioTracks = stream.getAudioTracks();
                
                if (audioTracks.length > 0) {
                    console.log('🎵 Found audio element', index, 'with', audioTracks.length, 'audio tracks');
                    processParticipantAudio(stream);
                }
            }
        });
        
        // Set up observer for new elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        if ((element.tagName === 'AUDIO' || element.tagName === 'VIDEO') && 
                            element.srcObject instanceof MediaStream) {
                            console.log('🆕 New media element detected');
                            processParticipantAudio(element.srcObject);
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    // Initialize the fix
    console.log('🚀 INITIALIZING TEAMS AUDIO FIX');
    console.log('This will capture PARTICIPANT audio instead of bot microphone');
    
    // Try to find existing audio immediately
    setTimeout(findExistingAudioElements, 2000);
    
    // Also check periodically for new audio
    setInterval(findExistingAudioElements, 15000);
    
    console.log('✅ Teams audio fix initialized - participant audio should now be captured');
    
})();
`;

console.log('📋 TEAMS AUDIO FIX IMPLEMENTATION:');
console.log('');
console.log('This script should be injected into the Teams meeting page to:');
console.log('  1. ✅ Intercept WebRTC connections for participant audio');
console.log('  2. ✅ Process participant audio instead of bot microphone');
console.log('  3. ✅ Send real audio data to WhisperLive');
console.log('  4. ✅ Generate real transcriptions instead of "You"');
console.log('');
console.log('🚀 TO DEPLOY THIS FIX:');
console.log('  1. Inject this script into the bot\'s Teams page');
console.log('  2. The script will automatically intercept participant audio');
console.log('  3. Real audio will be sent to WhisperLive');
console.log('  4. Transcriptions should show actual speech content');
console.log('');
console.log('✅ FIX READY FOR IMPLEMENTATION!');

// Export the fix for injection
module.exports = { teamsAudioFix };