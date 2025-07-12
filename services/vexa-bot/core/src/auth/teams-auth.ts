import { AuthenticationProvider, AuthenticationResult } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { ClientSecretCredential } from "@azure/identity";
import { log } from "../utils";

export interface TeamsAuthConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface TeamsUserAuth {
  accessToken: string;
  refreshToken: string;
  expiresOn: Date;
  userId: string;
  email: string;
}

export interface OnlineMeetingInfo {
  id: string;
  joinWebUrl: string;
  subject?: string;
  startDateTime: string;
  endDateTime: string;
  organizer: {
    identity: {
      user: {
        id: string;
        displayName: string;
      };
    };
  };
}

export class TeamsAuthService {
  private graphClient: Client | null = null;
  private config: TeamsAuthConfig;
  private credential: ClientSecretCredential;

  constructor(config: TeamsAuthConfig) {
    this.config = config;
    this.credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    );
  }

  /**
   * Initialize Graph API client with application permissions
   */
  async initializeAppClient(): Promise<void> {
    try {
      const authProvider = new TokenCredentialAuthenticationProvider(this.credential, {
        scopes: ["https://graph.microsoft.com/.default"]
      });

      this.graphClient = Client.initWithMiddleware({
        authProvider: authProvider
      });

      log("[Teams Auth] Graph API client initialized with application permissions");
    } catch (error: any) {
      log(`[Teams Auth] Failed to initialize Graph client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an online meeting on behalf of a user
   */
  async createOnlineMeeting(
    userId: string,
    subject: string,
    startTime: Date,
    endTime: Date
  ): Promise<OnlineMeetingInfo> {
    if (!this.graphClient) {
      throw new Error("Graph client not initialized. Call initializeAppClient() first.");
    }

    try {
      const meetingRequest = {
        subject: subject,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
        participants: {
          organizer: {
            identity: {
              user: {
                id: userId
              }
            }
          }
        }
      };

      log(`[Teams Auth] Creating online meeting for user ${userId}: ${subject}`);
      
      const meeting = await this.graphClient
        .api(`/users/${userId}/onlineMeetings`)
        .post(meetingRequest);

      log(`[Teams Auth] Successfully created meeting: ${meeting.id}`);
      
      return {
        id: meeting.id,
        joinWebUrl: meeting.joinWebUrl,
        subject: meeting.subject,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
        organizer: meeting.participants?.organizer || {
          identity: {
            user: {
              id: userId,
              displayName: "Unknown"
            }
          }
        }
      };
    } catch (error: any) {
      log(`[Teams Auth] Failed to create online meeting: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get meeting information by join URL or meeting ID
   */
  async getMeetingInfo(userIdOrEmail: string, joinUrl?: string, meetingId?: string): Promise<OnlineMeetingInfo | null> {
    if (!this.graphClient) {
      throw new Error("Graph client not initialized. Call initializeAppClient() first.");
    }

    try {
      let meeting;

      if (meetingId) {
        // Get meeting by ID
        meeting = await this.graphClient
          .api(`/users/${userIdOrEmail}/onlineMeetings/${meetingId}`)
          .get();
      } else if (joinUrl) {
        // Search for meeting by join URL
        const meetings = await this.graphClient
          .api(`/users/${userIdOrEmail}/onlineMeetings`)
          .filter(`JoinWebUrl eq '${joinUrl}'`)
          .get();

        meeting = meetings.value?.[0];
      } else {
        throw new Error("Either meetingId or joinUrl must be provided");
      }

      if (!meeting) {
        log(`[Teams Auth] Meeting not found for user ${userIdOrEmail}`);
        return null;
      }

      return {
        id: meeting.id,
        joinWebUrl: meeting.joinWebUrl,
        subject: meeting.subject,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
        organizer: meeting.participants?.organizer || {
          identity: {
            user: {
              id: userIdOrEmail,
              displayName: "Unknown"
            }
          }
        }
      };
    } catch (error: any) {
      log(`[Teams Auth] Failed to get meeting info: ${error.message}`);
      return null;
    }
  }

  /**
   * Add participant to an existing meeting
   */
  async addParticipantToMeeting(
    organizerUserId: string,
    meetingId: string,
    participantEmail: string
  ): Promise<boolean> {
    if (!this.graphClient) {
      throw new Error("Graph client not initialized. Call initializeAppClient() first.");
    }

    try {
      // Note: Microsoft Graph doesn't directly support adding participants to existing meetings
      // This would typically require updating the meeting or using calendar events
      // For now, we'll log this limitation
      log(`[Teams Auth] Adding participants to existing meetings requires calendar API integration`);
      log(`[Teams Auth] Consider using createOnlineMeeting with initial participants instead`);
      
      return false;
    } catch (error: any) {
      log(`[Teams Auth] Failed to add participant to meeting: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user information by email
   */
  async getUserByEmail(email: string): Promise<{ id: string; displayName: string } | null> {
    if (!this.graphClient) {
      throw new Error("Graph client not initialized. Call initializeAppClient() first.");
    }

    try {
      const user = await this.graphClient
        .api(`/users/${email}`)
        .select("id,displayName,mail")
        .get();

      return {
        id: user.id,
        displayName: user.displayName
      };
    } catch (error: any) {
      log(`[Teams Auth] Failed to get user by email: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate OAuth authorization URL for user consent (for future delegated permissions)
   */
  generateAuthUrl(state?: string): string {
    const scopes = [
      "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
      "https://graph.microsoft.com/User.Read"
    ].join(" ");

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: scopes,
      response_mode: "query",
      ...(state && { state })
    });

    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Check if the service is properly configured
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.clientId) {
      errors.push("Client ID is required");
    }
    if (!this.config.clientSecret) {
      errors.push("Client Secret is required");
    }
    if (!this.config.tenantId) {
      errors.push("Tenant ID is required");
    }
    if (!this.config.redirectUri) {
      errors.push("Redirect URI is required");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default TeamsAuthService;