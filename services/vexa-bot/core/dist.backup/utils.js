"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.randomDelay = randomDelay;
function log(message) {
    console.log(`[BotCore] ${message}`);
}
function randomDelay(amount) {
    return (2 * Math.random() - 1) * (amount / 10) + amount;
}
//# sourceMappingURL=utils.js.map