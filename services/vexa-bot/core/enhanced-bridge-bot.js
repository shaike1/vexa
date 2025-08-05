const BridgeEnhancedTeamsAudioCapture = require('./bridge-enhanced-audio');

// Enhanced bot configuration for bridge mode
const botConfig = {
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_MDI0MmY0NmQtNTM1Yy00NzljLTg0Y2QtNjZlOTNiZDExMDdi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d",
    platform: "teams",
    botName: "VexaAI-Bridge-LiveTest",
    language: "en", 
    task: "transcribe",
    authMode: "guest",
    connectionId: `bridge-live-${Date.now()}`,
    nativeMeetingId: `bridge-meeting-${Date.now()}`,
    bridgeEnabled: true,
    // Bridge-specific configuration
    bridgeUrl: "ws://localhost:8770",
    httpAdapterUrl: "http://localhost:8081",
    automaticLeave: {
        enabled: false,
        timeout: 999999,
        waitingRoomTimeout: 300000,
        noOneJoinedTimeout: 300000,
        everyoneLeftTimeout: 300000
    }
};

console.log('🤖 Enhanced Bridge Bot Configuration:');
console.log('  Meeting URL:', botConfig.meetingUrl);
console.log('  Session ID:', botConfig.connectionId);
console.log('  Bridge Mode: ENABLED');
console.log('  HTTP Adapter:', botConfig.httpAdapterUrl);
console.log('  WhisperLive Bridge:', botConfig.bridgeUrl);

// Export as JSON for container deployment
const containerConfig = JSON.stringify(botConfig);
console.log('\n📦 Container deployment config:');
console.log('BOT_CONFIG=' + containerConfig);

module.exports = { botConfig, containerConfig };