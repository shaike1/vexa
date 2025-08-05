const WebSocket = require('ws');

// Simple test to verify bridge connection and send test audio
async function testBridge() {
    console.log('🧪 Testing Bridge Connection...');
    
    const ws = new WebSocket('ws://localhost:8770');
    
    ws.on('open', () => {
        console.log('✅ Connected to bridge');
        
        // Send init message
        const init = {
            type: 'init',
            session_id: 'test-desktop-audio',
            platform: 'desktop-test'
        };
        
        ws.send(JSON.stringify(init));
        
        // Send test audio data every second
        setInterval(() => {
            // Create fake audio data (16-bit PCM, 16kHz, mono)
            const samples = 16000 * 0.1; // 100ms of audio
            const audioBuffer = Buffer.alloc(samples * 2); // 16-bit = 2 bytes per sample
            
            // Fill with sine wave
            for (let i = 0; i < samples; i++) {
                const sample = Math.sin(2 * Math.PI * 440 * i / 16000) * 10000; // 440Hz tone
                audioBuffer.writeInt16LE(sample, i * 2);
            }
            
            ws.send(audioBuffer);
            console.log(`🎵 Sent ${audioBuffer.length} bytes of test audio`);
        }, 1000);
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            if (message.type === 'transcription') {
                console.log(`🗣️ TRANSCRIPTION: ${message.text}`);
            }
        } catch (error) {
            // Binary data
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Bridge error:', error);
    });
}

testBridge();