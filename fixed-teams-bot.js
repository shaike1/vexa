const puppeteer = require('puppeteer');
const { getStream } = require('puppeteer-stream');
const WebSocket = require('ws');

class FixedTeamsBot {
  constructor(meetingUrl) {
    this.meetingUrl = meetingUrl || process.env.MEETING_URL;
    this.whisperUrl = 'ws://localhost:9090'; // Direct connection for testing
    this.botName = 'VexaAI-Fixed';
    this.sessionId = `fixed-${Date.now()}`;
    this.whisperReady = false;
    this.audioBuffer = [];
  }

  async connectWhisperLive() {
    console.log('🔌 Connecting to WhisperLive...');
    
    // Try different URLs for WhisperLive
    const whisperUrls = [
      'ws://vexa-whisperlive-1:9090',
      'ws://localhost:9090', 
      'ws://127.0.0.1:9090'
    ];

    for (const url of whisperUrls) {
      try {
        this.whisperUrl = url;
        this.whisperSocket = new WebSocket(this.whisperUrl);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          
          this.whisperSocket.on('open', () => {
            clearTimeout(timeout);
            console.log(`✅ Connected to WhisperLive at ${url}`);
            resolve();
          });
          
          this.whisperSocket.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        
        // Successfully connected
        break;
      } catch (error) {
        console.log(`❌ Failed to connect to ${url}: ${error.message}`);
        if (url === whisperUrls[whisperUrls.length - 1]) {
          throw new Error('Could not connect to any WhisperLive instance');
        }
      }
    }
    
    // Set up message handlers
    this.whisperSocket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.text && message.text !== 'you') {
          console.log(`\n🎤 REAL TRANSCRIPTION: "${message.text}"\n`);
        }
        if (message.message === 'SERVER_READY') {
          console.log('🟢 WhisperLive ready for audio');
          this.whisperReady = true;
        }
      } catch (error) {
        console.error('Error parsing WhisperLive message:', error);
      }
    });
    
    // Initialize WhisperLive session
    const initMessage = {
      uid: this.sessionId,
      language: 'en',
      task: 'transcribe',
      model: 'small',
      use_vad: true,
      save_output_recording: false,
      return_timestamps: true,
      platform: 'teams',
      meeting_url: this.meetingUrl,
      token: `token-${this.sessionId}`,
      meeting_id: this.sessionId
    };
    
    this.whisperSocket.send(JSON.stringify(initMessage));
    console.log('📡 Sent WhisperLive init');
  }

  async joinMeetingWithRetry() {
    console.log('🚀 Starting fixed Teams bot...');
    console.log(`📱 Meeting URL: ${this.meetingUrl}`);
    
    this.browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--remote-debugging-port=9222'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Enable permissions
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions(this.meetingUrl, ['microphone', 'camera']);
    
    console.log('📱 Navigating to Teams meeting...');
    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for browser choice and click "Continue on this browser"
    try {
      const browserButton = await this.page.$('button.btn.primary');
      if (browserButton) {
        const buttonText = await this.page.evaluate(el => el.textContent, browserButton);
        if (buttonText.includes('Continue on this browser')) {
          await browserButton.click();
          console.log('✅ Clicked "Continue on this browser"');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.log('⚠️ No browser choice detected');
    }
    
    // Try different selectors for the name input
    const nameSelectors = [
      'input[data-tid="prejoin-display-name-input"]',
      'input[placeholder*="name" i]',
      'input[type="text"]',
      '#displayName'
    ];
    
    let nameEntered = false;
    for (const selector of nameSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.type(selector, this.botName);
        console.log(`✅ Entered bot name: ${this.botName} using ${selector}`);
        nameEntered = true;
        break;
      } catch (error) {
        console.log(`❌ Could not find name input with ${selector}`);
      }
    }
    
    if (!nameEntered) {
      console.log('⚠️ Could not enter bot name, proceeding anyway...');
    }
    
    // Try different selectors for join button
    const joinSelectors = [
      'button[data-tid="prejoin-join-button"]',
      'button[data-tid="join-btn"]',
      'button:contains("Join")',
      'button[class*="join" i]',
      '.join-button'
    ];
    
    let joinClicked = false;
    for (const selector of joinSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.click(selector);
        console.log(`✅ Clicked join button using ${selector}`);
        joinClicked = true;
        break;
      } catch (error) {
        console.log(`❌ Could not find join button with ${selector}`);
      }
    }
    
    if (!joinClicked) {
      console.log('⚠️ Could not click join button automatically');
      console.log('📋 Available buttons on page:');
      const buttons = await this.page.$$eval('button', btns => 
        btns.map(btn => ({ text: btn.textContent, id: btn.id, className: btn.className }))
      );
      console.log(buttons);
    }
    
    console.log('⏳ Waiting for meeting to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if we're in the lobby waiting for admission
    try {
      const waitingText = await this.page.$eval('*', el => 
        el.textContent.toLowerCase().includes('waiting') || 
        el.textContent.toLowerCase().includes('lobby') ||
        el.textContent.toLowerCase().includes('admit')
      );
      
      if (waitingText) {
        console.log('🚪 Bot is in lobby, waiting for admission...');
        console.log('👤 Please admit the bot from the Teams meeting');
        
        // Wait longer for admission
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    } catch (error) {
      console.log('✅ Bot may have been admitted automatically');
    }
    
    return true;
  }

  async startAudioCapture() {
    console.log('🎧 Starting enhanced audio capture...');
    
    try {
      // Connect to WhisperLive first
      await this.connectWhisperLive();
      
      // Get the audio stream
      console.log('📡 Getting audio stream from Teams...');
      this.stream = await getStream(this.page, { 
        audio: true, 
        video: false,
        mimeType: 'audio/webm;codecs=opus'
      });
      
      console.log('✅ Got audio stream from Teams');
      
      let chunkCount = 0;
      let totalBytes = 0;
      
      this.stream.on('data', (chunk) => {
        chunkCount++;
        totalBytes += chunk.length;
        
        // Log every 100 chunks to show activity
        if (chunkCount % 100 === 0) {
          console.log(`🎵 Processing audio - Chunks: ${chunkCount}, Total: ${totalBytes} bytes`);
        }
        
        if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN && this.whisperReady) {
          try {
            // Convert chunk to the format WhisperLive expects
            this.whisperSocket.send(chunk);
          } catch (error) {
            console.error('❌ Error sending audio to WhisperLive:', error);
          }
        } else {
          // Buffer audio while WhisperLive is not ready
          this.audioBuffer.push(chunk);
          if (this.audioBuffer.length > 1000) {
            this.audioBuffer = this.audioBuffer.slice(500); // Keep buffer manageable
          }
        }
      });
      
      this.stream.on('error', (error) => {
        console.error('❌ Audio stream error:', error);
      });
      
      // Send buffered audio once WhisperLive is ready
      const checkBuffer = setInterval(() => {
        if (this.whisperSocket && this.whisperSocket.readyState === WebSocket.OPEN && this.whisperReady && this.audioBuffer.length > 0) {
          console.log(`📦 Sending ${this.audioBuffer.length} buffered audio chunks`);
          this.audioBuffer.forEach(chunk => {
            try {
              this.whisperSocket.send(chunk);
            } catch (error) {
              console.error('❌ Error sending buffered audio:', error);
            }
          });
          this.audioBuffer = [];
          clearInterval(checkBuffer);
        }
      }, 1000);
      
      console.log('✅ Real-time audio capture active!');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      return false;
    }
  }

  async run() {
    try {
      console.log(`\n🤖 VexaAI Teams Bot - FIXED VERSION`);
      console.log(`🎯 Meeting: ${this.meetingUrl}`);
      console.log(`🆔 Session: ${this.sessionId}\n`);
      
      await this.joinMeetingWithRetry();
      const audioStarted = await this.startAudioCapture();
      
      if (audioStarted) {
        console.log('\n🎉 Fixed bot is ready and capturing audio!');
        console.log('🎤 Speak in the meeting to see real-time transcription');
        console.log('🔄 Bot will continue running until manually stopped...\n');
        
        // Keep the process alive
        process.on('SIGINT', () => {
          console.log('\n🛑 Shutting down bot...');
          this.cleanup();
          process.exit(0);
        });
        
        // Heartbeat to show the bot is alive
        setInterval(() => {
          console.log(`💓 Bot alive at ${new Date().toISOString()}`);
        }, 60000);
        
      } else {
        console.error('❌ Failed to start audio capture');
        this.cleanup();
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Bot failed:', error);
      this.cleanup();
      process.exit(1);
    }
  }

  cleanup() {
    if (this.whisperSocket) {
      this.whisperSocket.close();
    }
    if (this.stream) {
      this.stream.destroy();
    }
    if (this.browser) {
      this.browser.close();
    }
  }
}

// Run the bot with meeting URL from command line argument
const meetingUrl = process.argv[2];
if (!meetingUrl) {
  console.error('❌ Please provide a Teams meeting URL');
  console.log('Usage: node fixed-teams-bot.js "https://teams.microsoft.com/l/meetup-join/..."');
  process.exit(1);
}

const bot = new FixedTeamsBot(meetingUrl);
bot.run();