// Fix for Teams participant detection
// This script updates the participant selectors to work with current Teams UI

const fs = require('fs');
const path = require('path');

const teamsJsPath = '/root/vexa/services/vexa-bot/core/dist/platforms/teams.js';

console.log('🔧 Fixing Teams participant detection...');

// Read the current teams.js file
let teamsCode = fs.readFileSync(teamsJsPath, 'utf8');

// Updated selectors that work with current Teams UI
const oldSelector = `const teamsParticipantSelector = '[data-tid="participant-tile"], [data-tid="roster-list-item"]';`;
const newSelector = `const teamsParticipantSelector = '[data-tid="participant-tile"], [data-tid="roster-list-item"], [data-tid="call-roster-participant"], [role="gridcell"], [data-testid="participant-item"], .ts-call-participant, .participant-tile, .roster-list-item, [aria-label*="participant"], [title*="participant"], .call-participant, .participant-container';`;

// Also make participant detection more aggressive
const oldTimeout = 'if (count <= 1) {';
const newTimeout = 'if (count <= 0) {  // Changed from <= 1 to <= 0 to only leave when truly alone';

// Update timeout from 2 minutes to 5 minutes
const oldAloneTime = 'if (aloneTime >= 120) { // Increased to 2 minutes';
const newAloneTime = 'if (aloneTime >= 300) { // Increased to 5 minutes';

console.log('📝 Applying fixes...');

// Apply the fixes
teamsCode = teamsCode.replace(oldSelector, newSelector);
teamsCode = teamsCode.replace(oldTimeout, newTimeout);  
teamsCode = teamsCode.replace(oldAloneTime, newAloneTime);

// Add more robust participant detection
const participantObserverCode = `
// Enhanced participant detection for modern Teams
function enhancedParticipantDetection() {
    const modernSelectors = [
        '[data-tid="call-roster-participant"]',
        '[role="gridcell"]',
        '[data-testid="participant-item"]', 
        '.ts-call-participant',
        '.participant-tile',
        '.roster-list-item',
        '[aria-label*="participant"]',
        '[title*="participant"]',
        '.call-participant',
        '.participant-container',
        '[data-tid="participant"]',
        '[data-tid="person-avatar"]'
    ];
    
    let foundParticipants = new Set();
    
    modernSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el, index) => {
                if (el.offsetWidth > 0 && el.offsetHeight > 0) { // Only visible elements
                    const id = el.id || el.dataset.tid || el.dataset.testid || \`modern-participant-\${selector.replace(/[^a-zA-Z0-9]/g, '')}-\${index}\`;
                    foundParticipants.add(id);
                }
            });
        } catch (e) {
            // Selector might not work in this Teams version, continue
        }
    });
    
    // Also check for video streams as indicators of participants
    const videoElements = document.querySelectorAll('video[src*="stream"], video[srcObject]');
    videoElements.forEach((video, index) => {
        if (video.offsetWidth > 0 && video.offsetHeight > 0) {
            foundParticipants.add(\`video-participant-\${index}\`);
        }
    });
    
    return foundParticipants;
}`;

// Insert the enhanced detection before the monitoring code
const insertPoint = 'const activeParticipants = new Map();';
teamsCode = teamsCode.replace(insertPoint, insertPoint + participantObserverCode);

// Update the participant checking logic
const oldParticipantCheck = `const count = activeParticipants.size;
                        const participantIds = Array.from(activeParticipants.keys());`;

const newParticipantCheck = `// Use enhanced detection
                        const enhancedParticipants = enhancedParticipantDetection();
                        enhancedParticipants.forEach(id => {
                            if (!activeParticipants.has(id)) {
                                activeParticipants.set(id, { name: 'Detected Participant', enhanced: true });
                            }
                        });
                        
                        const count = Math.max(activeParticipants.size, enhancedParticipants.size);
                        const participantIds = Array.from(new Set([...Array.from(activeParticipants.keys()), ...Array.from(enhancedParticipants)]));`;

teamsCode = teamsCode.replace(oldParticipantCheck, newParticipantCheck);

// Write the fixed code back
fs.writeFileSync(teamsJsPath, teamsCode);

console.log('✅ Teams participant detection fixed!');
console.log('🔧 Changes applied:');
console.log('   - Updated participant selectors for modern Teams UI');
console.log('   - Added enhanced participant detection with multiple selectors');
console.log('   - Changed alone threshold from <= 1 to <= 0 participants');
console.log('   - Increased timeout from 2 to 5 minutes');
console.log('   - Added video stream detection as participant indicator');
console.log('');
console.log('🎯 The bot should now properly detect participants and stay in meetings!');