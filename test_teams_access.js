#!/usr/bin/env node
/**
 * Test script to diagnose Teams access issues
 * Tests browser navigation, timeouts, and performance bottlenecks
 */

const { chromium } = require('playwright');

async function testTeamsAccess() {
    console.log('🔍 Diagnosing Teams Access Issues');
    console.log('=' .repeat(50));
    
    let browser = null;
    let page = null;
    
    try {
        // Launch browser with same config as bot
        console.log('🚀 Launching browser...');
        const startTime = Date.now();
        
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript-harmony-shipping',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--allow-running-insecure-content',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--max_old_space_size=4096'
            ]
        });
        
        const launchTime = Date.now() - startTime;
        console.log(`✅ Browser launched in ${launchTime}ms`);
        
        // Create page
        console.log('📄 Creating page...');
        page = await browser.newPage();
        
        // Set viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        
        // Test 1: Navigate to Teams main page
        console.log('🌐 Test 1: Navigating to Teams main page...');
        const mainPageStart = Date.now();
        
        try {
            await page.goto('https://teams.microsoft.com', { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            const mainPageTime = Date.now() - mainPageStart;
            console.log(`✅ Teams main page loaded in ${mainPageTime}ms`);
        } catch (error) {
            console.log(`❌ Teams main page failed: ${error.message}`);
        }
        
        // Test 2: Test the specific meeting URL
        console.log('🔗 Test 2: Testing specific meeting URL...');
        const meetingUrl = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZTYyNzlkMjgtMGM4MS00OGJkLTllMDktNjQ3ZmE4Zjg5Y2I1%40thread.v2/0?context=%7b%22Tid%22%3a%226a6c7639-7a26-4a3b-b832-507d1afc7b2c%22%2c%22Oid%22%3a%229e657b99-360d-4b53-bd13-2f78cfa4de6b%22%7d';
        
        const meetingStart = Date.now();
        try {
            await page.goto(meetingUrl, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            const meetingTime = Date.now() - meetingStart;
            console.log(`✅ Meeting URL loaded in ${meetingTime}ms`);
        } catch (error) {
            console.log(`❌ Meeting URL failed: ${error.message}`);
            
            // Try with different wait condition
            console.log('🔄 Retrying with domcontentloaded...');
            try {
                await page.goto(meetingUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
                console.log('✅ Meeting URL loaded with domcontentloaded');
            } catch (retryError) {
                console.log(`❌ Retry failed: ${retryError.message}`);
            }
        }
        
        // Test 3: Check page content
        console.log('📋 Test 3: Checking page content...');
        try {
            const title = await page.title();
            console.log(`📝 Page title: "${title}"`);
            
            const url = page.url();
            console.log(`🔗 Current URL: ${url}`);
            
            // Look for common Teams elements
            const elements = await page.$$eval('*', els => 
                els.slice(0, 10).map(el => ({
                    tag: el.tagName.toLowerCase(),
                    id: el.id,
                    className: el.className,
                    textContent: el.textContent?.substring(0, 50)
                }))
            );
            
            console.log('🧩 Page elements:');
            elements.forEach((el, i) => {
                if (el.textContent && el.textContent.trim()) {
                    console.log(`  ${i + 1}. ${el.tag} - "${el.textContent.trim()}"`);
                }
            });
            
        } catch (error) {
            console.log(`❌ Content check failed: ${error.message}`);
        }
        
        // Test 4: Performance metrics
        console.log('⚡ Test 4: Performance metrics...');
        try {
            const metrics = await page.metrics();
            console.log('📊 Performance metrics:');
            console.log(`  DOM nodes: ${metrics.Nodes}`);
            console.log(`  JS event listeners: ${metrics.JSEventListeners}`);
            console.log(`  Memory: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Document count: ${metrics.Documents}`);
            
        } catch (error) {
            console.log(`❌ Performance metrics failed: ${error.message}`);
        }
        
        // Test 5: Network conditions
        console.log('🌐 Test 5: Network conditions...');
        try {
            // Set network conditions to simulate slower connection
            await page.route('**/*', route => {
                // Add delay to simulate network latency
                setTimeout(() => route.continue(), 100);
            });
            
            const networkStart = Date.now();
            await page.goto('https://teams.microsoft.com', { 
                waitUntil: 'networkidle',
                timeout: 15000 
            });
            const networkTime = Date.now() - networkStart;
            console.log(`✅ Network with delay: ${networkTime}ms`);
            
        } catch (error) {
            console.log(`❌ Network test failed: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ Browser test failed: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // Test 6: System resource check
    console.log('💻 Test 6: System resource check...');
    try {
        const { execSync } = require('child_process');
        
        // Check memory usage
        const memInfo = execSync('free -m', { encoding: 'utf8' });
        console.log('💾 Memory usage:');
        console.log(memInfo);
        
        // Check CPU load
        const loadInfo = execSync('uptime', { encoding: 'utf8' });
        console.log('🔥 CPU load:');
        console.log(loadInfo);
        
    } catch (error) {
        console.log(`❌ System resource check failed: ${error.message}`);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('=' .repeat(50));
    console.log('🔍 Check the output above for specific failure points');
    console.log('💡 Common issues:');
    console.log('  - High CPU usage from other containers');
    console.log('  - Network timeouts to Teams servers');
    console.log('  - Browser memory limitations');
    console.log('  - Teams requiring specific authentication');
    console.log('🚀 Recommended fixes will be provided based on results');
}

testTeamsAccess().catch(console.error);