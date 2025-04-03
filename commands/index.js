const generalCommands = require('./general');
const groupCommands = require('./groups');
const contactCommands = require('./contacts');
const advancedMessaging = require('./advancedMessaging');
const groupInfluence = require('./groupInfluence');
const analytics = require('./analytics');
const autoReplyCommands = require('./autoReply');
const groupRelationship = require('./groupRelationship');
const database = require('../lib/database');
const animeNews = require('../lib/animeNews');
const stickerMaker = require('../lib/stickerMaker');
const analyticsLib = require('../lib/analytics');

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
        // Check if user is owner first - owners can always use any command
        const isUserOwner = isOwner(normalizedSender);
        
        // If not owner, check if they're in the allowed list
        const isAllowed = isUserOwner || settings.allowedUsers.some(allowedUser => 
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
                
            case 'admincmds':
                await generalCommands.showAdminCommands(sock, remoteJid, sender);
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
                
            // Advanced Messaging Commands
            case 'schedule':
                if (args.length < 2) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .schedule "time" "message"\nTime format: YYYY-MM-DD HH:MM or +1h30m'
                    });
                } else {
                    const scheduleTime = args[0];
                    const scheduleMessage = args.slice(1).join(' ');
                    const result = await advancedMessaging.scheduleMessage(sock, remoteJid, sender, scheduleTime, scheduleMessage);
                    await sock.sendMessage(remoteJid, { text: result.message });
                }
                break;
                
            case 'cancel':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .cancel "schedule_id"'
                    });
                } else {
                    const result = await advancedMessaging.cancelScheduledMessage(sock, remoteJid, sender, args[0]);
                    await sock.sendMessage(remoteJid, { text: result.message });
                }
                break;
                
            case 'scheduled':
                const scheduledResult = await advancedMessaging.listScheduledMessages(sock, remoteJid, sender);
                await sock.sendMessage(remoteJid, { text: scheduledResult.message });
                break;
                
            case 'poll':
                if (args.length < 2) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .poll "question" "option1, option2, option3, ..."'
                    });
                } else {
                    const question = args[0];
                    const options = args.slice(1).join(' ');
                    const pollResult = await advancedMessaging.createPoll(sock, remoteJid, question, options);
                    await sock.sendMessage(remoteJid, { text: pollResult.message });
                }
                break;
                
            case 'vote':
                if (args.length < 2) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .vote "poll_id" "option_number"'
                    });
                } else {
                    const voteResult = await advancedMessaging.voteInPoll(sock, remoteJid, sender, args[0], args[1]);
                    await sock.sendMessage(remoteJid, { text: voteResult.message });
                    
                    // Also show results if vote was successful
                    if (voteResult.success && voteResult.results) {
                        await sock.sendMessage(remoteJid, { text: voteResult.results });
                    }
                }
                break;
                
            case 'results':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .results "poll_id"'
                    });
                } else {
                    const resultData = await advancedMessaging.showPollResults(sock, remoteJid, args[0]);
                    await sock.sendMessage(remoteJid, { text: resultData.message });
                }
                break;
                
            case 'endpoll':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .endpoll "poll_id"'
                    });
                } else {
                    const endResult = await advancedMessaging.endPoll(sock, remoteJid, sender, args[0]);
                    await sock.sendMessage(remoteJid, { text: endResult.message });
                }
                break;
                
            case 'broadcast':
                if (args.length < 2) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .broadcast "message" "targets"\nTargets: label:name,groups,number:1234567890'
                    });
                } else {
                    const broadcastMessage = args[0];
                    const broadcastTargets = args.slice(1).join(' ');
                    const broadcastResult = await advancedMessaging.broadcastMessage(sock, remoteJid, sender, broadcastMessage, broadcastTargets);
                    await sock.sendMessage(remoteJid, { text: broadcastResult.message });
                }
                break;
                
            case 'autoreply':
                const autoReplySubCmd = args[0]?.toLowerCase();
                
                switch (autoReplySubCmd) {
                    case 'set':
                        if (args.length < 3) {
                            await sock.sendMessage(remoteJid, { 
                                text: '⚠️ Usage: .autoreply set "trigger" "response"'
                            });
                        } else {
                            const trigger = args[1];
                            const response = args.slice(2).join(' ');
                            const autoReplyResult = await advancedMessaging.setAutoReply(sock, remoteJid, sender, trigger, response);
                            await sock.sendMessage(remoteJid, { text: autoReplyResult.message });
                        }
                        break;
                        
                    case 'remove':
                        if (args.length < 2) {
                            await sock.sendMessage(remoteJid, { 
                                text: '⚠️ Usage: .autoreply remove "trigger"'
                            });
                        } else {
                            const removeTrigger = args[1];
                            const removeResult = await advancedMessaging.removeAutoReply(sock, remoteJid, sender, removeTrigger);
                            await sock.sendMessage(remoteJid, { text: removeResult.message });
                        }
                        break;
                        
                    case 'list':
                        const listResult = await advancedMessaging.listAutoReplies(sock, remoteJid);
                        await sock.sendMessage(remoteJid, { text: listResult.message });
                        break;
                        
                    default:
                        await sock.sendMessage(remoteJid, { 
                            text: '⚠️ Usage: .autoreply set/remove/list "trigger" "response"'
                        });
                }
                break;
                
            case 'summarize':
                if (!quotedMsg) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Reply to a message with .summarize to get a summary.'
                    });
                } else {
                    const textToSummarize = quotedMsg.conversation || 
                                          quotedMsg.extendedTextMessage?.text || 
                                          quotedMsg.imageMessage?.caption || 
                                          quotedMsg.videoMessage?.caption || '';
                                          
                    if (!textToSummarize) {
                        await sock.sendMessage(remoteJid, { 
                            text: '⚠️ Cannot summarize this type of message.'
                        });
                    } else {
                        const summaryResult = await advancedMessaging.summarizeText(sock, remoteJid, textToSummarize);
                        await sock.sendMessage(remoteJid, { text: summaryResult.message });
                    }
                }
                break;
                
            case 'translate':
                if (!quotedMsg || args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: Reply to a message with .translate "language"'
                    });
                } else {
                    const textToTranslate = quotedMsg.conversation || 
                                          quotedMsg.extendedTextMessage?.text || 
                                          quotedMsg.imageMessage?.caption || 
                                          quotedMsg.videoMessage?.caption || '';
                                          
                    if (!textToTranslate) {
                        await sock.sendMessage(remoteJid, { 
                            text: '⚠️ Cannot translate this type of message.'
                        });
                    } else {
                        const targetLang = args[0];
                        const translationResult = await advancedMessaging.translateMessage(sock, remoteJid, textToTranslate, targetLang);
                        await sock.sendMessage(remoteJid, { text: translationResult.message });
                    }
                }
                break;
                
            case 'flood':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .flood delay="2s" count="3" message="your message"'
                    });
                } else {
                    // Parse the arguments 
                    let floodDelay = 2; // default 2 seconds
                    let floodCount = 3; // default 3 messages
                    let floodMessage = '';

                    for (let i = 0; i < args.length; i++) {
                        if (args[i].startsWith('delay=')) {
                            floodDelay = parseFloat(args[i].substring(6).replace(/["']/g, ''));
                        } else if (args[i].startsWith('count=')) {
                            floodCount = parseInt(args[i].substring(6).replace(/["']/g, ''));
                        } else if (args[i].startsWith('message=')) {
                            floodMessage = args[i].substring(8).replace(/^["'](.*)["']$/, '$1');
                            // Also include any remaining args as part of the message
                            if (i < args.length - 1) {
                                floodMessage += ' ' + args.slice(i + 1).join(' ');
                            }
                            break;
                        }
                    }

                    if (!floodMessage) {
                        await sock.sendMessage(remoteJid, { 
                            text: '⚠️ Please provide a message to send.'
                        });
                    } else {
                        const floodResult = await advancedMessaging.floodMessages(
                            sock, remoteJid, sender, floodMessage, floodCount, floodDelay
                        );
                        
                        // Only send confirmation if not silent
                        if (!floodResult.silent && floodResult.message) {
                            await sock.sendMessage(remoteJid, { text: floodResult.message });
                        }
                    }
                }
                break;
                
            // Group Influence Commands
            case 'track':
                const trackResult = await groupInfluence.trackGroupChanges(sock, remoteJid, sender);
                await sock.sendMessage(remoteJid, { text: trackResult.message });
                break;
                
            case 'active':
                if (args.length > 0) {
                    const activityPeriod = args[0];
                    const activityResult = await groupInfluence.getActiveMembers(sock, remoteJid, sender, activityPeriod);
                    await sock.sendMessage(remoteJid, { text: activityResult.message });
                } else {
                    const activityResult = await groupInfluence.getActiveMembers(sock, remoteJid, sender);
                    await sock.sendMessage(remoteJid, { text: activityResult.message });
                }
                break;
                
            case 'detector':
                const detectorResult = await groupInfluence.setupDetector(sock, remoteJid, sender);
                await sock.sendMessage(remoteJid, { text: detectorResult.message });
                break;
                
            case 'warn':
                if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                    const mentionedUser = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    const reason = args.join(' ');
                    const warnResult = await groupInfluence.warnUser(sock, remoteJid, sender, mentionedUser, reason);
                    
                    // Only send confirmation if not silent
                    if (!warnResult.silent && warnResult.message) {
                        await sock.sendMessage(remoteJid, { text: warnResult.message });
                    }
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .warn @user "reason"'
                    });
                }
                break;
                
            case 'report':
                // Check if a specific user is mentioned
                if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                    const mentionedUser = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    const reportResult = await groupInfluence.generateReport(sock, remoteJid, sender, mentionedUser);
                    
                    // Only send confirmation if not silent
                    if (!reportResult.silent && reportResult.message) {
                        await sock.sendMessage(remoteJid, { text: reportResult.message });
                    }
                } else {
                    // Generate report for all warned users
                    const reportResult = await groupInfluence.generateReport(sock, remoteJid, sender);
                    
                    // Only send confirmation if not silent
                    if (!reportResult.silent && reportResult.message) {
                        await sock.sendMessage(remoteJid, { text: reportResult.message });
                    }
                }
                break;
                
            case 'silence':
                if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                    const mentionedUser = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    let duration = args[0] || '1h';
                    
                    // If first arg doesn't look like duration, use default and include all args in reason
                    if (!duration.match(/^\d+[hmd]$/)) {
                        duration = '1h';
                    }
                    
                    const silenceResult = await groupInfluence.silenceUser(sock, remoteJid, sender, mentionedUser, duration);
                    await sock.sendMessage(remoteJid, { 
                        text: silenceResult.message,
                        mentions: silenceResult.mentions 
                    });
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .silence @user "1h/1d/30m"'
                    });
                }
                break;
                
            case 'influence':
                const influenceResult = await groupInfluence.findInfluencers(sock, remoteJid);
                await sock.sendMessage(remoteJid, { text: influenceResult.message });
                break;
                
            case 'dominate':
                const count = args[0] || 5;
                const dominateResult = await groupInfluence.dominateChat(sock, remoteJid, sender, count);
                
                // Only send confirmation if not silent
                if (!dominateResult.silent && dominateResult.message) {
                    await sock.sendMessage(remoteJid, { text: dominateResult.message });
                }
                break;
                
            case 'distract':
                const distractionTopic = args.join(' ');
                const distractResult = await groupInfluence.distractGroup(sock, remoteJid, sender, distractionTopic);
                
                // Only send confirmation if not silent
                if (!distractResult.silent && distractResult.message) {
                    await sock.sendMessage(remoteJid, { text: distractResult.message });
                }
                break;
                
            case 'analyze':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                await groupRelationship.showGroupAnalysis(sock, remoteJid);
                break;
                
            case 'activity':
                const timeframe = args[0] || '24h';
                const activityDataResult = await advancedMessaging.trackActivity(sock, remoteJid, timeframe);
                await sock.sendMessage(remoteJid, { text: activityDataResult.message });
                break;
                
            case 'topics':
                const topicsResult = await advancedMessaging.analyzeTopics(sock, remoteJid);
                await sock.sendMessage(remoteJid, { text: topicsResult.message });
                break;
                
            case 'persona':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .persona "style"\nStyles: professional, casual, friendly, funny, sarcastic, poetic'
                    });
                } else {
                    const personaStyle = args[0];
                    const personaResult = await advancedMessaging.setAIPersona(sock, remoteJid, personaStyle);
                    await sock.sendMessage(remoteJid, { text: personaResult.message });
                }
                break;
                
            case 'remember':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .remember "information to remember"'
                    });
                } else {
                    const infoToRemember = args.join(' ');
                    const rememberResult = await advancedMessaging.rememberInfo(sock, remoteJid, sender, infoToRemember);
                    await sock.sendMessage(remoteJid, { text: rememberResult.message });
                }
                break;
                
            case 'recall':
                const recallResult = await advancedMessaging.recallInfo(sock, remoteJid, sender);
                await sock.sendMessage(remoteJid, { text: recallResult.message });
                break;
                
            case 'simulate':
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .simulate "message to send naturally"'
                    });
                } else {
                    const simulatedMessage = args.join(' ');
                    const simulateResult = await advancedMessaging.simulateMessage(sock, remoteJid, sender, simulatedMessage);
                    
                    // Only send confirmation if not silent
                    if (!simulateResult.silent && simulateResult.message) {
                        await sock.sendMessage(remoteJid, { text: simulateResult.message });
                    }
                }
                break;
                
            // Enhanced Analytics Commands
            case 'analytics':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                const analyticsResult = await analytics.showGroupAnalytics(sock, { 
                    remoteJid,
                    isGroup,
                    sender 
                }, args);
                
                await sock.sendMessage(remoteJid, { text: analyticsResult.message });
                break;
                
            case 'useractivity':
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                const userActivityResult = await analytics.showUserActivity(sock, {
                    remoteJid,
                    sender,
                    quotedMsg
                }, args);
                
                await sock.sendMessage(remoteJid, { text: userActivityResult.message });
                break;
                
            case 'cmdstats':
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                const cmdStatsResult = await analytics.showCommandStats(sock, {
                    remoteJid
                }, args);
                
                await sock.sendMessage(remoteJid, { text: cmdStatsResult.message });
                break;
                
            // Enhanced Auto-reply Commands
            case 'autoreply2':
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                const autoReplyResult = await autoReplyCommands.createAutoReply(sock, {
                    remoteJid,
                    sender,
                    isGroup
                }, args);
                
                await sock.sendMessage(remoteJid, { text: autoReplyResult.message });
                break;
                
            case 'delautoreply':
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                if (args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: .delautoreply <rule_id>'
                    });
                    break;
                }
                
                const deleteResult = await autoReplyCommands.deleteAutoReply(sock, {
                    remoteJid,
                    sender
                }, args);
                
                await sock.sendMessage(remoteJid, { text: deleteResult.message });
                break;
                
            case 'listreplies':
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                const listReplyResult = await autoReplyCommands.listAutoReplies(sock, {
                    remoteJid,
                    sender,
                    isGroup
                }, args);
                
                await sock.sendMessage(remoteJid, { text: listReplyResult.message });
                break;
                
            case 'genreply':
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                if (!quotedMsg) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Reply to a message with your desired response after .genreply'
                    });
                    break;
                }
                
                const genResult = await autoReplyCommands.generateAutoReply(sock, {
                    remoteJid,
                    sender,
                    isGroup,
                    quotedMsg
                }, args);
                
                await sock.sendMessage(remoteJid, { text: genResult.message });
                break;
                
            // Enhanced Translation Commands
            case 'translate2':
                if (!quotedMsg || args.length < 1) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Usage: Reply to a message with .translate2 <language>'
                    });
                    break;
                }
                
                const textToTranslate = quotedMsg.conversation || 
                                     quotedMsg.extendedTextMessage?.text || 
                                     quotedMsg.imageMessage?.caption || 
                                     quotedMsg.videoMessage?.caption || '';
                
                if (!textToTranslate) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Cannot translate this type of message.'
                    });
                    break;
                }
                
                try {
                    const targetLang = args[0];
                    const translationLib = require('../lib/translation');
                    const result = await translationLib.translateText(textToTranslate, targetLang);
                    
                    if (result.success) {
                        await sock.sendMessage(remoteJid, { text: result.message });
                        
                        // Record this activity for analytics
                        analyticsLib.recordActivity({
                            sender,
                            group: isGroup ? remoteJid : null,
                            msgType: 'command',
                            timestamp: Date.now(),
                            isCommand: true,
                            command: 'translate2'
                        });
                    } else {
                        await sock.sendMessage(remoteJid, { 
                            text: `⚠️ ${result.message}`
                        });
                    }
                } catch (error) {
                    console.error('Error translating message:', error);
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ An error occurred during translation. Please try again later.'
                    });
                }
                break;
                
            // Group Relationship Analysis Commands
            case 'relationships':
            case 'grouprelation':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                await groupRelationship.showGroupAnalysis(sock, remoteJid);
                break;
                
            case 'clearrelations':
                if (!isGroup) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ This command can only be used in groups.'
                    });
                    break;
                }
                
                if (!isAdmin(normalizedSender)) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ Only admins can use this command.'
                    });
                    break;
                }
                
                await groupRelationship.clearGroupAnalysis(sock, remoteJid, sender);
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
 * Check if user is a bot admin
 */
function isAdmin(number) {
    const normalizedNumber = database.normalizeNumber(number);
    const config = require('../config');
    return config.botAdmins.some(admin => database.normalizeNumber(admin) === normalizedNumber) || isOwner(number);
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
    handleCommand,
    isOwner,
    isAdmin
};
