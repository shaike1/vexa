#!/usr/bin/env node

const redis = require('redis');

async function testNativeTeamsBotCommunication() {
    console.log('🤖 Testing Native Teams Bot Redis Communication...');
    
    try {
        // Connect to Redis
        const redisClient = redis.createClient({
            url: 'redis://localhost:6379'
        });
        
        await redisClient.connect();
        console.log('✅ Connected to Redis');
        
        // Test speak command
        const speakCommand = {
            action: 'speak',
            message: 'Hello from the native Teams bot test script. This is a test of Azure Speech Services integration.'
        };
        
        console.log('📤 Sending speak command to native Teams bot...');
        await redisClient.publish('bot_commands:working-speaker', JSON.stringify(speakCommand));
        console.log('✅ Speak command sent successfully');
        
        // Test unmute command
        const unmuteCommand = {
            action: 'unmute',
            message: 'unmute'
        };
        
        console.log('📤 Sending unmute command to native Teams bot...');
        await redisClient.publish('bot_commands:working-speaker', JSON.stringify(unmuteCommand));
        console.log('✅ Unmute command sent successfully');
        
        await redisClient.disconnect();
        console.log('✅ Native Teams bot communication test completed');
        
    } catch (error) {
        console.error('❌ Error testing native Teams bot:', error);
    }
}

testNativeTeamsBotCommunication();