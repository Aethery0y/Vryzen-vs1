// Start script for QR code connection method
const { connectToWhatsApp } = require('./index');

console.log('Starting WhatsApp bot with QR code authentication...');
console.log('Please scan the QR code with your WhatsApp when it appears.');

connectToWhatsApp().catch(err => {
    console.error('Error in QR connection:', err);
    process.exit(1);
}); 