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
        // First try to use provided socket with more robust checks
        if (sock) {
            if (sock.user && sock.user.id) {
                // If we have a valid user ID, the connection is likely active
                return {
                    isConnected: true, 
                    socketProvided: true,
                    detail: { userId: sock.user.id }
                };
            }
            
            // If socket exists but has no user property, check if it has a ws property
            // and if that property indicates a connected state
            if (sock.ws) {
                const wsState = sock.ws.readyState;
                // WebSocket.OPEN = 1
                if (wsState === 1) {
                    return {
                        isConnected: true,
                        socketProvided: true,
                        detail: { websocketState: 'OPEN' }
                    };
                } 
                
                // Not connected but we know the state
                return {
                    isConnected: false,
                    socketProvided: true,
                    needsConnection: true,
                    detail: { 
                        websocketState: wsState === 0 ? 'CONNECTING' : 
                                       wsState === 2 ? 'CLOSING' : 
                                       wsState === 3 ? 'CLOSED' : 'UNKNOWN' 
                    },
                    message: `WhatsApp WebSocket is not active (state: ${wsState}). Please wait for reconnection.`
                };
            }
        }
        
        // Otherwise check connection status from main app
        const connectionStatus = mainApp.getConnectionStatus();
        
        if (!connectionStatus.isConnected) {
            console.log('Connection status checker confirms disconnection');
            
            // Enhanced diagnostics on connection failures
            if (connectionStatus.lastError) {
                console.log('Last connection error:', connectionStatus.lastError);
                
                // Check for 403 errors which are common
                if (connectionStatus.lastError.output?.statusCode === 403 ||
                    connectionStatus.lastError.data?.reason === '403') {
                    console.log('Detected 403 error in connection helper - WhatsApp is likely blocking the connection');
                    return {
                        isConnected: false,
                        needsConnection: true,
                        detail: { 
                            statusCode: 403,
                            errorType: 'Forbidden',
                            location: connectionStatus.lastError.data?.location || 'unknown',
                            retryScheduled: connectionStatus.retryScheduled || false
                        },
                        error403: true,
                        message: 'WhatsApp connection was blocked with a 403 error. The system will automatically retry.'
                    };
                }
            }
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
 * This is an enhanced version that handles 403 errors and other common connection issues
 * 
 * @param {string} operation - Name of the operation being performed
 * @param {Object} sock - WhatsApp socket connection (optional)
 * @returns {Object} Connection status with detailed information
 */
function checkConnectionBeforeAction(operation, sock = null) {
    const status = checkWhatsAppConnection(sock);
    
    if (!status.isConnected) {
        // Check if this is a 403 error specifically
        if (status.error403) {
            console.error(`Cannot perform ${operation}: WhatsApp connection blocked with 403 error`);
            return {
                success: false,
                isConnected: false,
                needsConnection: true,
                error403: true,
                detail: status.detail || {},
                message: `Cannot perform ${operation} because WhatsApp is currently blocking our connection (403 error). The system will automatically reconnect. Please try again in a few minutes.`,
                operation
            };
        }
        
        // For websocket status details
        let additionalMessage = '';
        if (status.detail?.websocketState) {
            additionalMessage = ` (WebSocket state: ${status.detail.websocketState})`;
        }
        
        console.error(`Cannot perform ${operation}: WhatsApp connection not established${additionalMessage}`);
        return {
            success: false,
            isConnected: false,
            needsConnection: true,
            detail: status.detail || {},
            message: `WhatsApp connection is not established${additionalMessage}. Please ensure the bot is connected before performing this operation.`,
            operation
        };
    }
    
    return {
        success: true,
        isConnected: true,
        operation,
        detail: status.detail || {}
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