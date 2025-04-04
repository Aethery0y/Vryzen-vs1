/**
 * Group Relationship Analysis Commands
 * Provides commands to analyze group interactions and relationships
 */
const groupRelationship = require('../lib/groupRelationship');
const database = require('../lib/database');

/**
 * Show group relationship analysis
 */
async function showGroupAnalysis(sock, remoteJid) {
    try {
        if (!remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(remoteJid, { 
                text: '⚠️ This command can only be used in groups.'
            });
            return;
        }
        
        // Send status message
        await sock.sendMessage(remoteJid, { 
            text: '⏳ Analyzing group interaction patterns...'
        });
        
        // Perform analysis
        const analysis = groupRelationship.analyzeGroup(remoteJid);
        
        if (analysis.error) {
            // Not enough data for analysis
            let message = `📊 *Group Relationship Analysis*\n\n`;
            
            if (analysis.needsData) {
                message += `${analysis.error}\n\n`;
                message += `To enable real analysis, more interaction data is needed.\n`;
                message += `• Current members tracked: ${analysis.members || 0}\n`;
                message += `• Current interactions: ${analysis.interactions || 0}\n\n`;
                message += `The bot will automatically record interactions as group members chat. Try again later when more data has been collected.`;
            } else {
                message += `Error: ${analysis.error}`;
            }
            
            await sock.sendMessage(remoteJid, { text: message });
            return;
        }
        
        // Format the analysis results
        let message = `📊 *Group Relationship Analysis*\n\n`;
        
        // Most connected members
        message += `*Most connected members:*\n`;
        if (analysis.mostConnected && analysis.mostConnected.length > 0) {
            analysis.mostConnected.forEach((member, index) => {
                message += `${index + 1}. +${member}\n`;
            });
        } else {
            message += `No data available\n`;
        }
        
        message += `\n*Interaction clusters detected:* ${analysis.clusters}\n\n`;
        
        // Key influencers
        message += `*Key influencers:*\n`;
        if (analysis.keyInfluencers && analysis.keyInfluencers.length > 0) {
            analysis.keyInfluencers.forEach((influencer, index) => {
                message += `${index + 1}. +${influencer.member} (influence ratio: ${influencer.ratio})\n`;
            });
        } else {
            message += `No data available\n`;
        }
        
        message += `\n*Total members analyzed:* ${analysis.totalMembers}\n`;
        message += `*Total interactions:* ${analysis.totalInteractions}\n`;
        message += `*Last updated:* ${new Date(analysis.lastUpdated).toLocaleString()}\n`;
        
        await sock.sendMessage(remoteJid, { text: message });
    } catch (error) {
        console.error('Error showing group analysis:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error analyzing group: ${error.message}`
        });
    }
}

/**
 * Clear group analysis data
 */
async function clearGroupAnalysis(sock, remoteJid, sender) {
    try {
        // Check if user is admin or owner
        const config = require('../config');
        const senderNumber = sender.split('@')[0];
        const normalizedNumber = database.normalizeNumber(senderNumber);
        
        // Check if owner
        const isUserOwner = config.botOwners.some(owner => 
            database.normalizeNumber(owner) === normalizedNumber
        );
        
        // Check if admin
        const isUserAdmin = config.botAdmins.some(admin => 
            database.normalizeNumber(admin) === normalizedNumber
        ) || isUserOwner;
        
        if (!isUserAdmin) {
            await sock.sendMessage(remoteJid, { 
                text: '⛔ Only bot administrators can clear group analysis data.'
            });
            return;
        }
        
        if (!remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(remoteJid, { 
                text: '⚠️ This command can only be used in groups.'
            });
            return;
        }
        
        // Send status message
        await sock.sendMessage(remoteJid, { 
            text: '⏳ Clearing group interaction data...'
        });
        
        // Clear data
        groupRelationship.clearGroupData(remoteJid);
        
        await sock.sendMessage(remoteJid, { 
            text: '✅ Group relationship analysis data has been cleared.'
        });
    } catch (error) {
        console.error('Error clearing group analysis:', error);
        
        await sock.sendMessage(remoteJid, { 
            text: `❌ Error clearing group analysis: ${error.message}`
        });
    }
}

module.exports = {
    showGroupAnalysis,
    clearGroupAnalysis
};