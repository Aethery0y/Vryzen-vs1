/**
 * User engagement analytics module for WhatsApp bot
 */
const database = require('./database');
const contacts = require('./contacts');

// Constants
const ACTIVITY_RETENTION_DAYS = 30; // Store activity data for 30 days

/**
 * Record user message activity
 * 
 * @param {Object} messageInfo - Message information 
 * @param {string} messageInfo.sender - Sender ID (JID)
 * @param {string} messageInfo.group - Group ID (JID) if applicable
 * @param {string} messageInfo.msgType - Message type 
 * @param {number} messageInfo.timestamp - Message timestamp
 * @param {boolean} messageInfo.isCommand - Whether message is a command
 * @param {string} messageInfo.command - Command name if applicable
 * @returns {boolean} Success status
 */
function recordActivity(messageInfo) {
    try {
        const { sender, group, msgType, timestamp, isCommand, command } = messageInfo;
        
        // Extract raw phone number from JID
        let phoneNumber = sender.split('@')[0];
        if (phoneNumber.includes(':')) {
            phoneNumber = phoneNumber.split(':')[0];
        }
        
        // Normalize message data
        const activityData = {
            timestamp: timestamp || Date.now(),
            sender: phoneNumber,
            group: group || null,
            messageType: msgType || 'text',
            isCommand: isCommand || false,
            command: command || null
        };
        
        // Get existing activity log
        let activityLog = database.getData('activityLog') || [];
        
        // Add new activity
        activityLog.push(activityData);
        
        // Prune old activity data
        const cutoffTime = Date.now() - (ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        activityLog = activityLog.filter(activity => activity.timestamp > cutoffTime);
        
        // Save back to database
        database.saveData('activityLog', activityLog);
        
        // Update contact engagement score
        contacts.trackEngagement(phoneNumber);
        
        return true;
    } catch (error) {
        console.error('Error recording activity:', error);
        return false;
    }
}

/**
 * Get aggregated analytics for a time period
 * 
 * @param {Object} options - Analysis options
 * @param {string} options.period - Time period ('day', 'week', 'month')
 * @param {string} options.group - Optional group JID to filter by
 * @returns {Object} Aggregated analytics
 */
function getAnalytics(options = {}) {
    try {
        const { period = 'day', group = null } = options;
        
        // Calculate cutoff time based on period
        let cutoffTime;
        const now = Date.now();
        
        switch (period.toLowerCase()) {
            case 'week':
                cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
                break;
            case 'day':
            default:
                cutoffTime = now - (24 * 60 * 60 * 1000);
                break;
        }
        
        // Get activity log
        const activityLog = database.getData('activityLog') || [];
        
        // Filter by time period and group if needed
        const filteredActivity = activityLog.filter(activity => {
            let matchesFilter = activity.timestamp > cutoffTime;
            
            if (matchesFilter && group) {
                matchesFilter = activity.group === group;
            }
            
            return matchesFilter;
        });
        
        // Count metrics
        const metrics = {
            totalMessages: filteredActivity.length,
            uniqueUsers: new Set(),
            messageTypes: {},
            commandUsage: {},
            mostActiveHours: Array(24).fill(0),
            userEngagement: {}
        };
        
        // Process each activity
        filteredActivity.forEach(activity => {
            // Unique users
            metrics.uniqueUsers.add(activity.sender);
            
            // Message types
            const msgType = activity.messageType || 'text';
            metrics.messageTypes[msgType] = (metrics.messageTypes[msgType] || 0) + 1;
            
            // Command usage
            if (activity.isCommand && activity.command) {
                metrics.commandUsage[activity.command] = (metrics.commandUsage[activity.command] || 0) + 1;
            }
            
            // Active hours
            const hour = new Date(activity.timestamp).getHours();
            metrics.mostActiveHours[hour]++;
            
            // User engagement
            if (!metrics.userEngagement[activity.sender]) {
                metrics.userEngagement[activity.sender] = 0;
            }
            metrics.userEngagement[activity.sender]++;
        });
        
        // Convert unique users Set to count
        metrics.uniqueUsers = metrics.uniqueUsers.size;
        
        // Find most active users
        const sortedUsers = Object.entries(metrics.userEngagement)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([user, count]) => ({ user, count }));
            
        metrics.mostActiveUsers = sortedUsers;
        delete metrics.userEngagement; // Remove raw data
        
        // Find most active hours
        const topHours = metrics.mostActiveHours
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
            
        metrics.topActiveHours = topHours;
        delete metrics.mostActiveHours; // Remove raw data
        
        return {
            success: true,
            period,
            group,
            metrics
        };
    } catch (error) {
        console.error('Error generating analytics:', error);
        return {
            success: false,
            message: "Failed to generate analytics."
        };
    }
}

/**
 * Get detailed activity for a specific user
 * 
 * @param {string} phoneNumber - User's phone number
 * @param {Object} options - Analysis options
 * @param {string} options.period - Time period ('day', 'week', 'month')
 * @returns {Object} User activity details
 */
function getUserActivity(phoneNumber, options = {}) {
    try {
        const { period = 'week' } = options;
        
        // Normalize phone number
        const normalizedNumber = database.normalizeNumber(phoneNumber);
        
        // Calculate cutoff time based on period
        let cutoffTime;
        const now = Date.now();
        
        switch (period.toLowerCase()) {
            case 'month':
                cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
                break;
            case 'week':
                cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'day':
            default:
                cutoffTime = now - (24 * 60 * 60 * 1000);
                break;
        }
        
        // Get activity log and filter for this user
        const activityLog = database.getData('activityLog') || [];
        const userActivity = activityLog.filter(activity => {
            return activity.sender === normalizedNumber && activity.timestamp > cutoffTime;
        });
        
        // Get contact data
        const contact = contacts.getContactInfo(normalizedNumber);
        
        if (userActivity.length === 0 && !contact) {
            return {
                success: false,
                message: "No activity found for this user."
            };
        }
        
        // Calculate metrics
        const metrics = {
            totalMessages: userActivity.length,
            messageTypes: {},
            commandUsage: {},
            activeGroups: new Set(),
            activityByDay: {}
        };
        
        // Process each activity
        userActivity.forEach(activity => {
            // Message types
            const msgType = activity.messageType || 'text';
            metrics.messageTypes[msgType] = (metrics.messageTypes[msgType] || 0) + 1;
            
            // Command usage
            if (activity.isCommand && activity.command) {
                metrics.commandUsage[activity.command] = (metrics.commandUsage[activity.command] || 0) + 1;
            }
            
            // Active groups
            if (activity.group) {
                metrics.activeGroups.add(activity.group);
            }
            
            // Activity by day
            const date = new Date(activity.timestamp).toISOString().split('T')[0];
            if (!metrics.activityByDay[date]) {
                metrics.activityByDay[date] = 0;
            }
            metrics.activityByDay[date]++;
        });
        
        // Convert Sets to counts
        metrics.activeGroups = metrics.activeGroups.size;
        
        // Format activity by day as array
        metrics.dailyActivity = Object.entries(metrics.activityByDay)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
        
        delete metrics.activityByDay; // Remove raw data
        
        return {
            success: true,
            user: normalizedNumber,
            contact: contact || { 
                number: normalizedNumber, 
                labels: [], 
                engagement: 0 
            },
            period,
            metrics
        };
    } catch (error) {
        console.error('Error generating user activity:', error);
        return {
            success: false,
            message: "Failed to retrieve user activity."
        };
    }
}

/**
 * Generate engagement report for a group
 * 
 * @param {string} groupJid - Group JID
 * @param {Object} options - Analysis options
 * @param {string} options.period - Time period ('day', 'week', 'month')
 * @returns {Object} Group engagement report
 */
function getGroupEngagement(groupJid, options = {}) {
    try {
        const { period = 'week' } = options;
        
        if (!groupJid) {
            return {
                success: false,
                message: "Group ID is required."
            };
        }
        
        // Get analytics for this group
        const analytics = getAnalytics({ 
            period, 
            group: groupJid 
        });
        
        if (!analytics.success) {
            return analytics;
        }
        
        // Format for presentation
        const report = {
            success: true,
            group: groupJid,
            period,
            totalMessages: analytics.metrics.totalMessages,
            activeUsers: analytics.metrics.uniqueUsers,
            messageTypes: analytics.metrics.messageTypes,
            mostActiveUsers: analytics.metrics.mostActiveUsers,
            topCommands: Object.entries(analytics.metrics.commandUsage || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([command, count]) => ({ command, count })),
            peakHours: analytics.metrics.topActiveHours
        };
        
        return report;
    } catch (error) {
        console.error('Error generating group engagement report:', error);
        return {
            success: false,
            message: "Failed to generate group engagement report."
        };
    }
}

/**
 * Get command usage statistics
 * 
 * @param {Object} options - Analysis options
 * @param {string} options.period - Time period ('day', 'week', 'month')
 * @returns {Object} Command usage statistics
 */
function getCommandStats(options = {}) {
    try {
        const { period = 'week' } = options;
        
        // Get overall analytics
        const analytics = getAnalytics({ period });
        
        if (!analytics.success) {
            return analytics;
        }
        
        // Return focused command stats
        return {
            success: true,
            period,
            totalCommands: Object.values(analytics.metrics.commandUsage || {})
                .reduce((sum, count) => sum + count, 0),
            commandUsage: Object.entries(analytics.metrics.commandUsage || {})
                .sort((a, b) => b[1] - a[1])
                .map(([command, count]) => ({ 
                    command, 
                    count,
                    percentage: Math.round((count / analytics.metrics.totalMessages) * 100)
                }))
        };
    } catch (error) {
        console.error('Error generating command stats:', error);
        return {
            success: false,
            message: "Failed to generate command statistics."
        };
    }
}

module.exports = {
    recordActivity,
    getAnalytics,
    getUserActivity,
    getGroupEngagement,
    getCommandStats
};