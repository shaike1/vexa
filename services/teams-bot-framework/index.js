const express = require('express');
const { BotFrameworkAdapter, ConversationState, MemoryStorage } = require('botbuilder');
const { TeamsAudioBot } = require('./bot/TeamsAudioBot');
const { AudioProcessor } = require('./services/AudioProcessor');
const { TranscriptionService } = require('./services/TranscriptionService');
require('dotenv').config();

// Create Express server
const app = express();
const port = process.env.PORT || 3978;

// Parse JSON bodies
app.use(express.json());

// Create Bot Framework adapter
const adapter = new BotFrameworkAdapter({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Error handler
adapter.onTurnError = async (context, error) => {
    console.error(`\n [onTurnError] unhandled error: ${error}`);
    console.error(error);
    await context.sendActivity('The bot encountered an error or bug.');
};

// Create conversation state
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);

// Create services
const audioProcessor = new AudioProcessor({
    whisperLiveUrl: process.env.WHISPERLIVE_URL
});

const transcriptionService = new TranscriptionService({
    speechKey: process.env.SPEECH_KEY,
    speechRegion: process.env.SPEECH_REGION
});

// Create the main dialog and bot
const bot = new TeamsAudioBot(conversationState, audioProcessor, transcriptionService);

// Listen for incoming requests
app.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        await bot.run(context);
    });
});

// Bot registration endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
            whisperLive: process.env.WHISPERLIVE_URL,
            speechService: process.env.SPEECH_REGION
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`\n🤖 Teams Bot Framework Server started`);
    console.log(`📍 Server listening on port ${port}`);
    console.log(`🔗 Bot endpoint: http://localhost:${port}/api/messages`);
    console.log(`💬 Ready for Teams integration!`);
});