# Teams App Manifest

This directory contains the Teams app manifest for installing the VexaAI Speaker Bot in Microsoft Teams.

## Setup Instructions

1. **Update the manifest.json**:
   - Replace all instances of `INSERT_YOUR_APP_ID_HERE` with your actual Azure App ID
   - Update `validDomains` with your actual domain

2. **Add icon files**:
   - `color.png`: 192x192 color icon
   - `outline.png`: 32x32 outline icon

3. **Create the app package**:
   ```bash
   zip -r VexaSpeakerBot.zip manifest.json color.png outline.png
   ```

4. **Install in Teams**:
   - Go to Teams Admin Center
   - Upload the app package
   - Or use Teams App Studio for development

## Icon Requirements

### color.png (192x192)
- Full color version of your app icon
- Must be exactly 192x192 pixels
- PNG format

### outline.png (32x32)  
- Monochrome outline version
- Must be exactly 32x32 pixels
- PNG format with transparent background

## Sample Icons

You can create simple placeholder icons:

```bash
# Create a simple blue square for color.png
convert -size 192x192 xc:"#2196F3" color.png

# Create a simple outline for outline.png  
convert -size 32x32 xc:transparent -fill none -stroke black -strokewidth 2 -draw "rectangle 4,4 28,28" outline.png
```

## Manifest Validation

Use the Teams App Validation tool to check your manifest:
- Teams Developer Portal: https://dev.teams.microsoft.com/
- App Studio in Teams
- Teams Toolkit for Visual Studio Code

## Permissions Explained

- `identity`: Access user's identity information
- `messageTeamMembers`: Send messages to team members
- `supportsCalling`: Enable calling capabilities for voice features

## Next Steps

1. Update manifest with your App ID
2. Create or add icon files
3. Zip the package
4. Upload to Teams
5. Test the bot installation