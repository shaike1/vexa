private AudioStreamer _audioStreamer = new AudioStreamer("ws://bridge:8765");

public async void OnAudioMediaReceived(AudioMediaReceivedEventArgs args)
{
    byte[] pcmData = new byte[args.Length];
    Buffer.BlockCopy(args.Buffer, 0, pcmData, 0, args.Length);
    await _audioStreamer.AddAudioFrame(pcmData);
}
