"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsAuthService = void 0;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const azureTokenCredentials_1 = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const identity_1 = require("@azure/identity");
const utils_1 = require("../utils");
class TeamsAuthService {
    constructor(config) {
        this.graphClient = null;
        this.config = config;
        this.credential = new identity_1.ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret);
    }
    /**
     * Initialize Graph API client with application permissions
     */
    async initializeAppClient() {
        try {
            const authProvider = new azureTokenCredentials_1.TokenCredentialAuthenticationProvider(this.credential, {
                scopes: ["https://graph.microsoft.com/.default"]
            });
            this.graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
                authProvider: authProvider
            });
            (0, utils_1.log)("[Teams Auth] Graph API client initialized with application permissions");
        }
        catch (error) {
            (0, utils_1.log)(`[Teams Auth] Failed to initialize Graph client: ${error.message}`);
            throw error;
        }
    }
    /**
     * Create an online meeting on behalf of a user
     */
    async createOnlineMeeting(userId, subject, startTime, endTime) {
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
            (0, utils_1.log)(`[Teams Auth] Creating online meeting for user ${userId}: ${subject}`);
            const meeting = await this.graphClient
                .api(`/users/${userId}/onlineMeetings`)
                .post(meetingRequest);
            (0, utils_1.log)(`[Teams Auth] Successfully created meeting: ${meeting.id}`);
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
        }
        catch (error) {
            (0, utils_1.log)(`[Teams Auth] Failed to create online meeting: ${error.message}`);
            throw error;
        }
    }
    /**
     * Get meeting information by join URL or meeting ID
     */
    async getMeetingInfo(userIdOrEmail, joinUrl, meetingId) {
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
            }
            else if (joinUrl) {
                // Search for meeting by join URL
                const meetings = await this.graphClient
                    .api(`/users/${userIdOrEmail}/onlineMeetings`)
                    .filter(`JoinWebUrl eq '${joinUrl}'`)
                    .get();
                meeting = meetings.value?.[0];
            }
            else {
                throw new Error("Either meetingId or joinUrl must be provided");
            }
            if (!meeting) {
                (0, utils_1.log)(`[Teams Auth] Meeting not found for user ${userIdOrEmail}`);
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
        }
        catch (error) {
            (0, utils_1.log)(`[Teams Auth] Failed to get meeting info: ${error.message}`);
            return null;
        }
    }
    /**
     * Add participant to an existing meeting
     */
    async addParticipantToMeeting(organizerUserId, meetingId, participantEmail) {
        if (!this.graphClient) {
            throw new Error("Graph client not initialized. Call initializeAppClient() first.");
        }
        try {
            // Note: Microsoft Graph doesn't directly support adding participants to existing meetings
            // This would typically require updating the meeting or using calendar events
            // For now, we'll log this limitation
            (0, utils_1.log)(`[Teams Auth] Adding participants to existing meetings requires calendar API integration`);
            (0, utils_1.log)(`[Teams Auth] Consider using createOnlineMeeting with initial participants instead`);
            return false;
        }
        catch (error) {
            (0, utils_1.log)(`[Teams Auth] Failed to add participant to meeting: ${error.message}`);
            return false;
        }
    }
    /**
     * Get user information by email
     */
    async getUserByEmail(email) {
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
        }
        catch (error) {
            (0, utils_1.log)(`[Teams Auth] Failed to get user by email: ${error.message}`);
            return null;
        }
    }
    /**
     * Generate OAuth authorization URL for user consent (for future delegated permissions)
     */
    generateAuthUrl(state) {
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
    validateConfiguration() {
        const errors = [];
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
exports.TeamsAuthService = TeamsAuthService;
exports.default = TeamsAuthService;
//# sourceMappingURL=teams-auth.js.map