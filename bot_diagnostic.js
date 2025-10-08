// Simple diagnostic script to run inside the bot container
const { execSync } = require('child_process');

console.log('=== BOT DIAGNOSTIC REPORT ===');
console.log('Time:', new Date().toISOString());

// Check if Teams process is still running
try {
    const nodeProcesses = execSync('ps aux | grep "node.*teams"').toString();
    console.log('Node/Teams processes:', nodeProcesses);
} catch (e) {
    console.log('No Teams node processes found');
}

// Check browser processes
try {
    const chromeProcesses = execSync('ps aux | grep chrome | grep -v grep').toString();
    console.log('Chrome processes running:', chromeProcesses.split('\n').length - 1);
} catch (e) {
    console.log('No Chrome processes found');
}

// Check container logs for recent activity
try {
    console.log('\n=== RECENT LOGS ===');
    const recentLogs = execSync('tail -20 /proc/1/fd/1').toString();
    console.log(recentLogs);
} catch (e) {
    console.log('Could not read recent logs');
}

console.log('\n=== DIAGNOSTIC COMPLETE ===');