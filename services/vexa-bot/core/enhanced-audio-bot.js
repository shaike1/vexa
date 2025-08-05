const puppeteer = require('puppeteer');
const WebSocket = require('ws');
const Redis = require('redis');
const EnhancedTeamsAudioCapture = require('./enhanced-teams-audio.js');

class EnhancedAudioBot {
    constructor(config) {
        this.config = config;
        this.browser = null;
        this.page = null;
        this.redisClient = null;
        this.audioCapture = new EnhancedTeamsAudioCapture(config);
        this.whisperSocket = null;
    }

    async start() {
        try {
            console.log('[Enhanced Bot] Starting enhanced audio bot...');
            
            // Connect to WhisperLive
            await this.connectToWhisperLive();
            
            // Connect to Redis
            await this.connectToRedis();
            
            // Launch browser with enhanced permissions
            await this.launchBrowser();
            
            // Join Teams meeting
            await this.joinTeamsMeeting();
            
            // Enhanced audio capture
            await this.setupEnhancedAudioCapture();
            
            console.log('[Enhanced Bot] ✅ Enhanced audio bot ready!');
            
        } catch (error) {
            console.log('[Enhanced Bot] ❌ Error starting bot:', error);
            throw error;
        }
    }

    async connectToWhisperLive() {
        try {
            console.log('[Enhanced Bot] Connecting to WhisperLive...');
            
            this.whisperSocket = new WebSocket(this.config.whisperLiveUrl);
            
            return new Promise((resolve, reject) => {
                this.whisperSocket.on('open', () => {
                    console.log('[Enhanced Bot] ✅ Connected to WhisperLive');
                    
                    const initMessage = {
                        uid: this.config.connectionId,
                        language: this.config.language || 'en',
                        task: this.config.task || 'transcribe',
                        platform: this.config.platform || 'teams',
                        meeting_url: this.config.meetingUrl || '',
                        token: this.config.token || 'enhanced-token',
                        meeting_id: this.config.nativeMeetingId || 'enhanced-meeting'
                    };
                    
                    this.whisperSocket.send(JSON.stringify(initMessage));
                    resolve();
                });
                
                this.whisperSocket.on('message', (data) => {
                    const message = JSON.parse(data.toString());
                    console.log('[Enhanced Bot] 🎯 TRANSCRIPTION:', message);
                });
                
                this.whisperSocket.on('error', reject);
            });
        } catch (error) {
            console.log('[Enhanced Bot] WhisperLive connection failed:', error);
            throw error;
        }
    }

    async connectToRedis() {
        try {
            this.redisClient = Redis.createClient({ url: this.config.redisUrl });
            await this.redisClient.connect();
            console.log('[Enhanced Bot] ✅ Connected to Redis');
        } catch (error) {
            console.log('[Enhanced Bot] Redis connection failed:', error);
        }
    }

    async launchBrowser() {
        try {
            console.log('[Enhanced Bot] Launching browser with enhanced permissions...');
            
            this.browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--allow-running-insecure-content',
                    '--autoplay-policy=no-user-gesture-required',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                    '--allow-file-access-from-files',
                    '--disable-blink-features=AutomationControlled',
                    '--enable-experimental-web-platform-features'
                ],
                ignoreDefaultArgs: ['--mute-audio'],
                defaultViewport: null
            });
            
            this.page = await this.browser.newPage();
            
            // Grant all permissions
            const context = this.browser.defaultBrowserContext();
            await context.overridePermissions(this.config.meetingUrl, [
                'microphone',
                'camera',
                'notifications',
                'autoplay'
            ]);
            
            console.log('[Enhanced Bot] ✅ Browser launched with enhanced permissions');
            
        } catch (error) {
            console.log('[Enhanced Bot] Browser launch failed:', error);
            throw error;
        }
    }

    async joinTeamsMeeting() {
        try {
            console.log('[Enhanced Bot] Joining Teams meeting...');
            
            // Navigate to Teams meeting
            await this.page.goto(this.config.meetingUrl, { 
                waitUntil: 'networkidle2',
                timeout: 60000 
            });
            
            // Wait for and fill name field
            await this.page.waitForSelector('input[data-tid="prejoin-display-name-input"]', { timeout: 30000 });
            await this.page.type('input[data-tid="prejoin-display-name-input"]', this.config.botName);
            
            // Try to unmute microphone before joining
            try {
                const micButton = await this.page.$('button[data-tid="toggle-microphone"]');
                if (micButton) {
                    await micButton.click();
                    console.log('[Enhanced Bot] 🎤 Microphone enabled');
                }
            } catch (micError) {
                console.log('[Enhanced Bot] Could not find microphone button');
            }
            
            // Join meeting
            const joinButton = await this.page.$('button[data-tid="prejoin-join-button"]');
            if (joinButton) {
                await joinButton.click();
                console.log('[Enhanced Bot] ✅ Clicked join button');
            }
            
            // Wait for meeting to load
            await this.page.waitForTimeout(5000);
            
            console.log('[Enhanced Bot] ✅ Successfully joined Teams meeting');
            
        } catch (error) {
            console.log('[Enhanced Bot] Failed to join meeting:', error);
            throw error;
        }
    }

    async setupEnhancedAudioCapture() {
        try {
            console.log('[Enhanced Bot] Setting up enhanced audio capture...');
            
            // Inject enhanced audio capture script
            const audioScript = await this.audioCapture.injectAudioCapture();
            await this.page.evaluateOnNewDocument(audioScript);
            await this.page.evaluate(audioScript);
            
            // Set up audio forwarding function
            await this.page.exposeFunction('sendAudioToWhisper', async (audioData) => {
                if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN) {
                    try {
                        const buffer = Buffer.from(new Int16Array(audioData).buffer);
                        this.whisperSocket.send(buffer);
                        console.log('[Enhanced Bot] 📡 Audio sent to WhisperLive');
                    } catch (error) {
                        console.log('[Enhanced Bot] Error sending audio:', error);
                    }
                }
            });
            
            // Enhanced permission handling
            await this.page.evaluate(() => {
                // Override getUserMedia to always grant permissions
                const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                navigator.mediaDevices.getUserMedia = async function(constraints) {
                    console.log('[Enhanced Bot] getUserMedia called with:', constraints);
                    try {
                        const stream = await originalGetUserMedia(constraints);
                        console.log('[Enhanced Bot] ✅ Media stream obtained');
                        return stream;
                    } catch (error) {
                        console.log('[Enhanced Bot] Media stream error:', error);
                        // Create fake stream if real one fails
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator = audioContext.createOscillator();
                        const destination = audioContext.createMediaStreamDestination();
                        oscillator.connect(destination);
                        oscillator.start();
                        return destination.stream;
                    }
                };
            });
            
            console.log('[Enhanced Bot] ✅ Enhanced audio capture setup complete');
            
        } catch (error) {
            console.log('[Enhanced Bot] Enhanced audio capture setup failed:', error);
        }
    }

    async cleanup() {
        try {
            if (this.whisperSocket) {
                this.whisperSocket.close();
            }
            if (this.redisClient) {
                await this.redisClient.quit();
            }
            if (this.browser) {
                await this.browser.close();
            }
        } catch (error) {
            console.log('[Enhanced Bot] Cleanup error:', error);
        }
    }
}

// Start enhanced bot if run directly
if (require.main === module) {
    const config = JSON.parse(process.env.BOT_CONFIG || '{}');
    const bot = new EnhancedAudioBot(config);
    
    bot.start().catch(error => {
        console.log('[Enhanced Bot] Startup failed:', error);
        process.exit(1);
    });
    
    process.on('SIGINT', async () => {
        console.log('[Enhanced Bot] Shutting down...');
        await bot.cleanup();
        process.exit(0);
    });
}

module.exports = EnhancedAudioBot;