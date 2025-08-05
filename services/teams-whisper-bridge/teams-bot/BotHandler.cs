using System;
using System.Threading.Tasks;
using Microsoft.Graph.Communications.Calls;
using Microsoft.Graph.Communications.Resources;

namespace VexaTeamsBot
{
    public class BotHandler
    {
        private AudioStreamer _audioStreamer;
        private readonly string _whisperBridgeUrl;
        private bool _isTranscriptionActive = false;

        public BotHandler(string whisperBridgeUrl = "ws://whisper-bridge:8765")
        {
            _whisperBridgeUrl = whisperBridgeUrl;
            Console.WriteLine($"[Bot Handler] 🤖 Initialized with Whisper Bridge: {_whisperBridgeUrl}");
        }

        public async Task StartTranscriptionAsync()
        {
            try
            {
                if (_audioStreamer != null)
                {
                    Console.WriteLine("[Bot Handler] ⚠️ Transcription already active");
                    return;
                }

                Console.WriteLine("[Bot Handler] 🎤 Starting transcription session...");
                
                _audioStreamer = new AudioStreamer(_whisperBridgeUrl);
                
                // Subscribe to transcription events
                _audioStreamer.OnTranscriptionReceived += (text, partial, timestamp) =>
                {
                    var status = partial ? "LIVE" : "FINAL";
                    Console.WriteLine($"[Bot Handler] 📝 {status} TRANSCRIPTION: {text}");
                    
                    // Here you can forward transcriptions to Teams chat, external APIs, etc.
                    OnTranscriptionReceived?.Invoke(text, partial, timestamp);
                };

                await _audioStreamer.ConnectAsync();
                _isTranscriptionActive = true;
                
                Console.WriteLine("[Bot Handler] ✅ Transcription session started successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Bot Handler] ❌ Failed to start transcription: {ex.Message}");
                throw;
            }
        }

        public async Task StopTranscriptionAsync()
        {
            try
            {
                if (_audioStreamer != null)
                {
                    Console.WriteLine("[Bot Handler] 🛑 Stopping transcription session...");
                    
                    await _audioStreamer.DisconnectAsync();
                    _audioStreamer = null;
                    _isTranscriptionActive = false;
                    
                    Console.WriteLine("[Bot Handler] ✅ Transcription session stopped");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Bot Handler] ❌ Error stopping transcription: {ex.Message}");
            }
        }

        // This method is called by Teams Bot Framework when audio is received
        public async void OnAudioMediaReceived(AudioMediaReceivedEventArgs args)
        {
            if (!_isTranscriptionActive || _audioStreamer == null)
            {
                return; // Transcription not active
            }

            try
            {
                // Convert audio buffer to byte array
                byte[] pcmData = new byte[args.Length];
                Buffer.BlockCopy(args.Buffer, 0, pcmData, 0, args.Length);
                
                // Send to Whisper Bridge for transcription
                await _audioStreamer.AddAudioFrame(pcmData);
                
                // Log audio activity (optional)
                if (DateTime.UtcNow.Millisecond % 1000 < 50) // Log every ~1 second
                {
                    Console.WriteLine($"[Bot Handler] 🎵 Processing audio: {args.Length} bytes @ {DateTime.UtcNow:HH:mm:ss}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Bot Handler] ❌ Audio processing error: {ex.Message}");
            }
        }

        // Alternative method name for compatibility with different Bot Framework versions
        public async void OnAudioReceived(byte[] audioBuffer, int length)
        {
            if (!_isTranscriptionActive || _audioStreamer == null)
            {
                return;
            }

            try
            {
                byte[] pcmData = new byte[length];
                Buffer.BlockCopy(audioBuffer, 0, pcmData, 0, length);
                
                await _audioStreamer.AddAudioFrame(pcmData);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Bot Handler] ❌ Audio processing error: {ex.Message}");
            }
        }

        public bool IsTranscriptionActive => _isTranscriptionActive;

        // Event for external subscribers
        public event Action<string, bool, double> OnTranscriptionReceived;

        // Cleanup method
        public async Task DisposeAsync()
        {
            await StopTranscriptionAsync();
            Console.WriteLine("[Bot Handler] 🧹 Disposed");
        }
    }
}