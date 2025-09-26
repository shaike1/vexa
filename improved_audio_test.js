// Improved WhisperLive test with proper configuration
const WebSocket = require('ws');

console.log('🧪 Testing WhisperLive with complete configuration...');

const ws = new WebSocket('ws://vexa-whisperlive-cpu-1:9090');

ws.on('open', () => {
    console.log('✅ Connected to WhisperLive');
    
    // Send complete configuration that WhisperLive expects
    const config = {
        uid: 'test-session',
        platform: 'teams',
        meeting_url: 'https://test.teams.microsoft.com',
        token: 'test-token',
        meeting_id: 'test-meeting',
        language: 'en',
        task: 'transcribe',
        model: 'tiny',
        use_vad: false
    };
    
    ws.send(JSON.stringify(config));
    console.log('📤 Sent complete config to WhisperLive');
    
    // Wait for server ready response
    setTimeout(() => {
        console.log('🎵 Generating and sending test audio...');
        
        // Create more realistic audio data
        const sampleRate = 16000;
        const duration = 3; // 3 seconds
        const samples = sampleRate * duration;
        
        // Generate audio that sounds like speech (multiple frequencies)
        const audioBuffer = new ArrayBuffer(samples * 4); // Float32 = 4 bytes
        const audioData = new Float32Array(audioBuffer);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            // Mix multiple frequencies to simulate speech
            const freq1 = 300 + 100 * Math.sin(2 * Math.PI * 0.5 * t); // Varying fundamental
            const freq2 = freq1 * 2; // First harmonic
            const freq3 = freq1 * 3; // Second harmonic
            
            audioData[i] = (
                0.6 * Math.sin(2 * Math.PI * freq1 * t) +
                0.3 * Math.sin(2 * Math.PI * freq2 * t) +
                0.1 * Math.sin(2 * Math.PI * freq3 * t)
            ) * 0.3; // Moderate volume
        }
        
        console.log(`📡 Sending ${samples} samples of speech-like audio to WhisperLive`);
        ws.send(audioBuffer);
        
    }, 3000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📥 WhisperLive response:', JSON.stringify(message, null, 2));
        
        if (message.status === 'SERVER_READY') {
            console.log('✅ WhisperLive is ready to receive audio');
        } else if (message.segments && message.segments.length > 0) {
            console.log('🎯 TRANSCRIPTION RECEIVED:');
            message.segments.forEach(seg => {
                console.log(`   "${seg.text}" (${seg.start}s - ${seg.end}s)`);
            });
            
            if (message.segments.some(seg => seg.text.trim() !== "You")) {
                console.log('✅ SUCCESS: Got real transcription (not just "You")');
            } else {
                console.log('❌ ISSUE: Still getting "You" transcription');
            }
        }
    } catch (parseError) {
        console.log('📥 WhisperLive raw response:', data.toString());
    }
});

ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
});

setTimeout(() => {
    console.log('⏰ Test complete');
    ws.close();
    process.exit(0);
}, 15000);