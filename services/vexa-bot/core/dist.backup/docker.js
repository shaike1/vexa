"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotConfigSchema = void 0;
const _1 = require(".");
const zod_1 = require("zod");
// Define a schema that matches your JSON configuration
exports.BotConfigSchema = zod_1.z.object({
    platform: zod_1.z.enum(["google_meet", "zoom", "teams"]),
    meetingUrl: zod_1.z.string().url().nullable(), // Allow null from BOT_CONFIG
    botName: zod_1.z.string(),
    token: zod_1.z.string(),
    connectionId: zod_1.z.string(),
    nativeMeetingId: zod_1.z.string(), // *** ADDED schema field ***
    language: zod_1.z.string().nullish(), // Optional language
    task: zod_1.z.string().nullish(), // Optional task
    redisUrl: zod_1.z.string(), // Required Redis URL
    automaticLeave: zod_1.z.object({
        waitingRoomTimeout: zod_1.z.number().int(),
        noOneJoinedTimeout: zod_1.z.number().int(),
        everyoneLeftTimeout: zod_1.z.number().int()
    }),
    reconnectionIntervalMs: zod_1.z.number().int().optional(), // ADDED: Optional reconnection interval
    meeting_id: zod_1.z.number().int().optional(), // Allow optional internal ID
    botManagerCallbackUrl: zod_1.z.string().url().optional() // ADDED: Optional callback URL
});
(function main() {
    const rawConfig = process.env.BOT_CONFIG;
    if (!rawConfig) {
        console.error("BOT_CONFIG environment variable is not set");
        process.exit(1);
    }
    try {
        // Parse the JSON string from the environment variable
        const parsedConfig = JSON.parse(rawConfig);
        // Validate and parse the config using zod
        const botConfig = exports.BotConfigSchema.parse(parsedConfig);
        // Run the bot with the validated configuration
        (0, _1.runBot)(botConfig).catch((error) => {
            console.error("Error running bot:", error);
            process.exit(1);
        });
    }
    catch (error) {
        console.error("Invalid BOT_CONFIG:", error);
        process.exit(1);
    }
})();
//# sourceMappingURL=docker.js.map