import { Page } from "playwright";
import { BotConfig } from "../types";
export declare function handleGoogleMeet(botConfig: BotConfig, page: Page, gracefulLeaveFunction: (page: Page | null, exitCode: number, reason: string) => Promise<void>): Promise<void>;
export declare function leaveGoogleMeet(page: Page): Promise<boolean>;
