using System;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace VexaTeamsBot
{
    public class AudioStreamer
    {
        private readonly ClientWebSocket _ws = new ClientWebSocket();
        private readonly Uri _serverUri;
        private readonly List<byte> _buffer = new List<byte>();
        private readonly int _bytesPerChunk;
        private readonly string _sessionId;

        public AudioStreamer(string wsUrl, int sampleRate = 16000, int channels = 1)
        {
            _serverUri = new Uri(wsUrl);
            _bytesPerChunk = (sampleRate * channels * 2) / 2; // 500ms chunks
            _sessionId = $"teams-audio-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        }

        public async Task ConnectAsync()
        {
            try
            {
                await _ws.ConnectAsync(_serverUri, CancellationToken.None);
                Console.WriteLine($"[Audio Streamer] ✅ Connected to Whisper Bridge: {_serverUri}");
                
                // Send initialization message
                var initMessage = new
                {
                    type = "init",
                    session_id = _sessionId,
                    platform = "teams-bot-framework",
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                };
                
                var initJson = JsonSerializer.Serialize(initMessage);
                var initBytes = Encoding.UTF8.GetBytes(initJson);
                
                await _ws.SendAsync(new ArraySegment<byte>(initBytes),
                    WebSocketMessageType.Text, true, CancellationToken.None);
                
                Console.WriteLine($"[Audio Streamer] 🎯 Session initialized: {_sessionId}");
                
                // Start transcription listener
                _ = Task.Run(ListenForTranscriptions);
                
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Audio Streamer] ❌ Connection failed: {ex.Message}");
                throw;
            }
        }

        public async Task AddAudioFrame(byte[] frame)
        {
            if (_ws.State != WebSocketState.Open)
            {
                Console.WriteLine("[Audio Streamer] ⚠️ WebSocket not connected, skipping audio frame");
                return;
            }

            try
            {
                _buffer.AddRange(frame);
                
                // Send chunks when buffer is full enough
                if (_buffer.Count >= _bytesPerChunk)
                {
                    var chunk = _buffer.ToArray();
                    _buffer.Clear();
                    
                    await SendAudioChunk(chunk);
                    Console.WriteLine($"[Audio Streamer] 🎵 Sent audio chunk: {chunk.Length} bytes");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Audio Streamer] ❌ Audio frame error: {ex.Message}");
            }
        }

        private async Task SendAudioChunk(byte[] audioBuffer)
        {
            try
            {
                if (_ws.State == WebSocketState.Open)
                {
                    await _ws.SendAsync(new ArraySegment<byte>(audioBuffer),
                        WebSocketMessageType.Binary, true, CancellationToken.None);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Audio Streamer] ❌ Send chunk error: {ex.Message}");
            }
        }

        private async Task ListenForTranscriptions()
        {
            var buffer = new byte[4096];
            
            try
            {
                while (_ws.State == WebSocketState.Open)
                {
                    var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        HandleTranscriptionMessage(message);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Audio Streamer] ❌ Transcription listener error: {ex.Message}");
            }
        }

        private void HandleTranscriptionMessage(string message)
        {
            try
            {
                using (JsonDocument doc = JsonDocument.Parse(message))
                {
                    var root = doc.RootElement;
                    
                    if (root.TryGetProperty("type", out var typeElement) && 
                        typeElement.GetString() == "transcription")
                    {
                        var text = root.GetProperty("text").GetString();
                        var partial = root.TryGetProperty("partial", out var partialElement) && partialElement.GetBoolean();
                        var timestamp = root.GetProperty("timestamp").GetDouble();
                        
                        var status = partial ? "PARTIAL" : "FINAL";
                        Console.WriteLine($"[Audio Streamer] 🗣️  {status}: {text}");
                        
                        // Trigger event for transcription received
                        OnTranscriptionReceived?.Invoke(text, partial, timestamp);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Audio Streamer] ❌ Transcription parse error: {ex.Message}");
            }
        }

        public event Action<string, bool, double> OnTranscriptionReceived;

        public async Task DisconnectAsync()
        {
            try
            {
                if (_ws.State == WebSocketState.Open)
                {
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Disconnecting", CancellationToken.None);
                    Console.WriteLine("[Audio Streamer] 🔌 Disconnected from Whisper Bridge");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Audio Streamer] ❌ Disconnect error: {ex.Message}");
            }
        }
    }
}