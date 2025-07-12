# Microsoft Teams Authentication Integration

This document explains how to configure and use Microsoft Teams authentication with Vexa for enhanced meeting management capabilities.

## Overview

Vexa supports two modes for Microsoft Teams integration:

1. **Guest Mode** (Default): Bot joins meetings as an anonymous guest user
2. **Authenticated Mode**: Bot uses Microsoft Graph API with application permissions to access meeting information and potentially manage meetings

## Features by Mode

### Guest Mode (Default)
- ✅ Join meetings via browser automation as anonymous guest
- ✅ Real-time transcription
- ✅ Speaker detection
- ✅ Multiple bots per meeting (different bot names)
- ❌ Meeting metadata access
- ❌ Programmatic meeting creation

### Authenticated Mode (Enhanced)
- ✅ **Same guest joining behavior** (consistent with Google Meet/Zoom)
- ✅ **Enhanced meeting metadata** via Microsoft Graph API
- ✅ **Meeting subject, organizer, and timing information**
- ✅ **Programmatic meeting creation** via admin API
- ✅ **Integration with organizational directory**
- ✅ **Multiple bots per meeting** (no authentication conflicts)
- ❌ Direct participant addition (Graph API limitation)

**Important**: Authenticated mode does NOT change how bots join meetings. All bots still join as guests via browser automation to maintain consistency with Google Meet/Zoom and avoid authentication conflicts when multiple users request bots.

## Multi-User Behavior

### Consistent Across All Platforms
Vexa maintains consistent behavior across Google Meet, Zoom, and Teams:

```bash
# Multiple users can request bots for the same meeting
# User A
POST /bots {"platform": "teams", "bot_name": "Vexa-Bot-A", "meeting_url": "..."}
# Result: "Vexa-Bot-A" joins as guest

# User B (same meeting)  
POST /bots {"platform": "teams", "bot_name": "Vexa-Bot-B", "meeting_url": "..."}
# Result: "Vexa-Bot-B" joins as guest

# User C (with authentication for metadata)
POST /bots {
  "platform": "teams", 
  "bot_name": "Vexa-Bot-C", 
  "auth_mode": "authenticated",
  "organizer_email": "organizer@company.com",
  "meeting_url": "..."
}
# Result: "Vexa-Bot-C" joins as guest + enhanced metadata logged
```

### Benefits of This Approach
- ✅ **No login conflicts**: Each bot is an independent guest
- ✅ **Scalable**: Unlimited concurrent bots per meeting
- ✅ **Consistent**: Same behavior across all platforms
- ✅ **Enhanced features**: Authentication provides metadata without complexity
- ✅ **Backward compatible**: Existing guest mode unchanged

## Configuration

### Prerequisites

1. **Azure App Registration**: You need to register an application in your Azure tenant
2. **Administrative Access**: Tenant admin privileges are required for some configurations
3. **Microsoft 365 License**: Teams functionality requires appropriate M365 licensing

### Step 1: Azure App Registration

1. Sign in to the [Microsoft Entra admin center](https://entra.microsoft.com)
2. Navigate to **Identity** > **Applications** > **App registrations**
3. Click **New registration**
4. Configure your application:
   - **Name**: "Vexa Teams Bot" (or your preferred name)
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: `https://your-domain.com/auth/teams/callback`

### Step 2: Configure API Permissions

Add the following Microsoft Graph **Application permissions**:

- `OnlineMeetings.Read.All` - Read online meeting details
- `OnlineMeetings.ReadWrite.All` - Create and manage online meetings
- `User.Read.All` - Read user directory information (for organizer lookup)

**Important**: After adding permissions, click **Grant admin consent** for your tenant.

### Step 3: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Set an appropriate expiration (e.g., 12 months)
4. **Copy the secret value immediately** - it won't be shown again

### Step 4: Configure Application Access Policy (Required)

For application permissions to work with Teams meetings, you must create an application access policy using PowerShell:

```powershell
# Install and import Teams module
Install-Module -Name MicrosoftTeams -Force -AllowClobber
Import-Module MicrosoftTeams

# Connect to Teams
Connect-MicrosoftTeams

# Create application access policy
New-CsApplicationAccessPolicy -Identity "VexaBotPolicy" -AppIds "YOUR_CLIENT_ID_HERE" -Description "Allow Vexa bot to access Teams meetings"

# Grant policy globally (or to specific users)
Grant-CsApplicationAccessPolicy -PolicyName "VexaBotPolicy" -Global
```

Replace `YOUR_CLIENT_ID_HERE` with your Azure app registration Client ID.

### Step 5: Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Microsoft Teams Integration Configuration
TEAMS_CLIENT_ID=your-azure-app-client-id-here
TEAMS_CLIENT_SECRET=your-azure-app-client-secret-here
TEAMS_TENANT_ID=your-azure-tenant-id-here
TEAMS_REDIRECT_URI=https://your-domain.com/auth/teams/callback
```

## API Usage

### Creating Meetings with Authentication

```bash
# Create a bot with authenticated Teams mode
curl -X POST https://your-domain.com/bots \\
  -H "X-API-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "platform": "teams",
    "native_meeting_id": "teams_meeting_123",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
    "auth_mode": "authenticated",
    "organizer_email": "organizer@yourdomain.com",
    "bot_name": "Vexa Transcription Bot"
  }'
```

### Admin API Endpoints

#### Configure Teams Integration
```bash
POST /teams/config
Content-Type: application/json
X-Admin-API-Key: your-admin-token

{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret", 
  "tenant_id": "your-tenant-id",
  "redirect_uri": "https://your-domain.com/auth/teams/callback"
}
```

#### Create Teams Meeting
```bash
POST /teams/meetings
Content-Type: application/json
X-API-Key: your-user-token

{
  "subject": "Weekly Team Sync",
  "start_time": "2025-01-15T14:00:00Z",
  "end_time": "2025-01-15T15:00:00Z",
  "organizer_email": "manager@yourdomain.com"
}
```

#### Check Teams Status
```bash
GET /teams/status
```

### Request Parameters

#### MeetingCreate Schema Updates

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auth_mode` | string | No | Authentication mode: "guest" (default) or "authenticated" |
| `organizer_email` | string | No | Email of meeting organizer (required for authenticated mode) |

## Troubleshooting

### Common Issues

#### 1. "Application is not allowed to perform operations"
**Solution**: Ensure you've created and applied the Application Access Policy (Step 4).

#### 2. "OnlineMeetings.ReadWrite scope does not exist"
**Cause**: Using personal Microsoft account instead of work/school account.
**Solution**: Use a work or school account for authentication.

#### 3. "Invalid client secret"
**Cause**: Client secret expired or incorrectly copied.
**Solution**: Generate a new client secret in Azure portal.

#### 4. "Meeting not found for URL"
**Cause**: Organizer email doesn't match the meeting organizer, or meeting doesn't exist.
**Solution**: Verify the organizer email and meeting URL are correct.

### Debugging

Enable debug logging by setting `LOG_LEVEL=DEBUG` in your environment:

```bash
export LOG_LEVEL=DEBUG
```

Check bot container logs:
```bash
docker logs <container-id>
```

Look for Teams authentication messages:
- `[Teams] Authentication mode: authenticated`
- `[Teams Auth] Graph API client initialized`
- `[Teams Auth] Found meeting: [subject]`

## Limitations

### Microsoft Graph API Limitations

1. **Participant Management**: Graph API doesn't support adding participants to existing meetings directly
2. **Personal Accounts**: OnlineMeetings permissions don't work with personal Microsoft accounts
3. **Tenant Restrictions**: Application permissions require organizational admin consent
4. **Rate Limits**: Graph API has throttling limits for high-volume usage

### Workarounds

1. **Adding Participants**: Create meetings with initial participant list instead of adding later
2. **Calendar Integration**: Use Calendar API for more advanced meeting management
3. **Delegated Permissions**: Consider implementing OAuth flow for user-specific permissions

## Security Considerations

1. **Client Secret Storage**: Store client secrets securely, use Azure Key Vault in production
2. **Token Management**: Implement proper token refresh and error handling
3. **Audit Logging**: Monitor application access and API usage
4. **Principle of Least Privilege**: Only request necessary permissions
5. **Secret Rotation**: Regularly rotate client secrets

## Advanced Configuration

### Production Deployment

For production deployments, consider:

1. **Azure Key Vault**: Store secrets in Azure Key Vault instead of environment variables
2. **Managed Identity**: Use Azure Managed Identity for authentication
3. **Certificate Authentication**: Use certificates instead of client secrets
4. **Monitoring**: Implement application insights and monitoring

### Multi-Tenant Support

To support multiple tenants:

1. Change supported account types to "Accounts in any organizational directory"
2. Update redirect URIs for multi-tenant scenarios
3. Implement tenant-specific configuration storage
4. Handle tenant discovery in authentication flow

## API Reference

See the full API documentation at `/docs` endpoint when the admin API is running.

### Teams Integration Endpoints

- `GET /teams/status` - Check integration status
- `POST /teams/config` - Configure authentication (admin only)
- `GET /teams/config` - Get current configuration (admin only)  
- `POST /teams/meetings` - Create Teams meeting
- `GET /teams/auth/url` - Get OAuth authorization URL
- `POST /teams/meetings/{id}/participants` - Add participant (limited functionality)

## Support

For additional support:

1. Check the main [Vexa documentation](../README.md)
2. Review Microsoft Graph API documentation
3. Check Azure AD application logs
4. Contact your organization's IT administrator for tenant-specific issues