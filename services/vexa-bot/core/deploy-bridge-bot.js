const BridgeEnhancedTeamsAudioCapture = require('./bridge-enhanced-audio');

async function deployBridgeBot(meetingUrl) {
    console.log('🤖 Deploying Bridge-Enabled Teams Bot...');
    console.log('=' * 50);
    
    // Bot configuration with bridge integration
    const botConfig = {
        meetingUrl: meetingUrl,
        platform: "teams",
        botName: "VexaAI-Bridge-Bot",
        language: "en",
        task: "transcribe",
        authMode: "guest",
        connectionId: `bridge-session-${Date.now()}`,
        nativeMeetingId: `bridge-meeting-${Date.now()}`,
        bridgeEnabled: true
    };

    console.log('🔧 Bot Configuration:');
    console.log('  Bridge Mode: ENABLED');
    console.log('  Meeting URL:', meetingUrl);
    console.log('  Session ID:', botConfig.connectionId);
    console.log('  HTTP Adapter: http://localhost:8081');
    console.log('  WhisperLive Bridge: ws://localhost:8770');

    // Create enhanced audio capture with bridge support
    const audioCapture = new BridgeEnhancedTeamsAudioCapture(botConfig);

    try {
        console.log('\n🌉 Connecting to WhisperLive Bridge...');
        await audioCapture.connectToBridge();
        console.log('✅ Connected to WhisperLive Bridge successfully!');

        console.log('\n🎯 Injecting bridge-enabled audio capture...');
        const audioScript = await audioCapture.injectAudioCapture();
        
        console.log('\n📋 Audio Capture Script Ready:');
        console.log('  - Teams audio interception: ENABLED');
        console.log('  - Bridge streaming: CONFIGURED');
        console.log('  - Real-time processing: READY');

        console.log('\n🚀 BRIDGE BOT READY FOR DEPLOYMENT!');
        console.log('=' * 50);
        console.log('Next steps:');
        console.log('1. Use this audio script in your browser bot');
        console.log('2. Bot will automatically stream audio to bridge');  
        console.log('3. Bridge forwards to WhisperLive for transcription');
        console.log('4. Watch for transcription logs in bridge adapter');

        return {
            config: botConfig,
            audioScript: audioScript,
            audioCapture: audioCapture,
            bridgeConnected: audioCapture.isConnected
        };

    } catch (error) {
        console.error('❌ Failed to deploy bridge bot:', error);
        throw error;
    }
}

// Export for use in other scripts
module.exports = { deployBridgeBot };

// If run directly
if (require.main === module) {
    const meetingUrl = process.argv[2];
    
    if (!meetingUrl) {
        console.error('❌ Please provide a Teams meeting URL');
        console.log('Usage: node deploy-bridge-bot.js "TEAMS_MEETING_URL"');
        process.exit(1);
    }

    deployBridgeBot(meetingUrl)
        .then((result) => {
            console.log('\n✅ Bridge bot deployment successful!');
            console.log('🎯 Bot is ready for Teams meeting integration');
            
            // Keep process alive to maintain bridge connection
            process.on('SIGINT', async () => {
                console.log('\n🛑 Shutting down bridge bot...');
                if (result.audioCapture) {
                    await result.audioCapture.disconnect();
                }
                process.exit(0);
            });
        })
        .catch((error) => {
            console.error('❌ Bridge bot deployment failed:', error);
            process.exit(1);
        });
}