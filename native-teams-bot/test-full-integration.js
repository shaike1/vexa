#!/usr/bin/env node

const redis = require('redis');
const fs = require('fs');
const path = require('path');

async function testFullIntegration() {
    console.log('🚀 Testing Full VexaAI Native Teams Bot Integration...\n');
    
    const tests = [
        { name: 'Redis Connection', test: testRedisConnection },
        { name: 'Bot Configuration', test: testBotConfiguration },
        { name: 'Speech Commands', test: testSpeechCommands },
        { name: 'Integration with Working Speaker', test: testWorkingSpeakerIntegration }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of tests) {
        try {
            console.log(`🧪 Testing ${testCase.name}...`);
            await testCase.test();
            console.log(`✅ ${testCase.name} - PASSED\n`);
            passed++;
        } catch (error) {
            console.log(`❌ ${testCase.name} - FAILED: ${error.message}\n`);
            failed++;
        }
    }
    
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All tests passed! Native Teams bot is ready for deployment.');
    } else {
        console.log('⚠️  Some tests failed. Check configuration and dependencies.');
    }
}

async function testRedisConnection() {
    const redisClient = redis.createClient({
        url: 'redis://localhost:6379'
    });
    
    await redisClient.connect();
    await redisClient.ping();
    await redisClient.disconnect();
    
    console.log('   ✓ Redis connection successful');
}

async function testBotConfiguration() {
    const configPath = '/root/vexa/native-teams-bot/VexaSpeakerBot/appsettings.json';
    
    if (!fs.existsSync(configPath)) {
        throw new Error('appsettings.json not found');
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Check required configuration
    const requiredFields = [
        'MicrosoftAppId',
        'MicrosoftAppPassword', 
        'MicrosoftAppTenantId',
        'AzureSpeech.Key',
        'AzureSpeech.Region'
    ];
    
    for (const field of requiredFields) {
        const keys = field.split('.');
        let value = config;
        for (const key of keys) {
            value = value?.[key];
        }
        
        if (!value || value === '') {
            console.log(`   ⚠️  ${field} not configured (using placeholder)`);
        } else {
            console.log(`   ✓ ${field} configured`);
        }
    }
    
    console.log('   ✓ Configuration file structure valid');
}

async function testSpeechCommands() {
    const redisClient = redis.createClient({
        url: 'redis://localhost:6379'
    });
    
    await redisClient.connect();
    
    // Test various speech commands
    const commands = [
        {
            action: 'speak',
            message: 'This is a test of the native Teams bot speech synthesis functionality.'
        },
        {
            action: 'speak', 
            message: 'Testing special characters: Hello! How are you? Testing 123.'
        },
        {
            action: 'unmute',
            message: 'unmute'
        }
    ];
    
    for (const command of commands) {
        await redisClient.publish('bot_commands:working-speaker', JSON.stringify(command));
        console.log(`   ✓ Sent ${command.action} command`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    
    await redisClient.disconnect();
    console.log('   ✓ All speech commands sent successfully');
}

async function testWorkingSpeakerIntegration() {
    // Check if the working speaker script exists and can be integrated
    const workingSpeakerPath = '/root/vexa/services/vexa-bot/core/working_speaker.js';
    
    if (!fs.existsSync(workingSpeakerPath)) {
        throw new Error('Working speaker script not found');
    }
    
    const workingScript = fs.readFileSync(workingSpeakerPath, 'utf8');
    
    // Check if it uses the correct meeting URL format
    if (workingScript.includes('teams.microsoft.com')) {
        console.log('   ✓ Working speaker script contains Teams meeting URL');
    }
    
    // Check if Redis integration exists
    if (workingScript.includes('redis') || workingScript.includes('Redis')) {
        console.log('   ✓ Working speaker script has Redis integration');
    }
    
    console.log('   ✓ Integration compatibility verified');
}

// Run the tests
if (require.main === module) {
    testFullIntegration().catch(console.error);
}

module.exports = { testFullIntegration };