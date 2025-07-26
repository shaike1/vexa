#!/usr/bin/env node

const { spawn } = require('child_process');
const Redis = require('redis');
const fs = require('fs').promises;
const path = require('path');

console.log('🎤 Starting System-Level TTS Audio Injector...');

// Redis connection
const redis = Redis.createClient({
    url: 'redis://localhost:6379'
});

redis.on('error', (err) => {
    console.log('❌ Redis Client Error:', err);
});

redis.on('connect', () => {
    console.log('✅ Connected to Redis');
});

async function speakWithSystemTTS(text) {
    try {
        console.log(`🔊 System TTS Speaking: "${text}"`);
        
        // Generate unique filename
        const timestamp = Date.now();
        const audioFile = `/tmp/system_tts_${timestamp}.wav`;
        
        // Use espeak to generate audio file
        const espeak = spawn('espeak', [
            '-s', '150',  // Speed
            '-v', 'en',   // Voice
            '-w', audioFile,  // Write to file
            text
        ]);
        
        await new Promise((resolve, reject) => {
            espeak.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Audio file generated: ${audioFile}`);
                    resolve();
                } else {
                    reject(new Error(`espeak failed with code ${code}`));
                }
            });
            
            espeak.on('error', reject);
        });
        
        // Try to play audio through system speakers (multiple attempts)
        try {
            // Method 1: aplay (ALSA)
            console.log('🔊 Attempting to play audio with aplay...');
            const aplay = spawn('aplay', [audioFile]);
            
            await new Promise((resolve) => {
                aplay.on('close', (code) => {
                    console.log(`aplay exit code: ${code}`);
                    resolve();
                });
                
                setTimeout(resolve, 3000); // 3 second timeout
            });
        } catch (e) {
            console.log('⚠️ aplay failed, trying paplay...');
            
            try {
                // Method 2: paplay (PulseAudio)
                const paplay = spawn('paplay', [audioFile]);
                
                await new Promise((resolve) => {
                    paplay.on('close', (code) => {
                        console.log(`paplay exit code: ${code}`);
                        resolve();
                    });
                    
                    setTimeout(resolve, 3000);
                });
            } catch (e2) {
                console.log('⚠️ paplay failed, audio file created but not played');
            }
        }
        
        // Keep the file for verification
        console.log(`📁 Audio file saved: ${audioFile}`);
        
        // Also try to inject into PulseAudio virtual sink
        try {
            console.log('🔊 Attempting PulseAudio virtual sink injection...');
            
            // Create virtual sink if not exists
            spawn('pactl', ['load-module', 'module-null-sink', 'sink_name=virtual_speaker']);
            
            // Play to virtual sink
            const paplayVirtual = spawn('paplay', ['--device=virtual_speaker', audioFile]);
            
            await new Promise((resolve) => {
                paplayVirtual.on('close', resolve);
                setTimeout(resolve, 2000);
            });
            
            console.log('✅ Virtual sink audio injection attempted');
        } catch (e) {
            console.log('⚠️ Virtual sink injection failed:', e.message);
        }
        
    } catch (error) {
        console.error('❌ System TTS Error:', error);
    }
}

async function main() {
    try {
        await redis.connect();
        
        console.log('📡 Subscribing to Redis channel: bot_commands:working-speaker');
        
        await redis.subscribe('bot_commands:working-speaker', async (message) => {
            try {
                console.log(`📨 Received Redis message: ${message}`);
                
                const command = JSON.parse(message);
                
                if (command.action === 'speak' && command.message) {
                    await speakWithSystemTTS(command.message);
                } else if (command.action === 'test') {
                    await speakWithSystemTTS('System TTS injector is working correctly');
                }
                
            } catch (error) {
                console.error('❌ Error processing Redis message:', error);
            }
        });
        
        console.log('🎯 System TTS Audio Injector ready and listening...');
        
        // Test the system
        setTimeout(() => {
            speakWithSystemTTS('System TTS Audio Injector initialized and ready for voice injection');
        }, 2000);
        
    } catch (error) {
        console.error('❌ Failed to start System TTS Audio Injector:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down System TTS Audio Injector...');
    await redis.disconnect();
    process.exit(0);
});

main();