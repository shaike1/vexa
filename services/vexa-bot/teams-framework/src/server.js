const restify = require('restify');
const { CloudAdapter, ConfigurationServiceClientCredentialFactory, createBotFrameworkAuthenticationFromConfiguration } = require('botbuilder');
const VexaTeamsBot = require('./teamsBot');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Teams Bot Framework Server
 * Hosts the official Microsoft Teams bot for meeting transcription
 */
class VexaTeamsBotServer {
    constructor() {
        this.server = null;
        this.bot = null;
        this.adapter = null;
        this.port = process.env.PORT || 3978;
        this.host = process.env.HOST || 'localhost';
    }
    
    async start() {
        console.log('🚀 Starting VexaAI Teams Bot Framework Server...');
        console.log('===============================================');
        
        try {
            await this.setupServer();
            await this.setupBotAdapter();
            await this.setupBot();
            await this.setupRoutes();
            
            // Start the server
            this.server.listen(this.port, this.host, () => {
                console.log('✅ VexaAI Teams Bot Server Started!');
                console.log(`🌐 Server running at: http://${this.host}:${this.port}`);
                console.log(`📞 Bot endpoint: http://${this.host}:${this.port}/api/messages`);
                console.log(`🎤 Call webhook: http://${this.host}:${this.port}/api/calls`);
                console.log('');
                console.log('📋 Next Steps:');
                console.log('1. Register this bot in Azure Bot Service');
                console.log('2. Configure Teams app manifest');
                console.log('3. Install bot in Teams');
                console.log('4. Invite bot to meetings');
                console.log('');
            });
            
        } catch (error) {
            console.error('❌ Failed to start server:', error.message);
            process.exit(1);
        }
    }
    
    async setupServer() {
        console.log('[Server] Setting up Restify server...');
        
        this.server = restify.createServer({
            name: 'VexaAI Teams Bot',
            version: '1.0.0'
        });
        
        this.server.use(restify.plugins.bodyParser());
        this.server.use(restify.plugins.queryParser());
        
        console.log('[Server] ✅ Restify server configured');
    }
    
    async setupBotAdapter() {
        console.log('[Server] Setting up Bot Framework adapter...');
        
        // Create credentials factory
        const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
            MicrosoftAppId: process.env.MICROSOFT_APP_ID,
            MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
            MicrosoftAppType: 'MultiTenant'
        });
        
        // Create authentication configuration
        const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
        
        // Create adapter
        this.adapter = new CloudAdapter(botFrameworkAuthentication);
        
        // Error handling
        this.adapter.onTurnError = async (context, error) => {
            console.error('[Server] ❌ Bot turn error:', error.message);
            console.error('[Server] Error stack:', error.stack);
            
            // Send error message to user
            await context.sendActivity('❌ Sorry, an error occurred processing your request.');
        };
        
        console.log('[Server] ✅ Bot Framework adapter ready');
    }
    
    async setupBot() {
        console.log('[Server] Initializing VexaAI Teams bot...');
        
        this.bot = new VexaTeamsBot();
        await this.bot.initialize();
        
        console.log('[Server] ✅ VexaAI Teams bot ready');
    }
    
    async setupRoutes() {
        console.log('[Server] Setting up API routes...');
        
        // Main bot messages endpoint
        this.server.post('/api/messages', async (req, res) => {
            console.log('[Server] 📨 Received bot message');
            
            await this.adapter.process(req, res, (context) => {
                return this.bot.run(context);
            });
        });
        
        // Call webhook endpoint for meeting audio
        this.server.post('/api/calls', async (req, res) => {
            console.log('[Server] 📞 Received call webhook');
            
            try {
                const callData = req.body;
                console.log('[Server] Call data:', callData);
                
                // Process call events (audio, participants, etc.)
                await this.handleCallEvent(callData);
                
                res.send(200, { status: 'success' });
                
            } catch (error) {
                console.error('[Server] ❌ Call webhook error:', error.message);
                res.send(500, { error: error.message });
            }
        });
        
        // Health check endpoint
        this.server.get('/health', (req, res) => {
            res.send(200, { 
                status: 'healthy',
                service: 'VexaAI Teams Bot',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            });
        });
        
        // Bot info endpoint
        this.server.get('/api/bot/info', (req, res) => {
            res.send(200, {
                name: process.env.BOT_NAME || 'VexaAI Transcription Bot',
                description: process.env.BOT_DESCRIPTION || 'Real-time meeting transcription',
                capabilities: ['audio', 'transcription', 'meetings'],
                status: 'ready'
            });
        });
        
        console.log('[Server] ✅ API routes configured');
    }
    
    async handleCallEvent(callData) {
        console.log('[Server] 🎤 Processing call event...');
        
        try {
            // Handle different call event types
            const eventType = callData['@odata.type'];
            
            switch (eventType) {
                case '#microsoft.graph.callEstablished':
                    console.log('[Server] ✅ Call established');
                    await this.handleCallEstablished(callData);
                    break;
                    
                case '#microsoft.graph.audioRoutingGroup':
                    console.log('[Server] 🎵 Audio routing event');
                    await this.handleAudioRouting(callData);
                    break;
                    
                case '#microsoft.graph.playPromptCompleted':
                    console.log('[Server] 🔊 Audio playback completed');
                    break;
                    
                case '#microsoft.graph.recordCompleted':
                    console.log('[Server] 📼 Audio recording completed');
                    await this.handleRecordingCompleted(callData);
                    break;
                    
                default:
                    console.log('[Server] 📋 Unknown call event type:', eventType);
            }
            
        } catch (error) {
            console.error('[Server] ❌ Call event error:', error.message);
        }
    }
    
    async handleCallEstablished(callData) {
        console.log('[Server] 🚀 Bot successfully joined the meeting');
        
        // Start recording/monitoring meeting audio
        if (this.bot && callData.id) {
            await this.bot.startAudioCapture(callData.id);
        }
    }
    
    async handleAudioRouting(callData) {
        console.log('[Server] 🎵 Processing audio routing data');
        
        // Extract audio data and send to WhisperLive
        if (callData.audioData && this.bot) {
            const audioBuffer = Buffer.from(callData.audioData, 'base64');
            await this.bot.processAudioData(audioBuffer);
        }
    }
    
    async handleRecordingCompleted(callData) {
        console.log('[Server] 📼 Processing completed audio recording');
        
        // Handle completed audio segments
        if (callData.recordedAudio && this.bot) {
            const audioBuffer = Buffer.from(callData.recordedAudio, 'base64');
            await this.bot.processAudioData(audioBuffer);
        }
    }
    
    async stop() {
        console.log('[Server] 🛑 Stopping server...');
        
        if (this.server) {
            this.server.close();
        }
        
        console.log('[Server] ✅ Server stopped');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n[Server] 🛑 Received SIGINT, shutting down gracefully...');
    if (global.serverInstance) {
        await global.serverInstance.stop();
    }
    process.exit(0);
});

// Start server if called directly
if (require.main === module) {
    const server = new VexaTeamsBotServer();
    global.serverInstance = server;
    server.start().catch(console.error);
}

module.exports = VexaTeamsBotServer;