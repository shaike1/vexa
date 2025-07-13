// User Agent for consistency
export const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// Browser launch arguments
export const browserArgs = [
  "--incognito",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-features=IsolateOrigins,site-per-process",
  "--disable-infobars",
  "--disable-gpu",
  // Audio/Video permissions for Teams transcription
  "--use-fake-ui-for-media-stream", // Auto-approve permission dialogs
  "--allow-running-insecure-content",
  "--disable-web-security", // Allow access to media devices
  "--enable-features=WebRTC-HideLocalIpsWithMdns",
  "--disable-features=VizDisplayCompositor", // Improve audio handling
  // Enable system audio capture instead of fake streams
  "--enable-logging",
  "--log-level=0",
  "--autoplay-policy=no-user-gesture-required"
];
