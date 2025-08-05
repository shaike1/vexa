const BridgeHttpAdapter = require('./bridge-http-adapter');

async function startAdapter() {
    console.log('🚀 Starting HTTP-to-Bridge Adapter...');
    
    // Use port 8081 to avoid conflicts
    const adapter = new BridgeHttpAdapter('ws://localhost:8770', 8081);
    
    try {
        await adapter.start();
        console.log('✅ HTTP-to-Bridge Adapter started successfully!');
        console.log('📡 Browser bot can now send audio to: http://localhost:8081/bridge-audio');
        
        // Keep the process alive
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down adapter...');
            await adapter.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start adapter:', error);
        process.exit(1);
    }
}

startAdapter();