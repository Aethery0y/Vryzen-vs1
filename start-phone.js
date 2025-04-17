// Start script for phone number verification method
const { connectWithPhoneNumber } = require('./lib/phoneAuth');

console.log('Starting WhatsApp bot with phone number verification...');

connectWithPhoneNumber().catch(err => {
    console.error('Error in phone number verification:', err);
    process.exit(1);
}); 