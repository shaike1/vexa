const { chromium } = require('playwright');

async function captureScreenshot() {
    console.log('Connecting to browser...');
    
    // Connect to the existing browser
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    
    // Get all pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} pages`);
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const url = page.url();
        console.log(`Page ${i}: ${url}`);
        
        if (url.includes('teams.microsoft.com')) {
            console.log('Found Teams page, taking screenshot...');
            await page.screenshot({ path: `/tmp/screenshots/teams_current_${Date.now()}.png`, fullPage: true });
            
            // Get page title and current HTML structure
            const title = await page.title();
            console.log(`Page title: ${title}`);
            
            // Check for specific elements
            const elements = await page.evaluate(() => {
                const body = document.body.innerText;
                const hasJoinButton = !!document.querySelector('[data-tid="prejoin-join-button"]');
                const hasRosterButton = !!document.querySelector('[data-tid="call-roster-button"]');
                const hasLobbyText = body.includes('Someone will let you in shortly') || 
                                   body.includes('waiting for the meeting to start') ||
                                   body.includes('You\'re in the lobby');
                const hasMeetingText = body.includes('meeting') || body.includes('Meeting');
                
                return {
                    hasJoinButton,
                    hasRosterButton, 
                    hasLobbyText,
                    hasMeetingText,
                    bodyPreview: body.substring(0, 500)
                };
            });
            
            console.log('Page elements:', JSON.stringify(elements, null, 2));
            break;
        }
    }
    
    await browser.close();
}

captureScreenshot().catch(console.error);