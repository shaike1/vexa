const http = require('http');
const WebSocket = require('ws');

class BridgeHttpAdapter {
    constructor(bridgeUrl = 'ws://localhost:8770', port = 8080) {
        this.bridgeUrl = bridgeUrl;
        this.port = port;
        this.server = null;
        this.bridgeSocket = null;
        this.connected = false;
        this.sessionId = `http-adapter-${Date.now()}`;
    }

    parseBody(req) {
        return new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    resolve({});
                }
            });
        });
    }

    setCORSHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    sendJSON(res, data, statusCode = 200) {
        this.setCORSHeaders(res);
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    async handleRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            this.setCORSHeaders(res);
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            if (url.pathname === '/health' && req.method === 'GET') {
                this.sendJSON(res, {
                    status: 'healthy',
                    bridgeConnected: this.connected,
                    bridgeUrl: this.bridgeUrl,
                    sessionId: this.sessionId,
                    timestamp: new Date().toISOString()
                });
            }
            else if (url.pathname === '/status' && req.method === 'GET') {
                this.sendJSON(res, {
                    adapter: 'running',
                    bridge: {
                        connected: this.connected,
                        url: this.bridgeUrl,
                        sessionId: this.sessionId
                    },
                    server: {
                        port: this.port,
                        uptime: process.uptime()
                    }
                });
            }
            else if ((url.pathname === '/bridge-audio' || url.pathname === '/audio') && req.method === 'POST') {
                const body = await this.parseBody(req);
                const { sessionUid, audioData, timestamp, source } = body;
                
                if (!this.connected) {
                    console.log('[HTTP Adapter] ⚠️ Bridge not connected, attempting reconnection...');
                    try {
                        await this.connectToBridge();
                    } catch (error) {
                        this.sendJSON(res, { error: 'Failed to connect to bridge' }, 503);
                        return;
                    }
                }

                if (audioData && audioData.length > 0) {
                    // Convert audio data back to buffer and send to bridge
                    const buffer = Buffer.from(new Int16Array(audioData).buffer);
                    
                    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
                        this.bridgeSocket.send(buffer);
                        
                        // Log occasionally
                        if (Math.random() < 0.005) { // 0.5% of the time
                            console.log(`[HTTP Adapter] 🎵 Forwarded ${buffer.length} bytes to bridge (session: ${sessionUid})`);
                        }
                        
                        this.sendJSON(res, { success: true, bytesSent: buffer.length });
                    } else {
                        console.log('[HTTP Adapter] ❌ Bridge socket not ready');
                        this.sendJSON(res, { error: 'Bridge not connected' }, 503);
                    }
                } else {
                    this.sendJSON(res, { error: 'No audio data provided' }, 400);
                }
            }
            else {
                this.sendJSON(res, { error: 'Not found' }, 404);
            }
        } catch (error) {
            console.error('[HTTP Adapter] ❌ Error handling request:', error);
            this.sendJSON(res, { error: 'Internal server error' }, 500);
        }
    }

    async connectToBridge() {
        try {
            console.log(`[HTTP Adapter] 🌉 Connecting to WhisperLive Bridge: ${this.bridgeUrl}`);
            
            if (this.bridgeSocket) {
                this.bridgeSocket.close();
            }

            this.bridgeSocket = new WebSocket(this.bridgeUrl);
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Bridge connection timeout'));
                }, 10000);

                this.bridgeSocket.on('open', () => {
                    clearTimeout(timeout);
                    console.log('[HTTP Adapter] ✅ Connected to WhisperLive Bridge');
                    
                    // Send initialization message
                    const initMessage = {
                        type: 'init',
                        session_id: this.sessionId,
                        platform: 'http-adapter',
                        timestamp: Date.now()
                    };
                    
                    this.bridgeSocket.send(JSON.stringify(initMessage));
                    console.log('[HTTP Adapter] 📤 Sent init message to bridge');
                    
                    this.connected = true;
                    resolve();
                });
                
                this.bridgeSocket.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.type === 'transcription') {
                            const status = message.partial ? 'LIVE' : 'FINAL';
                            console.log(`[HTTP Adapter] 🗣️ ${status}: ${message.text}`);
                        }
                    } catch (error) {
                        // Binary data, ignore
                    }
                });
                
                this.bridgeSocket.on('error', (error) => {
                    clearTimeout(timeout);
                    console.error('[HTTP Adapter] ❌ Bridge connection error:', error);
                    this.connected = false;
                    reject(error);
                });
                
                this.bridgeSocket.on('close', () => {
                    console.log('[HTTP Adapter] 🔌 Bridge connection closed');
                    this.connected = false;
                });
            });
        } catch (error) {
            console.error('[HTTP Adapter] ❌ Failed to connect to bridge:', error);
            throw error;
        }
    }

    async start() {
        try {
            // Connect to bridge first
            await this.connectToBridge();
            
            // Start HTTP server
            return new Promise((resolve) => {
                this.server = http.createServer((req, res) => {
                    this.handleRequest(req, res);
                });
                
                this.server.listen(this.port, () => {
                    console.log(`[HTTP Adapter] 🚀 HTTP-to-Bridge adapter running on port ${this.port}`);
                    console.log(`[HTTP Adapter] 🌉 Bridge URL: ${this.bridgeUrl}`);
                    console.log(`[HTTP Adapter] 📡 Ready to forward audio from browser bot to bridge`);
                    resolve();
                });
            });
        } catch (error) {
            console.error('[HTTP Adapter] ❌ Failed to start adapter:', error);
            throw error;
        }
    }

    async stop() {
        if (this.bridgeSocket) {
            this.bridgeSocket.close();
        }
        if (this.server) {
            this.server.close();
        }
        console.log('[HTTP Adapter] 🛑 HTTP-to-Bridge adapter stopped');
    }
}

module.exports = BridgeHttpAdapter;

// If run directly, start the adapter
if (require.main === module) {
    const adapter = new BridgeHttpAdapter();
    
    adapter.start().catch(error => {
        console.error('Failed to start HTTP adapter:', error);
        process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n[HTTP Adapter] 🛑 Shutting down...');
        await adapter.stop();
        process.exit(0);
    });
}