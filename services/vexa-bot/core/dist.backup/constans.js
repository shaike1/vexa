"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserArgs = exports.userAgent = void 0;
// User Agent for consistency
exports.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
// Browser launch arguments
exports.browserArgs = [
    "--incognito",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",
    "--disable-gpu",
    // Audio/Video permissions for Teams transcription and speech output
    "--use-fake-ui-for-media-stream", // Auto-approve permission dialogs
    "--allow-running-insecure-content",
    "--disable-web-security", // Allow access to media devices
    "--enable-features=WebRTC-HideLocalIpsWithMdns",
    "--disable-features=VizDisplayCompositor", // Improve audio handling
    // Enhanced audio configuration for speech synthesis
    "--enable-logging",
    "--log-level=0",
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-device-for-media-stream", // Use virtual audio devices
    "--enable-experimental-web-platform-features", // Enable latest audio APIs
    "--force-device-scale-factor=1", // Prevent audio scaling issues
    "--disable-background-timer-throttling", // Prevent audio interruption
    "--disable-renderer-backgrounding", // Keep audio active
    "--disable-backgrounding-occluded-windows", // Maintain audio context
    "--enable-precise-memory-info" // Better memory management for audio
];
//# sourceMappingURL=constans.js.map