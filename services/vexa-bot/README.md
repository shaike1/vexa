# Vexa Bot 

## Meet Bot CLI Tool  (Development, Testing)

## Install dependencies
Install Dependencies
### For Core
1.Navigate to the core directory and run:
```bash
npm install
```
2. Build the core:
```bash
npm run build
```

### For CLI
3. Navigate to the cli directory and run
```bash
npm install
```
4. Create a config file in JSON format:

For Google Meet (e.g., configs/meet-bot.json):
```json
{
  "platform": "google_meet",
  "meetingUrl": "https://meet.google.com/xxxx",
  "botName": "TestBot",
  "automaticLeave": {
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```

For Microsoft Teams (e.g., configs/teams-bot.json):
```json
{
  "platform": "teams",
  "meetingUrl": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_example%40thread.v2/0?context=%7b%22Tid%22%3a%22tenant-id%22%2c%22Oid%22%3a%22organizer-id%22%7d",
  "botName": "VexaBot",
  "automaticLeave": {
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```
5. Run the CLI with:
```bash
npm run cli <config path>
```

Examples:
```bash
npm run cli configs/meet-bot.json
npm run cli configs/teams-bot.json
```
**Note: This is a temporary setup and I will improve it later.**

## How to Run the Bot with Docker for Production

#### 1. Build the Docker Image

Before running the bot, you need to build the Docker image. Navigate to the `core` directory  (where the Dockerfile is located) and run:
```bash
docker build -t vexa-bot .
```
This command will create a Docker image named vexa-bot.
#### 2. Run the Bot Container

Once the image is built, you can start the bot using Docker. Pass the bot configuration as an environment variable:

For Google Meet:
```bash
docker run -e BOT_CONFIG='{"platform": "google_meet", "meetingUrl": "https://meet.google.com/xcb-tssj-qjc", "botName": "Vexa", "token": "123", "connectionId": "", "automaticLeave": {"waitingRoomTimeout": 300000, "noOneJoinedTimeout": 300000, "everyoneLeftTimeout": 300000}}' vexa-bot
```

For Microsoft Teams:
```bash
docker run -e BOT_CONFIG='{"platform": "teams", "meetingUrl": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_example%40thread.v2/0?context=%7b%22Tid%22%3a%22tenant-id%22%2c%22Oid%22%3a%22organizer-id%22%7d", "botName": "VexaBot", "token": "123", "connectionId": "", "automaticLeave": {"waitingRoomTimeout": 300000, "noOneJoinedTimeout": 300000, "everyoneLeftTimeout": 300000}}' vexa-bot
```
##### Notes:

- Ensure the BOT_CONFIG JSON is properly formatted and wrapped in single quotes (') to avoid issues.

- The bot will launch inside the Docker container and join the specified meeting.

- You can replace the values in BOT_CONFIG to customize the bot's behavior.
