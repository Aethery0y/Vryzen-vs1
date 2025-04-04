/**
 * Connection Helper Module
 * 
 * Provides unified connection status checking functions for WhatsApp operations
 * that require an active connection.
 */

const mainApp = require('../index');

/**
 * Check if the WhatsApp connection is active
 * 
 * @param {Object} sock - WhatsApp socket connection (optional, will use global if not provided)
 * @returns {Object} Connection status information
 */
function checkWhatsAppConnection(sock = null) {
    try {
        // First try to use provided socket
        if (sock && sock.user) {
            return {
                isConnected: true
            };
        }
        
        // Otherwise check connection status from main app
        const connectionStatus = mainApp.getConnectionStatus();
        
        if (!connectionStatus.isConnected) {
            console.log('Connection status checker confirms disconnection');
        }
        
        return {
            isConnected: connectionStatus.isConnected,
            detail: connectionStatus.detail || {},
            needsConnection: !connectionStatus.isConnected,
            message: connectionStatus.isConnected ? 
                'Connection is active' : 
                'WhatsApp connection is not established. Please try again when the bot is connected.'
        };
    } catch (e) {
        console.error('Could not check connection status:', e.message);
        return {
            isConnected: false,
            needsConnection: true,
            error: e.message,
            message: 'WhatsApp connection status could not be determined. Please ensure the bot is running.'
        };
    }
}

/**
 * Check if connection is active before performing a critical operation
 * 
 * @param {string} operation - Name of the operation being performed
 * @param {Object} sock - WhatsApp socket connection (optional)
 * @returns {Object} Connection status with detailed information
 */
function checkConnectionBeforeAction(operation, sock = null) {
    const status = checkWhatsAppConnection(sock);
    
    if (!status.isConnected) {
        console.error(`Cannot perform ${operation}: WhatsApp connection not established`);
        return {
            success: false,
            isConnected: false,
            needsConnection: true,
            message: `WhatsApp connection is not established. Please ensure the bot is connected before performing this operation.`,
            operation
        };
    }
    
    return {
        success: true,
        isConnected: true,
        operation
    };
}

/**
 * Normalize a phone number by removing leading '+' and any non-digit characters
 * 
 * @param {string} phoneNumber - Phone number to normalize
 * @returns {string} Normalized phone number
 */
function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    
    // Remove the leading '+' if present
    let normalized = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
    
    // Remove any non-digit characters
    normalized = normalized.replace(/\D/g, '');
    
    return normalized;
}

module.exports = {
    checkWhatsAppConnection,
    checkConnectionBeforeAction,
    normalizePhoneNumber
};