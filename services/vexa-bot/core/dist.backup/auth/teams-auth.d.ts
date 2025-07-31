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
export declare class TeamsAuthService {
    private graphClient;
    private config;
    private credential;
    constructor(config: TeamsAuthConfig);
    /**
     * Initialize Graph API client with application permissions
     */
    initializeAppClient(): Promise<void>;
    /**
     * Create an online meeting on behalf of a user
     */
    createOnlineMeeting(userId: string, subject: string, startTime: Date, endTime: Date): Promise<OnlineMeetingInfo>;
    /**
     * Get meeting information by join URL or meeting ID
     */
    getMeetingInfo(userIdOrEmail: string, joinUrl?: string, meetingId?: string): Promise<OnlineMeetingInfo | null>;
    /**
     * Add participant to an existing meeting
     */
    addParticipantToMeeting(organizerUserId: string, meetingId: string, participantEmail: string): Promise<boolean>;
    /**
     * Get user information by email
     */
    getUserByEmail(email: string): Promise<{
        id: string;
        displayName: string;
    } | null>;
    /**
     * Generate OAuth authorization URL for user consent (for future delegated permissions)
     */
    generateAuthUrl(state?: string): string;
    /**
     * Check if the service is properly configured
     */
    validateConfiguration(): {
        valid: boolean;
        errors: string[];
    };
}
export default TeamsAuthService;
