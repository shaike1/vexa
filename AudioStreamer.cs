using System;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

public class AudioStreamer
{
    private readonly ClientWebSocket _ws = new ClientWebSocket();
    private readonly Uri _serverUri;
    private readonly List<byte> _buffer = new List<byte>();
    private readonly int _bytesPer500ms;

    public AudioStreamer(string wsUrl, int sampleRate = 16000, int channels = 1)
    {
        _serverUri = new Uri(wsUrl);
        _bytesPer500ms = (sampleRate * channels * 2) / 2;
    }

    public async Task ConnectAsync()
    {
        await _ws.ConnectAsync(_serverUri, CancellationToken.None);
        Console.WriteLine("Connected to WebSocket bridge.");
    }

    public async Task AddAudioFrame(byte[] frame)
    {
        _buffer.AddRange(frame);
        if (_buffer.Count >= _bytesPer500ms)
        {
            var chunk = _buffer.ToArray();
            _buffer.Clear();
            await SendAudioChunk(chunk);
        }
    }

    private async Task SendAudioChunk(byte[] audioBuffer)
    {
        if (_ws.State == WebSocketState.Open)
        {
            await _ws.SendAsync(new ArraySegment<byte>(audioBuffer),
                WebSocketMessageType.Binary,true,CancellationToken.None);
        }
    }
}
