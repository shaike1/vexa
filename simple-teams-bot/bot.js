const puppeteer = require('puppeteer');
const { getStream } = require('puppeteer-stream');
const WebSocket = require('ws');

class SimpleTeamsBot {
  constructor() {
    this.meetingUrl = process.env.MEETING_URL || 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MzMyOTA0YjEtNDMxMC00OWI2LTkxYTMtZWQzN2E3OTFhMWFi%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d';
    this.whisperUrl = 'ws://vexa-whisperlive-1:9090';
    this.botName = 'VexaAI-Simple';
    this.sessionId = `simple-${Date.now()}`;
  }

  async connectWhisperLive() {
    console.log('🔌 Connecting to WhisperLive...');
    
    this.whisperSocket = new WebSocket(this.whisperUrl);
    
    return new Promise((resolve, reject) => {
      this.whisperSocket.on('open', () => {
        console.log('✅ Connected to WhisperLive');
        
        const initMessage = {
          uid: this.sessionId,
          language: 'en',
          task: 'transcribe',
          model: 'small',
          use_vad: false,
          save_output_recording: false,
          return_timestamps: true,
          platform: 'teams',
          meeting_url: this.meetingUrl,
          token: `token-${this.sessionId}`,
          meeting_id: this.sessionId
        };
        
        this.whisperSocket.send(JSON.stringify(initMessage));
        console.log('📡 Sent WhisperLive init');
        resolve();
      });
      
      this.whisperSocket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.text) {
            console.log(`\n🎤 TRANSCRIPTION: "${message.text}"\n`);
          }
          if (message.message === 'SERVER_READY') {
            console.log('🟢 WhisperLive ready for audio');
            this.whisperReady = true;
          }
        } catch (error) {
          console.error('Error parsing WhisperLive message:', error);
        }
      });
      
      this.whisperSocket.on('error', reject);
    });
  }

  async joinMeeting() {
    console.log('🚀 Starting simple Teams bot...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      executablePath: puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-gpu',
        '--remote-debugging-port=9222'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Enable permissions
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions(this.meetingUrl, ['microphone', 'camera']);
    
    console.log('📱 Joining Teams meeting...');
    await this.page.goto(this.meetingUrl);
    await this.page.waitForTimeout(3000);
    
    // Enter bot name
    try {
      const nameInput = 'input[data-tid="prejoin-display-name-input"]';
      await this.page.waitForSelector(nameInput, { timeout: 10000 });
      await this.page.type(nameInput, this.botName);
      console.log(`✅ Entered bot name: ${this.botName}`);
    } catch (error) {
      console.log('⚠️ Could not find name input');
    }
    
    // Click join
    try {
      const joinButton = 'button[data-tid="prejoin-join-button"]';
      await this.page.waitForSelector(joinButton, { timeout: 5000 });
      await this.page.click(joinButton);
      console.log('✅ Clicked join button');
    } catch (error) {
      console.log('⚠️ Could not find join button');
    }
    
    console.log('⏳ Waiting for admission...');
    await this.page.waitForTimeout(15000);
    
    return true;
  }

  async startRecording() {
    console.log('🎧 Starting audio capture...');
    
    // Connect to WhisperLive
    await this.connectWhisperLive();
    
    // Get audio stream using MeetingBot approach
    this.stream = await getStream(this.page, { audio: true, video: false });
    console.log('✅ Got audio stream from Teams');
    
    // Process audio chunks
    this.stream.on('data', (chunk) => {
      if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN && this.whisperReady) {
        // Convert to base64 and send to WhisperLive
        const audioData = chunk.toString('base64');
        this.whisperSocket.send(audioData);
      }
    });
    
    this.stream.on('error', (error) => {
      console.error('❌ Stream error:', error);
    });
    
    console.log('✅ Real-time transcription active!');
  }

  async run() {
    try {
      await this.joinMeeting();
      await this.startRecording();
      
      console.log('\n🎉 Simple bot is ready!');
      console.log('👤 Please admit the bot to your meeting');
      console.log('🎤 Speak to see real-time transcription\n');
      
    } catch (error) {
      console.error('❌ Bot failed:', error);
      process.exit(1);
    }
  }
}

const bot = new SimpleTeamsBot();
bot.run();