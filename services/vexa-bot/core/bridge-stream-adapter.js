/**
 * Bridge Stream Adapter - Connects existing browser bot to WhisperLive Bridge
 * This allows your current bot to stream audio to the bridge without Teams Bot Framework
 */

const WebSocket = require('ws');

class BridgeStreamAdapter {
    constructor(bridgeUrl = 'ws://localhost:8770') {
        this.bridgeUrl = bridgeUrl;
        this.ws = null;
        this.connected = false;
        this.sessionId = `browser-bot-${Date.now()}`;
    }

    async connect() {
        try {
            console.log('[Bridge Adapter] 🔗 Connecting to Whisper Bridge...');
            
            this.ws = new WebSocket(this.bridgeUrl);
            
            return new Promise((resolve, reject) => {
                this.ws.on('open', () => {
                    console.log('[Bridge Adapter] ✅ Connected to Whisper Bridge');
                    this.connected = true;
                    
                    // Send initialization message
                    const initMsg = {
                        type: 'init',
                        session_id: this.sessionId,
                        platform: 'browser-bot-puppeteer',
                        timestamp: Date.now()
                    };
                    
                    this.ws.send(JSON.stringify(initMsg));
                    console.log(`[Bridge Adapter] 🎯 Session initialized: ${this.sessionId}`);
                    
                    resolve();
                });
                
                this.ws.on('message', (data) => {
                    this.handleTranscription(data);
                });
                
                this.ws.on('error', (error) => {
                    console.error('[Bridge Adapter] ❌ Connection error:', error);
                    reject(error);
                });
                
                this.ws.on('close', () => {
                    console.log('[Bridge Adapter] 🔌 Connection closed');
                    this.connected = false;
                });
            });
            
        } catch (error) {
            console.error('[Bridge Adapter] ❌ Failed to connect:', error);
            throw error;
        }
    }

    streamAudioData(audioBuffer) {
        if (!this.connected || !this.ws) {
            console.warn('[Bridge Adapter] ⚠️ Not connected to bridge');
            return;
        }

        try {
            // Send raw audio data to bridge
            this.ws.send(audioBuffer);
            console.log(`[Bridge Adapter] 🎵 Streamed ${audioBuffer.length} bytes`);
        } catch (error) {
            console.error('[Bridge Adapter] ❌ Stream error:', error);
        }
    }

    handleTranscription(data) {
        try {
            if (typeof data === 'string') {
                const message = JSON.parse(data);
                
                if (message.type === 'transcription') {
                    const status = message.partial ? 'LIVE' : 'FINAL';
                    console.log(`[Bridge Adapter] 🗣️ ${status}: ${message.text}`);
                    
                    // Emit event for other parts of the bot
                    this.onTranscription && this.onTranscription(message.text, message.partial);
                }
            }
        } catch (error) {
            console.error('[Bridge Adapter] ❌ Transcription parse error:', error);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.connected = false;
            console.log('[Bridge Adapter] 🔌 Disconnected from bridge');
        }
    }

    // Event handler for transcriptions
    onTranscription = null;
}

module.exports = { BridgeStreamAdapter };