# Microsoft Teams Connection Guide

This document outlines the process for connecting to Microsoft Teams meetings programmatically.

## Setup Update
- install "uuid": "^11.1.0" and "@types/uuid": "^10.0.0" as dev
- the teams meeting link has special characters, so you can't run the container (at least on Windows) with BOT_CONFIG as param. So i put the BOT_CONFIG in `.env` and add `"nativeMeetingId": "abc123"` in the JSON

## Overview

The connection process involves several steps:
1. URL preparation
2. Navigating to the meeting
3. Joining the meeting interface
4. Waiting for admission
5. Starting recording

## URL Preparation

When joining a Microsoft Teams meeting, the original URL may need to be transformed into a special format. For that, you need to install uuid lib, because in the reformatting, you have to add a deeplinkId (idk why) in the url. To format the url, there is a function in `microsoft.ts` :

```javascript
// Original URL transformation to proper Teams meeting join format
function generateTeamsUrl(originalUrl) {
    // Parse the original URL
    // Create new path with prefix
    // Add additional parameters to existing query string
    // Return the transformed URL
}
```

## Joining the Meeting

The joining process handles both original and transformed URLs:

1. Navigate to the meeting URL
2. Wait for the page to load completely
3. Locate and click the "Continue" button (multiple selector attempts)
4. Enter the bot name in the name field
5. Click the "Join" button to enter the meeting

### Interface Elements

The code searches for these key interface elements:
- Continue button: `button[class*="fui-Button"]`
- Name field: `input[data-tid="prejoin-display-name-input"]`
- Join button: `#prejoin-join-button`

## Waiting for Admission

After joining:
1. Wait for the meeting admission (timeout configurable)
2. Look for the "myself-video" element indicating successful admission
3. Prepare recording capabilities while waiting

## Connection Monitoring

When the bot is connected, there are 3 conditions for ending the meeting:
- Participant count (detects if bot is alone) : `span[data-tid="roster-button-tile"]`
- Waiting messages or removal notifications : `span[id="call-status"]`
- Page visibility changes and unload events : `h1[id="calling-retry-screen-title"]`