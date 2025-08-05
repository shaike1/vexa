const sdk = require('microsoft-cognitiveservices-speech-sdk');

class TranscriptionService {
    constructor(config) {
        this.speechKey = config.speechKey;
        this.speechRegion = config.speechRegion;
        this.activeRecognizers = new Map();
    }

    async startRealTimeTranscription(sessionId, audioStream) {
        console.log(`[Transcription Service] 🎤 Starting real-time transcription for session: ${sessionId}`);
        
        try {
            // Create speech config
            const speechConfig = sdk.SpeechConfig.fromSubscription(this.speechKey, this.speechRegion);
            speechConfig.speechRecognitionLanguage = 'en-US';
            
            // Create audio config from stream
            const audioConfig = sdk.AudioConfig.fromStreamInput(audioStream);
            
            // Create speech recognizer
            const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
            
            // Set up event handlers
            recognizer.recognizing = (s, e) => {
                console.log(`[Transcription Service] 🔄 Recognizing for ${sessionId}: ${e.result.text}`);
            };
            
            recognizer.recognized = (s, e) => {
                if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                    console.log(`[Transcription Service] ✅ Recognized for ${sessionId}: ${e.result.text}`);
                    
                    // Emit transcription event
                    this.emit('transcription', {
                        sessionId: sessionId,
                        text: e.result.text,
                        confidence: e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult),
                        timestamp: new Date()
                    });
                }
            };
            
            recognizer.canceled = (s, e) => {
                console.log(`[Transcription Service] ❌ Canceled for ${sessionId}: ${e.reason}`);
                if (e.reason === sdk.CancellationReason.Error) {
                    console.error(`[Transcription Service] Error details: ${e.errorDetails}`);
                }
            };
            
            recognizer.sessionStopped = (s, e) => {
                console.log(`[Transcription Service] 🛑 Session stopped for ${sessionId}`);
                recognizer.stopContinuousRecognitionAsync();
            };
            
            // Store recognizer
            this.activeRecognizers.set(sessionId, recognizer);
            
            // Start continuous recognition
            recognizer.startContinuousRecognitionAsync();
            
            console.log(`[Transcription Service] 🎉 Real-time transcription started for session: ${sessionId}`);
            
        } catch (error) {
            console.error(`[Transcription Service] Failed to start transcription for ${sessionId}:`, error);
            throw error;
        }
    }

    async stopRealTimeTranscription(sessionId) {
        console.log(`[Transcription Service] 🛑 Stopping transcription for session: ${sessionId}`);
        
        const recognizer = this.activeRecognizers.get(sessionId);
        if (recognizer) {
            recognizer.stopContinuousRecognitionAsync();
            recognizer.close();
            this.activeRecognizers.delete(sessionId);
            
            console.log(`[Transcription Service] ✅ Transcription stopped for session: ${sessionId}`);
        } else {
            console.log(`[Transcription Service] ⚠️ No active recognizer found for session: ${sessionId}`);
        }
    }

    async transcribeAudioBuffer(audioBuffer, language = 'en-US') {
        console.log(`[Transcription Service] 🎯 Transcribing audio buffer (${audioBuffer.length} bytes)`);
        
        try {
            // Create speech config
            const speechConfig = sdk.SpeechConfig.fromSubscription(this.speechKey, this.speechRegion);
            speechConfig.speechRecognitionLanguage = language;
            
            // Create audio config from buffer
            const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
            const audioStream = sdk.AudioInputStream.createPushStream(audioFormat);
            audioStream.write(audioBuffer);
            audioStream.close();
            
            const audioConfig = sdk.AudioConfig.fromStreamInput(audioStream);
            
            // Create recognizer
            const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
            
            // Perform recognition
            return new Promise((resolve, reject) => {
                recognizer.recognizeOnceAsync(result => {
                    if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                        console.log(`[Transcription Service] ✅ Transcription result: ${result.text}`);
                        resolve({
                            text: result.text,
                            confidence: result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult),
                            language: language
                        });
                    } else {
                        console.log(`[Transcription Service] ❌ Recognition failed: ${result.reason}`);
                        reject(new Error(`Recognition failed: ${result.reason}`));
                    }
                    
                    recognizer.close();
                });
            });
            
        } catch (error) {
            console.error(`[Transcription Service] Transcription error:`, error);
            throw error;
        }
    }

    getActiveTranscriptions() {
        return Array.from(this.activeRecognizers.keys());
    }

    async cleanup() {
        console.log(`[Transcription Service] 🧹 Cleaning up ${this.activeRecognizers.size} active recognizers`);
        
        for (const [sessionId, recognizer] of this.activeRecognizers) {
            recognizer.stopContinuousRecognitionAsync();
            recognizer.close();
        }
        
        this.activeRecognizers.clear();
        console.log(`[Transcription Service] ✅ Cleanup complete`);
    }
}

module.exports.TranscriptionService = TranscriptionService;