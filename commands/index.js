const generalCommands = require('./general');
const groupCommands = require('./groups');
const contactCommands = require('./contacts');
const database = require('../lib/database');
const animeNews = require('../lib/animeNews');
const stickerMaker = require('../lib/stickerMaker');

// Command handler
async function handleCommand(params) {
    const { sock, message, messageContent, sender, remoteJid, isGroup, quotedMsg } = params;
    
    // Extract command and arguments
    const parts = messageContent.trim().split(' ');
    const command = parts[0].slice(1).toLowerCase(); // Remove the '.' prefix
    const args = parts.slice(1);
    
    // Normalize sender for permission checking
    const normalizedSender = database.normalizeNumber(sender);
    
    // Check if user is banned
    const userWarnings = database.getWarnings(normalizedSender);
    if (userWarnings.banned) {
        await sock.sendMessage(remoteJid, { 
            text: '⛔ You are banned from using this bot due to multiple violations of our profanity policy.' 
        });
        return;
    }
    
    // Check if bot is in private mode and user is not allowed
    const settings = database.getBotSettings();
    if (!settings.isPublic) {
        const isAllowed = settings.allowedUsers.some(allowedUser => 
            database.normalizeNumber(allowedUser) === normalizedSender);
        
        // Admin commands that bypass private mode check
        const adminBypassCommands = ['public', 'private', 'allow'];
        
        // If user is not allowed and command is not an admin bypass command
        if (!isAllowed && !adminBypassCommands.includes(command)) {
            await sock.sendMessage(remoteJid, { 
                text: '⚠️ Bot is currently in private mode. Only allowed users can use commands.' 
            });
            return;
        }
    }
    
    // Handle different commands
    try {
        switch (command) {
            // General commands
            case 'cmds':
            case 'help':
                await generalCommands.showCommands(sock, remoteJid);
                break;
                
            case 'clear':
                await generalCommands.clearConversation(sock, remoteJid, normalizedSender);
                break;
                
            case 'profile':
                await generalCommands.showProfile(sock, remoteJid, normalizedSender);
                break;
                
            case 'sticker':
                await stickerMaker.createStickerFromMedia(sock, message, quotedMsg);
                break;
                
            case 'animenews':
                await animeNews.sendAnimeNewsToChat(sock, remoteJid);
                break;
                
            // Privacy settings
            case 'private':
                if (isOwner(normalizedSender)) {
                    await generalCommands.setPrivateMode(sock, remoteJid);
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⛔ Only bot owners can use this command.'
                    });
                }
                break;
                
            case 'public':
                if (isOwner(normalizedSender)) {
                    await generalCommands.setPublicMode(sock, remoteJid);
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⛔ Only bot owners can use this command.'
                    });
                }
                break;
                
            case 'allow':
                if (isOwner(normalizedSender)) {
                    if (args.length < 1) {
                        await sock.sendMessage(remoteJid, { 
                            text: '⚠️ Usage: .allow "number"'
                        });
                    } else {
                        await generalCommands.allowUser(sock, remoteJid, args[0]);
                    }
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⛔ Only bot owners can use this command.'
                    });
                }
                break;
                
            // Group commands
            case 'save':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                if (args[0] === 'all') {
                    await groupCommands.saveAllMembers(sock, remoteJid);
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .save all'
                    });
                }
                break;
                
            case 'add':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                if (args[0] === 'all') {
                    await groupCommands.addAllToGroup(sock, remoteJid);
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .add all'
                    });
                }
                break;
                
            case 'tag':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                if (args[0] === 'all') {
                    const tagMessage = args.slice(1).join(' ');
                    await groupCommands.tagAll(sock, remoteJid, tagMessage);
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .tag all "message"'
                    });
                }
                break;
                
            // Contact commands
            case 'label':
                await handleLabelCommand(sock, remoteJid, args);
                break;
                
            case 'contact':
                await handleContactCommand(sock, remoteJid, args);
                break;
                
            case 'find':
                await contactCommands.findContacts(sock, remoteJid, args);
                break;
                
            case 'stats':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .stats "number"'
                    });
                } else {
                    await contactCommands.showStats(sock, remoteJid, args[0]);
                }
                break;
                
            default:
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ Unknown command: ${command}\nUse .cmds to see available commands.`
                });
        }
    } catch (error) {
        console.error(`Error handling command ${command}:`, error);
        await sock.sendMessage(remoteJid, { 
            text: `⚠️ Error executing command: ${error.message}`
        });
    }
}

/**
 * Handle label commands (.label add/remove/list)
 */
async function handleLabelCommand(sock, remoteJid, args) {
    const subCommand = args[0]?.toLowerCase();
    
    switch (subCommand) {
        case 'add':
            if (args.length < 3) {
                await sock.sendMessage(remoteJid, { 
                    text: '⚠️ Usage: .label add "number" "label"'
                });
            } else {
                await contactCommands.addLabel(sock, remoteJid, args[1], args[2]);
            }
            break;
            
        case 'remove':
            if (args.length < 3) {
                await sock.sendMessage(remoteJid, { 
                    text: '⚠️ Usage: .label remove "number" "label"'
                });
            } else {
                await contactCommands.removeLabel(sock, remoteJid, args[1], args[2]);
            }
            break;
            
        case 'list':
            if (args.length < 2) {
                await sock.sendMessage(remoteJid, { 
                    text: '⚠️ Usage: .label list "number"'
                });
            } else {
                await contactCommands.listLabels(sock, remoteJid, args[1]);
            }
            break;
            
        default:
            await sock.sendMessage(remoteJid, { 
                text: '⚠️ Usage: .label add/remove/list "number" "label"'
            });
    }
}

/**
 * Handle contact commands (.contact set/get)
 */
async function handleContactCommand(sock, remoteJid, args) {
    const subCommand = args[0]?.toLowerCase();
    
    switch (subCommand) {
        case 'set':
            if (args.length < 3) {
                await sock.sendMessage(remoteJid, { 
                    text: '⚠️ Usage: .contact set "number" field="value"'
                });
            } else {
                const number = args[1];
                const fieldValuePairs = args.slice(2);
                await contactCommands.setContactInfo(sock, remoteJid, number, fieldValuePairs);
            }
            break;
            
        case 'get':
            if (args.length < 2) {
                await sock.sendMessage(remoteJid, { 
                    text: '⚠️ Usage: .contact get "number"'
                });
            } else {
                await contactCommands.getContactInfo(sock, remoteJid, args[1]);
            }
            break;
            
        default:
            await sock.sendMessage(remoteJid, { 
                text: '⚠️ Usage: .contact set/get "number" [field="value"]'
            });
    }
}

/**
 * Check if user is a bot owner
 */
function isOwner(number) {
    const normalizedNumber = database.normalizeNumber(number);
    const config = require('../config');
    return config.botOwners.some(owner => database.normalizeNumber(owner) === normalizedNumber);
}

module.exports = {
    handleCommand
};
