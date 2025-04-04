/**
 * Evidence Collection System
 * 
 * This module automatically captures and archives abusive or problematic messages
 * from specific users, creating an evidence trail that can be used for reporting.
 */

const fs = require('fs');
const path = require('path');
const database = require('./database');
const { v4: uuidv4 } = require('uuid');

// Constants
const EVIDENCE_DB_KEY = 'evidenceCollectionSettings';
const EVIDENCE_DIR = path.join(__dirname, '../data/evidence');

// Ensure the evidence directory exists
if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

/**
 * Initialize the evidence collection system
 */
function init() {
    // Make sure the evidence settings exist in the database
    if (!database.getData(EVIDENCE_DB_KEY)) {
        database.saveData(EVIDENCE_DB_KEY, {
            trackedUsers: {},      // Map of users being tracked: { userJid: { trackedBy: [jid1, jid2...], since: timestamp } }
            reportSessions: {},    // Map of ongoing report sessions: { sessionId: { owner: jid, target: targetJid, groupJid, startTime, messageCount, status } }
            completedReports: []   // Array of completed report info: [{ id, owner, target, groupJid, messageCount, created, completed }]
        });
        console.log('Evidence collection system initialized');
    }
}

/**
 * Start tracking a user for evidence collection
 * 
 * @param {string} targetJid - JID of user to track (collect evidence from)
 * @param {string} collectorJid - JID of user requesting the tracking
 * @param {string} groupJid - Optional group JID context
 * @returns {Object} Status object with success flag and message
 */
function startTracking(targetJid, collectorJid, groupJid = null) {
    try {
        const settings = database.getData(EVIDENCE_DB_KEY);
        
        // Normalize JIDs
        targetJid = normalizeJid(targetJid);
        collectorJid = normalizeJid(collectorJid);
        if (groupJid) groupJid = normalizeJid(groupJid);
        
        // Create tracking entry if it doesn't exist
        if (!settings.trackedUsers[targetJid]) {
            settings.trackedUsers[targetJid] = {
                trackedBy: [collectorJid],
                since: Date.now(),
                groups: groupJid ? [groupJid] : []
            };
        } else {
            // Add collector if not already tracking
            if (!settings.trackedUsers[targetJid].trackedBy.includes(collectorJid)) {
                settings.trackedUsers[targetJid].trackedBy.push(collectorJid);
            }
            
            // Add group context if provided and not already tracked
            if (groupJid && !settings.trackedUsers[targetJid].groups.includes(groupJid)) {
                settings.trackedUsers[targetJid].groups.push(groupJid);
            }
        }
        
        // Create a new report session
        const sessionId = uuidv4();
        settings.reportSessions[sessionId] = {
            owner: collectorJid,
            target: targetJid,
            groupJid: groupJid || null,
            startTime: Date.now(),
            messageCount: 0,
            status: 'active'
        };
        
        database.saveData(EVIDENCE_DB_KEY, settings);
        
        return {
            success: true,
            message: `Started tracking user ${targetJid} for evidence collection. Session ID: ${sessionId}`,
            sessionId
        };
    } catch (error) {
        console.error('Error starting evidence tracking:', error);
        return {
            success: false,
            message: `Failed to start tracking: ${error.message}`
        };
    }
}

/**
 * Stop tracking a user for evidence collection
 * 
 * @param {string} targetJid - JID of tracked user to stop tracking
 * @param {string} collectorJid - JID of user who requested the tracking
 * @param {string} sessionId - Optional specific session ID to stop
 * @returns {Object} Status object with success flag and message
 */
function stopTracking(targetJid, collectorJid, sessionId = null) {
    try {
        const settings = database.getData(EVIDENCE_DB_KEY);
        
        // Normalize JIDs
        targetJid = normalizeJid(targetJid);
        collectorJid = normalizeJid(collectorJid);
        
        let message = '';
        
        if (sessionId) {
            // Stop specific session
            if (settings.reportSessions[sessionId]) {
                const session = settings.reportSessions[sessionId];
                
                // Only the owner can stop their session
                if (session.owner === collectorJid) {
                    // Move to completed reports
                    settings.completedReports.push({
                        id: sessionId,
                        owner: session.owner,
                        target: session.target,
                        groupJid: session.groupJid,
                        messageCount: session.messageCount,
                        created: session.startTime,
                        completed: Date.now()
                    });
                    
                    // Remove from active sessions
                    delete settings.reportSessions[sessionId];
                    message = `Stopped tracking session ${sessionId} with ${session.messageCount} messages collected.`;
                } else {
                    return {
                        success: false,
                        message: 'You can only stop tracking sessions you started.'
                    };
                }
            } else {
                return {
                    success: false,
                    message: `Session ${sessionId} not found.`
                };
            }
        } else {
            // Stop all sessions for this user by this collector
            let stoppedCount = 0;
            
            Object.keys(settings.reportSessions).forEach(id => {
                const session = settings.reportSessions[id];
                if (session.target === targetJid && session.owner === collectorJid) {
                    // Move to completed reports
                    settings.completedReports.push({
                        id,
                        owner: session.owner,
                        target: session.target,
                        groupJid: session.groupJid,
                        messageCount: session.messageCount,
                        created: session.startTime,
                        completed: Date.now()
                    });
                    
                    // Remove from active sessions
                    delete settings.reportSessions[id];
                    stoppedCount++;
                }
            });
            
            // Also remove from general tracking if no more sessions
            if (settings.trackedUsers[targetJid]) {
                settings.trackedUsers[targetJid].trackedBy = 
                    settings.trackedUsers[targetJid].trackedBy.filter(jid => jid !== collectorJid);
                
                // Remove entirely if no one is tracking anymore
                if (settings.trackedUsers[targetJid].trackedBy.length === 0) {
                    delete settings.trackedUsers[targetJid];
                }
            }
            
            message = `Stopped ${stoppedCount} tracking sessions for user ${targetJid}.`;
        }
        
        database.saveData(EVIDENCE_DB_KEY, settings);
        
        return {
            success: true,
            message
        };
    } catch (error) {
        console.error('Error stopping evidence tracking:', error);
        return {
            success: false,
            message: `Failed to stop tracking: ${error.message}`
        };
    }
}

/**
 * Record a message as evidence
 * 
 * @param {Object} message - Full message object from WhatsApp
 * @param {string} groupJid - Optional group JID where message was sent
 * @returns {boolean} Whether the message was recorded as evidence
 */
function recordMessage(message, groupJid = null) {
    try {
        // Extract sender JID
        const senderJid = normalizeJid(message.key.participant || message.key.remoteJid);
        
        // Normalize group JID if present
        if (groupJid) groupJid = normalizeJid(groupJid);
        
        const settings = database.getData(EVIDENCE_DB_KEY);
        
        // Check if this user is being tracked
        if (!settings.trackedUsers[senderJid]) {
            return false; // Not tracking this user
        }
        
        // Check if we're tracking in this group (if group context provided)
        if (groupJid && settings.trackedUsers[senderJid].groups.length > 0 && 
            !settings.trackedUsers[senderJid].groups.includes(groupJid)) {
            return false; // Not tracking in this group
        }
        
        // Find active sessions for this user
        const activeSessions = Object.keys(settings.reportSessions)
            .filter(id => {
                const session = settings.reportSessions[id];
                return session.target === senderJid && 
                       session.status === 'active' &&
                       (!groupJid || !session.groupJid || session.groupJid === groupJid);
            });
        
        if (activeSessions.length === 0) {
            return false; // No active sessions for this user
        }
        
        // Prepare evidence record with metadata
        const evidence = {
            timestamp: Date.now(),
            messageId: message.key.id,
            sender: senderJid,
            group: groupJid,
            messageData: message
        };
        
        // Save evidence to files for each session
        activeSessions.forEach(sessionId => {
            const session = settings.reportSessions[sessionId];
            const evidenceDir = path.join(EVIDENCE_DIR, sessionId);
            
            // Create session directory if it doesn't exist
            if (!fs.existsSync(evidenceDir)) {
                fs.mkdirSync(evidenceDir, { recursive: true });
            }
            
            // Save evidence to file
            const evidenceFile = path.join(evidenceDir, `msg_${Date.now()}_${uuidv4().slice(0, 8)}.json`);
            fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
            
            // Update message count
            session.messageCount++;
        });
        
        // Update database
        database.saveData(EVIDENCE_DB_KEY, settings);
        
        return true;
    } catch (error) {
        console.error('Error recording evidence message:', error);
        return false;
    }
}

/**
 * Generate a report from collected evidence
 * 
 * @param {string} sessionId - ID of the evidence collection session
 * @param {string} requesterJid - JID of user requesting the report
 * @returns {Object} Report object with metadata and evidence summary
 */
function generateReport(sessionId, requesterJid) {
    try {
        const settings = database.getData(EVIDENCE_DB_KEY);
        requesterJid = normalizeJid(requesterJid);
        
        // Check if session exists
        const session = settings.reportSessions[sessionId] || 
                       settings.completedReports.find(r => r.id === sessionId);
        
        if (!session) {
            return {
                success: false,
                message: `Session ${sessionId} not found.`
            };
        }
        
        // Verify the requester is the session owner
        if (session.owner !== requesterJid) {
            return {
                success: false,
                message: 'You can only generate reports for sessions you started.'
            };
        }
        
        // Check if evidence directory exists
        const evidenceDir = path.join(EVIDENCE_DIR, sessionId);
        if (!fs.existsSync(evidenceDir)) {
            return {
                success: false,
                message: 'No evidence found for this session.'
            };
        }
        
        // List all evidence files
        const evidenceFiles = fs.readdirSync(evidenceDir)
            .filter(file => file.endsWith('.json'))
            .map(file => path.join(evidenceDir, file));
        
        if (evidenceFiles.length === 0) {
            return {
                success: false,
                message: 'No evidence found for this session.'
            };
        }
        
        // Process evidence
        const evidence = evidenceFiles.map(file => JSON.parse(fs.readFileSync(file, 'utf8')))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        // Generate report summary
        const report = {
            success: true,
            sessionId,
            target: session.target,
            targetUserName: 'Unknown',  // We would get username if available
            groupJid: session.groupJid,
            startDate: new Date(session.startTime || session.created).toISOString(),
            endDate: session.completed ? new Date(session.completed).toISOString() : new Date().toISOString(),
            messageCount: evidence.length,
            messagesByType: {},
            evidencePath: evidenceDir,
            evidenceSummary: evidence.map(e => {
                // Extract message type and content
                let messageType = 'unknown';
                let messageContent = '';
                
                if (e.messageData.message) {
                    // Determine message type
                    if (e.messageData.message.conversation) {
                        messageType = 'text';
                        messageContent = e.messageData.message.conversation;
                    } else if (e.messageData.message.imageMessage) {
                        messageType = 'image';
                        messageContent = e.messageData.message.imageMessage.caption || '[Image without caption]';
                    } else if (e.messageData.message.videoMessage) {
                        messageType = 'video';
                        messageContent = e.messageData.message.videoMessage.caption || '[Video without caption]';
                    } else if (e.messageData.message.audioMessage) {
                        messageType = 'audio';
                        messageContent = '[Audio message]';
                    } else if (e.messageData.message.stickerMessage) {
                        messageType = 'sticker';
                        messageContent = '[Sticker]';
                    } else if (e.messageData.message.documentMessage) {
                        messageType = 'document';
                        messageContent = e.messageData.message.documentMessage.fileName || '[Document]';
                    } else {
                        const keys = Object.keys(e.messageData.message);
                        if (keys.length > 0) {
                            messageType = keys[0].replace('Message', '');
                        }
                    }
                }
                
                // Update message type counts
                report.messagesByType[messageType] = (report.messagesByType[messageType] || 0) + 1;
                
                return {
                    timestamp: new Date(e.timestamp).toISOString(),
                    messageId: e.messageId,
                    type: messageType,
                    content: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : '')
                };
            })
        };
        
        return report;
    } catch (error) {
        console.error('Error generating evidence report:', error);
        return {
            success: false,
            message: `Failed to generate report: ${error.message}`
        };
    }
}

/**
 * Get a list of active tracking sessions for a user
 * 
 * @param {string} userJid - JID of user to get sessions for
 * @returns {Array} Array of session objects
 */
function getActiveSessions(userJid) {
    try {
        const settings = database.getData(EVIDENCE_DB_KEY);
        userJid = normalizeJid(userJid);
        
        // Find all active sessions owned by this user
        const sessions = Object.keys(settings.reportSessions)
            .filter(id => settings.reportSessions[id].owner === userJid)
            .map(id => ({
                sessionId: id,
                target: settings.reportSessions[id].target,
                groupJid: settings.reportSessions[id].groupJid,
                startTime: settings.reportSessions[id].startTime,
                messageCount: settings.reportSessions[id].messageCount,
                status: settings.reportSessions[id].status
            }));
        
        return sessions;
    } catch (error) {
        console.error('Error getting active evidence sessions:', error);
        return [];
    }
}

/**
 * Get list of completed reports for a user
 * 
 * @param {string} userJid - JID of user to get reports for
 * @returns {Array} Array of completed report metadata
 */
function getCompletedReports(userJid) {
    try {
        const settings = database.getData(EVIDENCE_DB_KEY);
        userJid = normalizeJid(userJid);
        
        // Find completed reports owned by this user
        return settings.completedReports
            .filter(report => report.owner === userJid)
            .sort((a, b) => b.completed - a.completed);
    } catch (error) {
        console.error('Error getting completed evidence reports:', error);
        return [];
    }
}

/**
 * Export evidence from a session to a single HTML file
 * 
 * @param {string} sessionId - ID of the session to export
 * @param {string} requesterJid - JID of user requesting the export
 * @returns {Object} Status object with success flag and file path
 */
function exportEvidence(sessionId, requesterJid) {
    try {
        // Generate the report first
        const report = generateReport(sessionId, requesterJid);
        
        if (!report.success) {
            return report;
        }
        
        // Create an HTML file with all the evidence
        const exportPath = path.join(EVIDENCE_DIR, `report_${sessionId}_${Date.now()}.html`);
        
        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Evidence Report: ${sessionId}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .report-header { background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .evidence-item { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
                .timestamp { color: #888; font-size: 0.8em; }
                .message-content { margin-top: 5px; }
                .text-message { background-color: #f9f9f9; }
                .image-message { background-color: #f0f7ff; }
                .video-message { background-color: #fff0f0; }
                .audio-message { background-color: #f0fff0; }
                .sticker-message { background-color: #fff8f0; }
                .document-message { background-color: #f0f0ff; }
                .unknown-message { background-color: #f5f5f5; }
                .stats { margin: 20px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>Evidence Report</h1>
                <p><strong>Target:</strong> ${report.target}</p>
                <p><strong>Session ID:</strong> ${report.sessionId}</p>
                <p><strong>Period:</strong> ${report.startDate} to ${report.endDate}</p>
                ${report.groupJid ? `<p><strong>Group:</strong> ${report.groupJid}</p>` : ''}
                <p><strong>Total Messages:</strong> ${report.messageCount}</p>
            </div>
            
            <div class="stats">
                <h2>Message Statistics</h2>
                <ul>
                    ${Object.entries(report.messagesByType).map(([type, count]) => 
                        `<li>${type}: ${count} messages (${Math.round(count * 100 / report.messageCount)}%)</li>`).join('')}
                </ul>
            </div>
            
            <h2>Evidence Timeline</h2>
            
            ${report.evidenceSummary.map(item => `
                <div class="evidence-item ${item.type}-message">
                    <div class="timestamp">${item.timestamp}</div>
                    <div class="message-type">Type: ${item.type}</div>
                    <div class="message-content">${escapeHtml(item.content)}</div>
                </div>
            `).join('')}
        </body>
        </html>
        `;
        
        fs.writeFileSync(exportPath, htmlContent);
        
        return {
            success: true,
            message: 'Evidence report exported successfully',
            path: exportPath
        };
    } catch (error) {
        console.error('Error exporting evidence report:', error);
        return {
            success: false,
            message: `Failed to export report: ${error.message}`
        };
    }
}

/**
 * Helper function to escape HTML
 * 
 * @param {string} unsafe - Unsafe HTML string
 * @returns {string} Escaped safe HTML
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Normalize a JID to a consistent format
 * 
 * @param {string} jid - JID to normalize
 * @returns {string} Normalized JID
 */
function normalizeJid(jid) {
    if (!jid) return '';
    
    // Remove any device part (after the colon)
    let normalizedJid = jid.split(':')[0];
    
    // Make sure it ends with @s.whatsapp.net for users
    if (!normalizedJid.includes('@')) {
        normalizedJid += '@s.whatsapp.net';
    }
    
    return normalizedJid;
}

// Initialize on module load
init();

module.exports = {
    init,
    startTracking,
    stopTracking,
    recordMessage,
    generateReport,
    getActiveSessions,
    getCompletedReports,
    exportEvidence
};