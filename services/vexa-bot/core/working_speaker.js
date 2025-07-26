const { runBot } = require('./dist/index.js');

const speakerConfig = {
  meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_OGNjMDBhZTAtMjY3YS00MDdlLWIwNDMtODBkNWU2ODk3NTI5%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d',
  platform: 'teams',
  botName: 'VexaAI-Working-Speaker',
  language: 'en', 
  task: 'speak',
  authMode: 'guest',
  connectionId: 'working-speaker',
  redisUrl: 'redis://localhost:6379'
};

console.log('Starting working speaker bot with speech functionality...');

runBot(speakerConfig)
  .then(() => {
    console.log('Working speaker bot completed');
  })
  .catch((error) => {
    console.error('Working speaker bot error:', error);
  });