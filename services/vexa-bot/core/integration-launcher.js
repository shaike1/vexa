#!/usr/bin/env node

/**
 * VexaAI Native Teams Bot Integration Launcher
 * This script manages both the native Teams bot and browser-based bot
 * to provide comprehensive Teams meeting speech capabilities
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class VexaIntegrationLauncher {
    constructor() {
        this.processes = new Map();
        this.isShuttingDown = false;
        
        // Setup signal handlers
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGTERM', () => this.gracefulShutdown());
        
        this.config = {
            nativeBot: {
                path: '/root/vexa/native-teams-bot/VexaSpeakerBot',
                command: 'dotnet',
                args: ['run']
            },
            browserBot: {
                path: '/root/vexa/services/vexa-bot/core',
                command: 'node',
                args: ['working_speaker.js']
            },
            meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MGEyNjViN2MtM2I3Yy00YTg2LWFlNzgtZWU3YWU0YmMxMGUy%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d'
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const levels = {
            info: '\x1b[36m[INFO]\x1b[0m',
            success: '\x1b[32m[SUCCESS]\x1b[0m',
            warning: '\x1b[33m[WARNING]\x1b[0m',
            error: '\x1b[31m[ERROR]\x1b[0m'
        };
        console.log(`${timestamp} ${levels[level]} ${message}`);
    }

    async checkPrerequisites() {
        this.log('Checking prerequisites...');
        
        const checks = [
            { name: 'Native bot project', path: this.config.nativeBot.path },
            { name: 'Browser bot project', path: this.config.browserBot.path },
            { name: 'Redis connection', test: this.checkRedis.bind(this) }
        ];

        for (const check of checks) {
            if (check.path) {
                if (fs.existsSync(check.path)) {
                    this.log(`✅ ${check.name} found`);
                } else {
                    this.log(`❌ ${check.name} not found at ${check.path}`, 'error');
                    return false;
                }
            } else if (check.test) {
                const result = await check.test();
                if (result) {
                    this.log(`✅ ${check.name} OK`);
                } else {
                    this.log(`❌ ${check.name} failed`, 'error');
                    return false;
                }
            }
        }
        
        return true;
    }

    async checkRedis() {
        try {
            // Try to connect to Redis (simplified check)
            const redis = require('redis');
            const client = redis.createClient({ url: 'redis://localhost:6379' });
            await client.connect();
            await client.ping();
            await client.disconnect();
            return true;
        } catch (error) {
            this.log(`Redis check failed: ${error.message}`, 'error');
            return false;
        }
    }

    startProcess(name, config) {
        if (this.processes.has(name)) {
            this.log(`Process ${name} already running`, 'warning');
            return;
        }

        this.log(`Starting ${name}...`);
        
        const process = spawn(config.command, config.args, {
            cwd: config.path,
            stdio: 'pipe',
            env: { 
                ...process.env,
                TEAMS_MEETING_URL: this.config.meetingUrl
            }
        });

        process.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                this.log(`[${name}] ${output}`);
            }
        });

        process.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                this.log(`[${name}] ${output}`, 'warning');
            }
        });

        process.on('close', (code) => {
            this.log(`Process ${name} exited with code ${code}`);
            this.processes.delete(name);
            
            if (!this.isShuttingDown && code !== 0) {
                this.log(`Process ${name} crashed, restarting in 5 seconds...`, 'warning');
                setTimeout(() => {
                    if (!this.isShuttingDown) {
                        this.startProcess(name, config);
                    }
                }, 5000);
            }
        });

        this.processes.set(name, process);
        this.log(`Process ${name} started with PID ${process.pid}`, 'success');
    }

    async startNativeBot() {
        // Build the native bot first
        this.log('Building native Teams bot...');
        
        const buildProcess = spawn('dotnet', ['build'], {
            cwd: this.config.nativeBot.path,
            stdio: 'pipe'
        });

        return new Promise((resolve, reject) => {
            buildProcess.on('close', (code) => {
                if (code === 0) {
                    this.log('Native bot built successfully', 'success');
                    this.startProcess('native-bot', this.config.nativeBot);
                    resolve();
                } else {
                    this.log('Failed to build native bot', 'error');
                    reject(new Error(`Build failed with code ${code}`));
                }
            });

            buildProcess.stderr.on('data', (data) => {
                this.log(`[build] ${data.toString().trim()}`, 'warning');
            });
        });
    }

    startBrowserBot() {
        // Update the working speaker script with meeting URL
        const workingScript = path.join(this.config.browserBot.path, 'working_speaker.js');
        
        if (fs.existsSync(workingScript)) {
            this.log('Starting browser-based bot...');
            this.startProcess('browser-bot', this.config.browserBot);
        } else {
            this.log('Browser bot script not found', 'error');
        }
    }

    async startIntegration() {
        this.log('🚀 Starting VexaAI Teams Bot Integration');
        this.log('=========================================');

        // Check prerequisites
        const prereqsOK = await this.checkPrerequisites();
        if (!prereqsOK) {
            this.log('Prerequisites check failed', 'error');
            process.exit(1);
        }

        // Start native bot
        try {
            await this.startNativeBot();
            
            // Wait a bit for native bot to start
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Start browser bot (as backup/fallback)
            this.startBrowserBot();
            
            this.log('🎉 Both bots started successfully!', 'success');
            this.log('Native bot provides Azure Speech Services integration');
            this.log('Browser bot provides Teams meeting transcription');
            this.log('Both bots listen to Redis channel: bot_commands:working-speaker');
            
        } catch (error) {
            this.log(`Failed to start integration: ${error.message}`, 'error');
            process.exit(1);
        }
    }

    async gracefulShutdown() {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        this.log('Shutting down gracefully...');

        // Stop all processes
        for (const [name, process] of this.processes) {
            this.log(`Stopping ${name}...`);
            process.kill('SIGTERM');
            
            // Give process time to shutdown gracefully
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Force kill if still running
            if (!process.killed) {
                this.log(`Force killing ${name}...`);
                process.kill('SIGKILL');
            }
        }

        this.log('Shutdown complete', 'success');
        process.exit(0);
    }

    async testIntegration() {
        this.log('🧪 Testing integration...');
        
        // Try to send test commands to both bots
        try {
            const redis = require('redis');
            const client = redis.createClient({ url: 'redis://localhost:6379' });
            await client.connect();
            
            const testCommands = [
                { action: 'speak', message: 'Integration test: Native Teams bot with Azure Speech Services' },
                { action: 'speak', message: 'Integration test: Browser bot with enhanced audio' },
                { action: 'unmute', message: 'unmute' }
            ];
            
            for (const command of testCommands) {
                await client.publish('bot_commands:working-speaker', JSON.stringify(command));
                this.log(`Sent test command: ${command.action}`, 'success');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            await client.disconnect();
            this.log('Integration test completed', 'success');
            
        } catch (error) {
            this.log(`Integration test failed: ${error.message}`, 'error');
        }
    }
}

// Main execution
if (require.main === module) {
    const launcher = new VexaIntegrationLauncher();
    
    const command = process.argv[2] || 'start';
    
    switch (command) {
        case 'start':
            launcher.startIntegration();
            break;
        case 'test':
            launcher.testIntegration();
            break;
        case 'check':
            launcher.checkPrerequisites();
            break;
        default:
            console.log('Usage: node integration-launcher.js [start|test|check]');
            console.log('  start  - Start both native and browser bots');
            console.log('  test   - Send test commands to bots');
            console.log('  check  - Check prerequisites');
            break;
    }
}

module.exports = VexaIntegrationLauncher;