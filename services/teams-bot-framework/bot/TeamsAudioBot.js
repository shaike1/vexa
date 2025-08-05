const { TeamsActivityHandler, MessageFactory, TurnContext } = require('botbuilder');

class TeamsAudioBot extends TeamsActivityHandler {
    constructor(conversationState, audioProcessor, transcriptionService) {
        super();
        
        this.conversationState = conversationState;
        this.audioProcessor = audioProcessor;
        this.transcriptionService = transcriptionService;
        this.activeTranscriptions = new Map();

        // Handle when members are added to the conversation
        this.onMembersAdded(async (context, next) => {
            const welcomeText = 'Welcome! I\'m the Vexa AI transcription bot. I can provide real-time transcription for your Teams meetings.';
            
            for (const member of context.activity.membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    const welcomeMessage = MessageFactory.text(welcomeText);
                    await context.sendActivity(welcomeMessage);
                }
            }
            
            await next();
        });

        // Handle regular messages
        this.onMessage(async (context, next) => {
            const userMessage = context.activity.text;
            
            console.log(`[Teams Bot] Received message: ${userMessage}`);
            
            if (userMessage.toLowerCase().includes('start transcription')) {
                await this.startTranscription(context);
            } else if (userMessage.toLowerCase().includes('stop transcription')) {
                await this.stopTranscription(context);
            } else if (userMessage.toLowerCase().includes('status')) {
                await this.getTranscriptionStatus(context);
            } else {
                const responseText = `I can help with transcription! Try saying:
- "start transcription" - Begin real-time transcription
- "stop transcription" - End transcription
- "status" - Check transcription status`;
                
                await context.sendActivity(MessageFactory.text(responseText));
            }
            
            await next();
        });

        // Handle Teams meeting events
        this.onTeamsMeetingStart(async (context, next) => {
            console.log('[Teams Bot] 🎯 Meeting started - ready for transcription');
            
            const meetingMessage = MessageFactory.text('Meeting started! Say "start transcription" to begin real-time transcription.');
            await context.sendActivity(meetingMessage);
            
            await next();
        });

        this.onTeamsMeetingEnd(async (context, next) => {
            console.log('[Teams Bot] 🔚 Meeting ended - stopping transcription');
            
            await this.stopTranscription(context);
            
            const endMessage = MessageFactory.text('Meeting ended. Transcription has been stopped.');
            await context.sendActivity(endMessage);
            
            await next();
        });
    }

    async startTranscription(context) {
        try {
            const conversationId = context.activity.conversation.id;
            const meetingId = context.activity.channelData?.meeting?.id;
            
            console.log(`[Teams Bot] 🎤 Starting transcription for meeting: ${meetingId}`);
            
            // Initialize audio processing for this conversation
            const sessionId = `teams-${Date.now()}`;
            
            await this.audioProcessor.startSession(sessionId, {
                meetingId: meetingId,
                conversationId: conversationId,
                platform: 'teams-framework'
            });
            
            // Set up transcription callback
            this.audioProcessor.onTranscription(sessionId, async (transcription) => {
                await this.sendTranscriptionUpdate(context, transcription);
            });
            
            this.activeTranscriptions.set(conversationId, {
                sessionId: sessionId,
                startTime: new Date(),
                meetingId: meetingId
            });
            
            const confirmMessage = MessageFactory.text('✅ Real-time transcription started! I\'ll show transcriptions as people speak.');
            await context.sendActivity(confirmMessage);
            
        } catch (error) {
            console.error('[Teams Bot] Failed to start transcription:', error);
            
            const errorMessage = MessageFactory.text('❌ Failed to start transcription. Please try again.');
            await context.sendActivity(errorMessage);
        }
    }

    async stopTranscription(context) {
        const conversationId = context.activity.conversation.id;
        const session = this.activeTranscriptions.get(conversationId);
        
        if (session) {
            console.log(`[Teams Bot] 🛑 Stopping transcription for session: ${session.sessionId}`);
            
            await this.audioProcessor.stopSession(session.sessionId);
            this.activeTranscriptions.delete(conversationId);
            
            const duration = new Date() - session.startTime;
            const durationText = Math.round(duration / 1000);
            
            const stopMessage = MessageFactory.text(`✅ Transcription stopped. Session duration: ${durationText} seconds.`);
            await context.sendActivity(stopMessage);
        } else {
            const noSessionMessage = MessageFactory.text('ℹ️ No active transcription session found.');
            await context.sendActivity(noSessionMessage);
        }
    }

    async getTranscriptionStatus(context) {
        const conversationId = context.activity.conversation.id;
        const session = this.activeTranscriptions.get(conversationId);
        
        if (session) {
            const duration = new Date() - session.startTime;
            const durationText = Math.round(duration / 1000);
            
            const statusMessage = MessageFactory.text(`🟢 Transcription active for ${durationText} seconds
Meeting ID: ${session.meetingId}
Session ID: ${session.sessionId}`);
            
            await context.sendActivity(statusMessage);
        } else {
            const inactiveMessage = MessageFactory.text('🔴 No active transcription session.');
            await context.sendActivity(inactiveMessage);
        }
    }

    async sendTranscriptionUpdate(context, transcription) {
        try {
            // Format the transcription with speaker identification if available
            let transcriptionText = `🗣️ **Transcription**: ${transcription.text}`;
            
            if (transcription.speaker) {
                transcriptionText = `🗣️ **${transcription.speaker}**: ${transcription.text}`;
            }
            
            if (transcription.confidence) {
                transcriptionText += ` _(${Math.round(transcription.confidence * 100)}% confidence)_`;
            }
            
            const transcriptionMessage = MessageFactory.text(transcriptionText);
            await context.sendActivity(transcriptionMessage);
            
        } catch (error) {
            console.error('[Teams Bot] Failed to send transcription update:', error);
        }
    }

    async run(context) {
        await super.run(context);
        
        // Save conversation state
        await this.conversationState.saveChanges(context, false);
    }
}

module.exports.TeamsAudioBot = TeamsAudioBot;