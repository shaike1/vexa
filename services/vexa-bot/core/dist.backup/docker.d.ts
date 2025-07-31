import { z } from 'zod';
export declare const BotConfigSchema: z.ZodObject<{
    platform: z.ZodEnum<["google_meet", "zoom", "teams"]>;
    meetingUrl: z.ZodNullable<z.ZodString>;
    botName: z.ZodString;
    token: z.ZodString;
    connectionId: z.ZodString;
    nativeMeetingId: z.ZodString;
    language: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    task: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    redisUrl: z.ZodString;
    automaticLeave: z.ZodObject<{
        waitingRoomTimeout: z.ZodNumber;
        noOneJoinedTimeout: z.ZodNumber;
        everyoneLeftTimeout: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        waitingRoomTimeout: number;
        noOneJoinedTimeout: number;
        everyoneLeftTimeout: number;
    }, {
        waitingRoomTimeout: number;
        noOneJoinedTimeout: number;
        everyoneLeftTimeout: number;
    }>;
    reconnectionIntervalMs: z.ZodOptional<z.ZodNumber>;
    meeting_id: z.ZodOptional<z.ZodNumber>;
    botManagerCallbackUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    platform: "zoom" | "google_meet" | "teams";
    token: string;
    meetingUrl: string | null;
    connectionId: string;
    nativeMeetingId: string;
    botName: string;
    redisUrl: string;
    automaticLeave: {
        waitingRoomTimeout: number;
        noOneJoinedTimeout: number;
        everyoneLeftTimeout: number;
    };
    language?: string | null | undefined;
    task?: string | null | undefined;
    reconnectionIntervalMs?: number | undefined;
    meeting_id?: number | undefined;
    botManagerCallbackUrl?: string | undefined;
}, {
    platform: "zoom" | "google_meet" | "teams";
    token: string;
    meetingUrl: string | null;
    connectionId: string;
    nativeMeetingId: string;
    botName: string;
    redisUrl: string;
    automaticLeave: {
        waitingRoomTimeout: number;
        noOneJoinedTimeout: number;
        everyoneLeftTimeout: number;
    };
    language?: string | null | undefined;
    task?: string | null | undefined;
    reconnectionIntervalMs?: number | undefined;
    meeting_id?: number | undefined;
    botManagerCallbackUrl?: string | undefined;
}>;
