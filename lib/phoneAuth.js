const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const readline = require('readline');
const pino = require('pino');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promise wrapper for readline
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * Validates a phone number format
 * @param {string} phoneNumber 
 * @returns {boolean}
 */
function isValidPhoneNumber(phoneNumber) {
    // Basic validation for international format: +[country code][number]
    return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

/**
 * Handles phone number verification process
 * @returns {Promise<object>} WhatsApp socket connection
 */
async function connectWithPhoneNumber() {
    try {
        console.log('\nPhone Number Verification Method');
        console.log('===============================');
        
        // Get phone number from user
        let phoneNumber;
        do {
            phoneNumber = await question('Enter your phone number with country code (e.g., +1234567890): ');
            if (!isValidPhoneNumber(phoneNumber)) {
                console.log('Invalid phone number format. Please use international format with + and country code.');
            }
        } while (!isValidPhoneNumber(phoneNumber));

        // Set up WhatsApp connection
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ['Chrome', 'Desktop', '93.0.4577.63'],
            mobile: false
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log('Successfully connected with phone number verification!');
                await saveCreds(); // Save credentials
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                if (shouldReconnect) {
                    console.log('Connection closed, attempting to reconnect...');
                    await connectWithPhoneNumber();
                } else {
                    console.log('Connection closed. Please try again.');
                    process.exit(1);
                }
            }
        });

        // Handle credentials updates
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        console.error('Error in phone verification process:', error);
        throw error;
    } finally {
        rl.close();
    }
}

module.exports = {
    connectWithPhoneNumber,
    isValidPhoneNumber
}; 