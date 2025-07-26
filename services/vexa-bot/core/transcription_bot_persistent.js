const { runBot } = require('./dist/index.js');

const transcriptionConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_OGNjMDBhZTAtMjY3YS00MDdlLWIwNDMtODBkNWU2ODk3NTI5%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Transcription',
  language: 'en', 
  task: 'transcribe',
  authMode: 'guest',
  connectionId: 'transcription-bot-persistent',
  redisUrl: 'redis://localhost:6379',
  whisperLiveUrl: 'ws://localhost:19090',
  persistentMode: true // Stay in meeting longer
};

console.log('Starting persistent transcription bot with Vexa WhisperLive...');

runBot(transcriptionConfig)
  .then(() => {
    console.log('Persistent transcription bot completed');
  })
  .catch((error) => {
    console.error('Persistent transcription bot error:', error);
  });