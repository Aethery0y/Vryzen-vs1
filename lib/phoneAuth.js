const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const readline = require('readline');
const pino = require('pino');

// Create readline interface for user input
let rl;

// Promise wrapper for readline
const question = (query) => new Promise((resolve) => {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    rl.question(query, resolve);
});

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

        console.log('Setting up WhatsApp connection...');
        
        // Set up WhatsApp connection
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        const sock = makeWASocket({
            logger: pino({ level: 'debug' }),
            auth: state,
            // Use a more common browser configuration
            browser: ['Chrome (Linux)', 'Chrome', '116.0.0'],
            // Enable mobile mode for better compatibility
            mobile: true,
            phoneNumber: phoneNumber,
            // Connection settings
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 30000,
            emitOwnEvents: false,
            fireInitQueries: false,
            markOnlineOnConnect: false,
            retryRequestDelayMs: 2000,
            syncFullHistory: false,
            // Disable QR code and use phone verification
            qrTimeout: 0,
            // Use a stable version
            version: [2, 2323, 4],
            // Additional settings for better connection
            getMessage: async () => {},
            printQRInTerminal: false,
            // Add these to avoid detection
            baileys: {
                hideLog: true
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
            
            console.log('Connection update:', {
                connection,
                isNewLogin,
                receivedPendingNotifications,
                error: lastDisconnect?.error
            });
            
            if (isNewLogin) {
                console.log('New login detected. Please check your WhatsApp for the verification code.');
            }
            
            if (connection === 'open') {
                console.log('Successfully connected with phone number verification!');
                await saveCreds(); // Save credentials
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('Connection closed with status code:', statusCode);
                
                // Handle specific error codes
                if (statusCode === 405) {
                    console.log('WhatsApp is blocking the connection. Please try using the QR code method instead.');
                    if (rl) {
                        rl.close();
                        rl = null;
                    }
                    process.exit(1);
                }
                
                const shouldReconnect = statusCode !== 401 && statusCode !== 405;
                if (shouldReconnect) {
                    console.log('Connection closed, attempting to reconnect...');
                    setTimeout(() => {
                        connectWithPhoneNumber().catch(console.error);
                    }, 3000);
                } else {
                    console.log('Connection closed. Please try again.');
                    if (rl) {
                        rl.close();
                        rl = null;
                    }
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
    }
}

// Handle process exit
process.on('exit', () => {
    if (rl) {
        rl.close();
    }
});

module.exports = {
    connectWithPhoneNumber,
    isValidPhoneNumber
}; 