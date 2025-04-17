// WhatsApp Bot using Baileys with Gemini AI integration
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');

// Import modules
const database = require('./lib/database');
const ai = require('./lib/ai');
const animeNews = require('./lib/animeNews'); // Re-enabled news functionality
const profanityFilter = require('./lib/profanityFilter');
const contacts = require('./lib/contacts');
const translation = require('./lib/translation');
const analytics = require('./lib/analytics');
const autoReply = require('./lib/autoReply');
const commandHandler = require('./commands');
const config = require('./config');
const groupRelationship = require('./lib/groupRelationship');
const messageStats = require('./lib/messageStats');
const protectionCommands = require('./commands/protection');

// Protection system libraries
const shadowMute = require('./lib/shadowMute');
const evidenceCollection = require('./lib/evidenceCollection');
// Removed ToS-violating modules:
// const groupTakeover = require('./lib/groupTakeover');
// const groupClone = require('./lib/groupClone');
// Removed betting functionality
// const animeBetting = require('./lib/animeBetting');

// Conversation context map (for short-term memory)
const conversationContext = new Map();

// Track bot connections
let sock = null;
let isConnected = false;
let lastConnectionError = null;
let retryScheduled = false;
let connectionAttempts = 0;
let lastQRCode = null;

// Function to check WhatsApp connection status
function getConnectionStatus() {
    // Check if socket object exists and has user property (indicates logged in)
    const hasUserProperty = sock && sock.user;
    
    // Combine all status flags to determine connection state
    const isActuallyConnected = isConnected && hasUserProperty;
    
    return {
        isConnected: isActuallyConnected,
        sock,
        lastError: lastConnectionError,
        retryScheduled,
        connectionAttempts,
        qrCode: lastQRCode,
        // Add detailed information about connection state
        detail: {
            socketExists: !!sock,
            hasUserProperty: hasUserProperty,
            globalConnectedFlag: isConnected,
            webSocketState: sock?.ws ? sock.ws.readyState : null,
            lastErrorCode: lastConnectionError?.output?.statusCode || 
                         lastConnectionError?.data?.reason || null,
            errorLocation: lastConnectionError?.data?.location || null,
            retryCount: connectionAttempts,
            connected: isActuallyConnected
        },
        lastCheck: Date.now()
    };
}

/**
 * Shared function to check connection before critical operations
 * 
 * @param {string} operation - Name of the operation being performed
 * @returns {Object} Connection status with detailed information
 */
function checkConnectionBeforeAction(operation) {
    const status = getConnectionStatus();
    
    if (!status.isConnected) {
        // Check if this is a 403 error specifically
        const error403 = status.lastError?.output?.statusCode === 403 || 
                       status.lastError?.data?.reason === '403';
        
        if (error403) {
            // Enhanced 403 error handling
            console.error(`Cannot perform ${operation}: WhatsApp connection blocked with 403 error`, 
                status.detail?.errorLocation || '');
            
            return {
                success: false,
                isConnected: false,
                needsConnection: true,
                error403: true,
                detail: {
                    statusCode: 403,
                    errorLocation: status.detail?.errorLocation || 'unknown',
                    retryCount: status.connectionAttempts,
                    retryScheduled: status.retryScheduled
                },
                message: `WhatsApp is currently blocking our connection with a 403 error. The system will automatically reconnect. Please try again in a few minutes.`,
                operation
            };
        }
        
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

// Function to connect to WhatsApp
async function connectToWhatsApp() {
    try {
        // Clean up authentication if we've had too many 403 errors
        if (connectionAttempts > 5 && lastConnectionError?.data?.reason === '403') {
            console.log('Resetting authentication due to persistent 403 errors...');
            
            try {
                // Completely clear auth info directory
                const fs = require('fs').promises;
                const authFiles = await fs.readdir('auth_info_baileys');
                for (const file of authFiles) {
                    await fs.unlink(`auth_info_baileys/${file}`);
                }
                console.log('Authentication files cleared. Will request a new QR code.');
                connectionAttempts = 0; // Reset counter
            } catch (clearError) {
                console.error('Error clearing auth files:', clearError);
            }
        }
        
        console.log('Setting up WhatsApp connection...');
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        // Create socket connection with very simple parameters to avoid detection
        sock = makeWASocket({
            logger: pino({ level: 'silent' }), // Silent logging
            printQRInTerminal: true,
            auth: state,
            browser: ['Chrome', 'Desktop', '93.0.4577.63'], // Use a common Chrome version
            connectTimeoutMs: 20000, // Reduced timeout
            mobile: false,
            // Minimal parameters to avoid triggering detection
            // Remove cloneGroup feature temporarily to reduce complexity
            defaultQueryTimeoutMs: 20000,
            emitOwnEvents: false,
            fireInitQueries: false,
            baileys: {
                hideLog: true 
            }
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // If we received a QR code, log it to console and store it
            if (qr) {
                console.log('QR CODE RECEIVED - Please scan with your WhatsApp app!');
                // Store the QR code for status reporting
                lastQRCode = qr;
                // Reset error tracking when we get a new QR code
                lastConnectionError = null;
                isConnected = false;
                // QRs are already printed to terminal via printQRInTerminal: true
            }
            
            if (connection === 'close') {
                // Fix for connection error handling - properly check Boom error
                let shouldReconnect = true;
                let reconnectDelay = 3000; // Default delay in ms
                
                if (lastDisconnect && lastDisconnect.error) {
                    // Store the last error for diagnostics
                    lastConnectionError = lastDisconnect.error;
                    
                    const statusCode = lastDisconnect.error.output?.statusCode;
                    // Only don't reconnect if explicitly logged out
                    shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    // Add special handling for 403 errors (very common)
                    if (lastDisconnect.error.data?.reason === '403') {
                        console.log('Detected 403 error, will use progressive backoff reconnection strategy...');
                        
                        // For 403 errors, use progressive backoff (exponential up to a limit)
                        // to avoid being blocked by WhatsApp's rate limiters
                        const baseDelay = 5000; // Start with 5 seconds
                        const maxDelay = 60000; // Max 1 minute
                        
                        // Calculate progressive delay with a cap
                        reconnectDelay = Math.min(
                            baseDelay * Math.pow(1.5, Math.min(connectionAttempts, 10)), 
                            maxDelay
                        );
                        
                        // Delete session if we've had too many 403 errors in a row
                        if (connectionAttempts > 5) {
                            console.log('Multiple 403 errors detected. Cleaning up auth session on next connect.');
                            // We'll handle this in the connectToWhatsApp function next time
                        }
                    }
                }
                
                console.log('Connection closed due to', lastDisconnect?.error || 'unknown reason');
                
                // Set connected flag to false
                isConnected = false;
                
                // Track connection attempts
                connectionAttempts++;
                
                // Reconnect if not logged out, with a variable delay
                if (shouldReconnect) {
                    console.log(`Reconnecting in ${reconnectDelay/1000} seconds... (attempt #${connectionAttempts})`);
                    
                    // Track that we've scheduled a retry
                    retryScheduled = true;
                    
                    setTimeout(() => {
                        retryScheduled = false; // Reset when actually trying to connect
                        connectToWhatsApp();
                    }, reconnectDelay);
                } else {
                    // Reset tracking variables if we're not reconnecting
                    retryScheduled = false;
                    lastConnectionError = null;
                }
            } else if (connection === 'open') {
                console.log('WhatsApp bot connected!');
                isConnected = true;
                lastQRCode = null;
                lastConnectionError = null;
                connectionAttempts = 0;
                retryScheduled = false;
                
                // Send startup message to bot owners
                await sendStartupMessage(sock);
                
                // Initialize anime news scheduler
                animeNews.initNewsScheduler(sock);
            }
        });

        // Save credentials whenever they're updated
        sock.ev.on('creds.update', saveCreds);
        
        // Listen for group updates to detect admin changes and potential takeovers
        sock.ev.on('group-participants.update', async (update) => {
            try {
                // Only interested in promote/demote events
                if (update.action === 'promote' || update.action === 'demote') {
                    const groupId = update.id;
                    const participants = update.participants;
                    
                    console.log(`Group admin change detected in ${groupId}: ${update.action} for ${participants.join(', ')}`);
                    
                    // Get current group metadata to check admin status
                    const groupMetadata = await sock.groupMetadata(groupId);
                    const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
                    
                    // Get bot's JID to check if it's an admin
                    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const botIsAdmin = admins.some(admin => admin.id === botNumber);
                    
                    // Check if any bot owners are in the group
                    const ownersInGroup = groupMetadata.participants.filter(p => {
                        const number = p.id.split('@')[0].replace(/:\d+$/, '');
                        return config.botOwners.some(owner => {
                            const normalizedOwner = owner.replace(/^\+/, '');
                            return number === normalizedOwner;
                        });
                    });
                    
                    const ownerIsAdmin = ownersInGroup.some(owner => owner.admin === 'admin' || owner.admin === 'superadmin');
                    
                    // If admins are 1 or less, and the bot is not an admin, and no owners are admins
                    // This indicates a potential hostile takeover
                    if (admins.length <= 1 && !botIsAdmin && !ownerIsAdmin) {
                        console.log(`Potential hostile takeover detected in group ${groupId}! Only ${admins.length} admins left.`);
                        
                        // Removed automatic emergency admin protection (potential ToS violation)
                        // const adminModule = require('./commands/admin');
                        // await adminModule.adminprotect.handler(sock, groupId, botNumber);
                        console.log(`Detected potential admin change in group ${groupId} - not taking automatic action`);
                    }
                    
                    // Removed ToS-violating takeover admin check functionality
                    // if (update.action === 'promote') {
                    //     for (const userJid of participants) {
                    //         protectionCommands.checkAdminGained(groupId, userJid, config);
                    //     }
                    // }
                }
            } catch (error) {
                console.error('Error handling group update event:', error);
            }
        });
        
        // Check for and resume any in-progress contact additions
        const scheduledBatches = database.getData('scheduledContactBatches');
        if (scheduledBatches && scheduledBatches.contacts && scheduledBatches.contacts.length > 0) {
            console.log(`Resuming scheduled contact additions for group ${scheduledBatches.groupId}`);
            setTimeout(() => {
                require('./lib/groupManagement').processNextContactBatch(sock);
            }, 10000); // Give the connection time to stabilize
        }

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                // Skip status updates
                if (message.key.remoteJid === 'status@broadcast') continue;
                
                // Define basic variables needed for message processing
                let remoteJid = message.key.remoteJid;
                let sender = message.key.participant || remoteJid;
                let isGroup = remoteJid.endsWith('@g.us');
                
                // Check if user is silenced (if groupInfluence module exists)
                try {
                    const groupInfluence = require('./commands/groupInfluence');
                    if (groupInfluence.isUserSilenced && groupInfluence.isUserSilenced(remoteJid, sender)) {
                        // Silently ignore this message
                        continue;
                    }
                } catch (error) {
                    // Silently continue if silence check fails
                }
                
                // Get message content
                const messageContent = message.message?.conversation || 
                                      message.message?.extendedTextMessage?.text || 
                                      message.message?.imageMessage?.caption || 
                                      message.message?.videoMessage?.caption || '';
                
                // Check if message is from the bot itself (key.fromMe is true)
                if (message.key.fromMe) {
                    // If it's not a command (doesn't start with '.'), skip processing
                    if (!messageContent.startsWith('.')) {
                        continue;
                    }
                    console.log('Processing command from bot number:', sender);
                }
                // Debugging the message structure for quoted replies
                const contextInfo = message.message?.extendedTextMessage?.contextInfo || 
                                  message.message?.imageMessage?.contextInfo ||
                                  message.message?.videoMessage?.contextInfo ||
                                  message.message?.audioMessage?.contextInfo ||
                                  message.message?.stickerMessage?.contextInfo;
                
                const quotedMsg = contextInfo?.quotedMessage;
                const quotedSender = contextInfo?.participant;
                
                // Print context info details for debugging - extensive debugging
                if (contextInfo) {
                    console.log('Reply Context Info:', {
                        quotedSender,
                        botId: sock.user.id,
                        hasQuotedMsg: Boolean(quotedMsg),
                        stanzaId: contextInfo.stanzaId,
                        participant: contextInfo.participant
                    });
                    
                    // Print full context info for deeper analysis
                    console.log('Full Context Info:', JSON.stringify(contextInfo, null, 2));
                }

                // Check if message is a reply to the bot - using multiple detection methods
                let isReplyToBot = false;
                
                // Print quoted message if available
                if (quotedMsg) {
                    console.log('Quoted Message Type:', Object.keys(quotedMsg)[0]);
                    
                    // Try to extract the text from quoted message (expanded to catch more cases)
                    const quotedText = quotedMsg.conversation || 
                                     quotedMsg.extendedTextMessage?.text ||
                                     quotedMsg.imageMessage?.caption ||
                                     quotedMsg.videoMessage?.caption ||
                                     quotedMsg.documentMessage?.caption ||
                                     quotedMsg.templateMessage?.hydratedTemplate?.hydratedContentText ||
                                     quotedMsg.buttonsMessage?.contentText ||
                                     quotedMsg.listMessage?.description ||
                                     '';
                    
                    if (quotedText) {
                        console.log('Quoted Message Text:', quotedText);
                        
                        // Extra detection: see if this is likely a bot message by content patterns
                        if (
                            // These patterns might indicate bot-generated content
                            quotedText.includes("Thank you for your question") ||
                            quotedText.includes("Here's what I found") ||
                            quotedText.includes("To answer your question") ||
                            quotedText.match(/^(Yes|No|Sure|Absolutely|Indeed|Actually|Well,|Hmm,).*/)
                        ) {
                            console.log("Detected potential bot message pattern in quoted text");
                            isReplyToBot = true;
                        }
                    }
                }
                
                // Method 1: Check by participant JID (improved with more flexible matching)
                if (quotedSender && sock.user.id) {
                    // First try the direct JID comparison
                    if (quotedSender === sock.user.id) {
                        isReplyToBot = true;
                    } else {
                        // Clean the JIDs for comparison by removing any domain or additional info
                        const cleanQuotedSender = quotedSender.split('@')[0].split(':')[0].trim();
                        const cleanBotId = sock.user.id.split('@')[0].split(':')[0].trim();
                        isReplyToBot = cleanQuotedSender === cleanBotId;
                    }
                }
                
                // Method 2: Check if the stanza ID (message ID) belongs to a message sent by the bot
                // This requires tracking sent message IDs, which we could implement if needed
                
                // Method 3: Use config setting to force reply detection if enabled
                // (This is controlled via the config file)
                if (!isReplyToBot && config.messageHandling.forceReplyDetection && contextInfo && contextInfo.stanzaId) {
                    // Force consider all replies as replies to the bot (enabled in config)
                    isReplyToBot = true;
                    console.log('Force reply detection enabled: treating quoted message as reply to bot');
                }
                
                // Check if message is a direct message to bot or a reply to bot or if bot should be mentioned
                // More strict mention detection - using exact username match or explicit mention pattern
                const botUsername = sock.user.id.split('@')[0];
                const botPattern = new RegExp('\\bbot\\b', 'i'); // Word boundary for 'bot'
                
                // Check for any trigger keywords (configured in config.js)
                const triggerKeywords = config.messageHandling.triggerKeywords || ['bot'];
                const messageHasTriggerKeyword = triggerKeywords.some(keyword => 
                  messageContent.toLowerCase().includes(keyword.toLowerCase())
                );
                
                // Bot is mentioned ONLY if directly tagged with @ - stricter detection
                const isBotMentioned = messageContent.toLowerCase().includes('@' + botUsername.toLowerCase());
                
                // Flag for dot commands - they should always be processed regardless of mentions
                const isDotCommand = messageContent.startsWith('.');
                
                // In groups, respond if explicitly mentioned, replied to, or if it's a dot command
                const isDirectToBot = !isGroup || isReplyToBot || isBotMentioned || isDotCommand;
                
                // Only respond to messages where the bot is explicitly mentioned, tagged, or replied to
                const respondToAllGroupMessages = false; // Do not respond to all messages in groups
                
                // Check if message is a command (starts with '.')
                if (messageContent.startsWith('.')) {
                    // Process command
                    await commandHandler.handleCommand({
                        sock,
                        message,
                        messageContent,
                        sender,
                        remoteJid,
                        isGroup,
                        quotedMsg
                    });
                    continue;
                }
                
                // Check for profanity
                const profanityCheck = await profanityFilter.checkMessage(messageContent, sender);
                if (profanityCheck.hasProfanity) {
                    await sock.sendMessage(remoteJid, { 
                        text: profanityCheck.warningMessage,
                        quoted: message 
                    });
                    continue;
                }
                
                // Check if message might be an anime quiz answer (A, B, C, D)
                try {
                    const animeQuizCommands = require('./commands/animeQuiz');
                    
                    // If the message is just a single letter (A,B,C,D) or short option answer
                    if (messageContent.trim().length <= 3) {
                        const isQuizAnswer = await animeQuizCommands.handleQuizAnswer({
                            sock,
                            sender,
                            message,
                            remoteJid, 
                            messageContent
                        });
                        
                        if (isQuizAnswer) {
                            // If it was a quiz answer, don't process further
                            continue;
                        }
                    }
                } catch (error) {
                    console.error('Error processing potential quiz answer:', error);
                }
                
                // Record message activity for analytics
                const messageType = message.message?.imageMessage ? 'image' : 
                                   message.message?.videoMessage ? 'video' :
                                   message.message?.audioMessage ? 'audio' :
                                   message.message?.stickerMessage ? 'sticker' : 'text';
                                   
                analytics.recordActivity({
                    sender,
                    group: isGroup ? remoteJid : null,
                    msgType: messageType,
                    timestamp: Date.now(),
                    isCommand: false
                });
                
                // Record message for statistics and leaderboard
                if (isGroup && messageType === 'text') {
                    messageStats.recordMessage({
                        sender,
                        group: remoteJid,
                        timestamp: Date.now()
                    });
                }
                
                // Record interaction for group relationship analysis
                if (isGroup) {
                    // Extract quoted message sender for relationship tracking
                    const replyTo = message.message?.extendedTextMessage?.contextInfo?.participant;
                    
                    groupRelationship.recordInteraction({
                        sender,
                        group: remoteJid,
                        recipient: null, // Direct interactions not easily detected without NLP
                        replyTo,
                        msgType: messageType,
                        timestamp: Date.now()
                    });
                }
                
                // Check for auto-replies using the new system
                if (messageContent && remoteJid) {
                    try {
                        // Check for auto-replies with the new system first
                        const autoReplyResult = autoReply.processMessage({
                            text: messageContent,
                            isGroup,
                            groupId: isGroup ? remoteJid : null,
                            sender
                        });
                        
                        if (autoReplyResult.match) {
                            await sock.sendMessage(remoteJid, { 
                                text: autoReplyResult.response,
                                quoted: message 
                            });
                            // Track this interaction
                            const numberToTrack = sender.split('@')[0];
                            contacts.trackEngagement(numberToTrack, 1);
                            continue;
                        }
                        
                        // Fall back to the old system if exists
                        try {
                            const advancedMessaging = require('./commands/advancedMessaging');
                            const oldAutoReply = await advancedMessaging.checkAutoReply(messageContent, remoteJid);
                            
                            if (oldAutoReply) {
                                await sock.sendMessage(remoteJid, { 
                                    text: oldAutoReply,
                                    quoted: message 
                                });
                                // Track this interaction
                                const numberToTrack = sender.split('@')[0];
                                contacts.trackEngagement(numberToTrack, 1);
                                continue;
                            }
                        } catch (oldError) {
                            // Old system not available or failed, continue
                        }
                    } catch (error) {
                        // Silently fail if auto-reply check fails - continue to AI processing
                        console.log('Auto-reply check failed:', error.message);
                    }
                }
                
                // Record message for evidence collection if enabled
                if (isGroup) {
                    protectionCommands.processMessageForEvidence(message, remoteJid);
                }
                
                // Check if this message should be filtered due to shadow muting
                const botNumber = sock.user.id;
                const shouldFilter = protectionCommands.shouldFilterMessage(message, botNumber, isGroup ? remoteJid : null);
                
                // Skip further processing if this message is shadow muted for the bot
                if (shouldFilter) {
                    continue;
                }
                
                // Debug logs to understand message addressing
                console.log('Message analysis:', {
                    isGroup,
                    isReplyToBot,
                    isBotMentioned,
                    isDirectToBot,
                    isDotCommand,
                    respondToAllGroupMessages,
                    shouldProcess: isDirectToBot || (isGroup && respondToAllGroupMessages),
                    messageContent: messageContent.substring(0, 50) // First 50 chars only
                });
                
                // Process message with AI if direct message, reply to bot, or if we should respond to all messages in groups
                if (isDirectToBot || (isGroup && respondToAllGroupMessages)) {
                    // Send typing indicator
                    await sock.presenceSubscribe(remoteJid);
                    await sock.sendPresenceUpdate('composing', remoteJid);
                    
                    // Get previous context
                    const chatId = isGroup ? `${remoteJid}-${sender}` : remoteJid;
                    const context = conversationContext.get(chatId) || [];
                    
                    try {
                        // Get AI response
                        console.log('Sending message to AI:', messageContent);
                        const response = await ai.getResponse(messageContent, context);
                        console.log('AI response received successfully');
                        
                        // Update context (keep last 5 messages)
                        let newContext = [];
                        
                        // If there's existing context, preserve it
                        if (context.length > 0) {
                            newContext = [...context.slice(-8)]; // Keep last 4 exchanges (8 messages)
                        }
                        
                        // Add new messages to context
                        newContext.push({ role: 'user', parts: [{ text: messageContent }] });
                        newContext.push({ role: 'model', parts: [{ text: response }] });
                        
                        conversationContext.set(chatId, newContext);
                        
                        // Send response as a reply to the original message
                        await sock.sendMessage(remoteJid, { 
                            text: response,
                            // Add the quoted information to make it a reply
                            quoted: message 
                        });
                    } catch (error) {
                        console.error('Error getting AI response:', error);
                        
                        // Rate limit specific message
                        let errorMessage = '';
                        
                        if (error.message && error.message.includes('429')) {
                            errorMessage = "I'm currently handling too many requests. Please try again in a minute when I'm less busy.";
                        } else if (error.message && error.message.includes('multiple attempts')) {
                            errorMessage = "I'm having trouble connecting to my AI service right now. Please try a simpler question or try again later.";
                        } else {
                            errorMessage = "Sorry, I encountered an error while processing your message. Please try again later.";
                        }
                        
                        // Track this user interaction even if AI failed
                        const senderJid = sender || remoteJid;
                        if (senderJid) {
                            const number = senderJid.split('@')[0];
                            contacts.trackEngagement(number, 1);
                        }
                        
                        await sock.sendMessage(remoteJid, { 
                            text: errorMessage,
                            quoted: message 
                        });
                    }
                }

                // Add this after the message processing starts
                if (!isGroup) {
                    // Check if this is the first interaction
                    const contact = contacts.getContactInfo(sender);
                    if (!contact || !contact.lastInteraction) {
                        await sendWelcomeMessage(sock, remoteJid, sender);
                    }
                }
            }
        });

        // Initialize database
        await database.init();
        
        // Initialize group relationship module
        await groupRelationship.init();
        
        // Initialize message statistics for leaderboard
        await messageStats.init();
        
        // Initialize protection system modules
        try {
            console.log('Initializing protection features...');
            shadowMute.init();
            evidenceCollection.init();
            // Removed groupTakeover and groupClone (violate WhatsApp ToS)
            console.log('Protection features initialized successfully');
        } catch (error) {
            console.error('Error initializing protection features:', error);
        }
        
        // Initialize anime game modules
        try {
            const animeQuiz = require('./lib/animeQuiz');
            const animeCardGame = require('./lib/animeCardGame');
            const pointsSystem = require('./lib/pointsSystem');
            
            console.log('Initializing anime features...');
            pointsSystem.initialize();
            animeQuiz.initialize();
            animeCardGame.initialize();
            // Betting functionality has been removed
            // animeBetting.initialize();
            
            console.log('Anime features initialized successfully');
        } catch (error) {
            console.error('Error initializing anime features:', error);
        }
        
        return sock;
    } catch (err) {
        console.error('Failed to connect to WhatsApp:', err);
        setTimeout(connectToWhatsApp, 10000); // Try to reconnect after 10 seconds
    }
}

// Add welcome message function
async function sendWelcomeMessage(sock, remoteJid, sender) {
    const welcomeMessage = `👋 *Welcome to Vryzen's WhatsApp Bot!*\n\n` +
        `I'm an AI-powered bot created by Vryzen for educational purposes.\n\n` +
        `📺 *Watch the Tutorial:*\n` +
        `Learn how to use me on YouTube: @Vryzen\n\n` +
        `💡 *Quick Start:*\n` +
        `• Type .cmds to see all commands\n` +
        `• Chat normally to talk with AI\n` +
        `• Use .help for detailed guides\n\n` +
        `Enjoy using the bot! 🚀`;
    
    await sock.sendMessage(remoteJid, { text: welcomeMessage });
}

// Add startup message function
async function sendStartupMessage(sock) {
    try {
        if (!config || !config.botOwners || !Array.isArray(config.botOwners)) {
            console.error('Error: Invalid or missing botOwners configuration');
            return;
        }

        // Set bot's profile picture
        try {
            const profilePicPath = path.join(__dirname, 'assets', 'bot_profile.jpg');
            console.log('Attempting to set profile picture from:', profilePicPath);
            
            // Check if file exists
            try {
                await fs.access(profilePicPath);
                console.log('Profile picture file found');
            } catch (error) {
                console.error('Profile picture file not found:', error);
                return;
            }

            const profilePicBuffer = await fs.readFile(profilePicPath);
            console.log('Profile picture loaded successfully');
            
            await sock.updateProfilePicture(sock.user.id, profilePicBuffer);
            console.log('Bot profile picture updated successfully!');
        } catch (error) {
            console.error('Error updating bot profile picture:', error);
        }

        const startupMessage = `🤖 *Vryzen vs1 WhatsApp Bot Started Successfully!*\n\n` +
            `*Created by:* Aether\n\n` +
            `📺 *YouTube Channel:*\n` +
            `https://www.youtube.com/channel/UCK7M5Tn-HQRFMoV17KfqY0Q\n\n` +
            `💬 *WhatsApp Official Channel:*\n` +
            `https://chat.whatsapp.com/LalboDphejQ6CSyaWNEGTk\n\n` +
            `*Bot Features:*\n` +
            `• AI-powered chat\n` +
            `• Anime quiz and card games\n` +
            `• Group management tools\n` +
            `• Auto-reply system\n` +
            `• And much more!\n\n` +
            `*Main Menu:*\n` +
            `1️⃣ *AI Chat* - Chat with AI\n` +
            `2️⃣ *Anime Quiz* - Test your anime knowledge\n` +
            `3️⃣ *Card Collection* - Collect anime cards\n` +
            `4️⃣ *Group Management* - Manage your groups\n` +
            `5️⃣ *Auto-Reply* - Set up automatic responses\n\n` +
            `Type .cmds to see all available commands! 🚀`;
        
        // Send to bot's own number
        const botNumber = sock.user.id.split('@')[0];
        const botJid = `${botNumber}@s.whatsapp.net`;
        await sock.sendMessage(botJid, { text: startupMessage });
        
        // Also send to all bot owners
        for (const owner of config.botOwners) {
            try {
                const ownerJid = `${owner}@s.whatsapp.net`;
                await sock.sendMessage(ownerJid, { text: startupMessage });
            } catch (error) {
                console.error(`Error sending startup message to owner ${owner}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in sendStartupMessage:', error);
    }
}

// Start the bot
connectToWhatsApp();

// Export the connection status and checking functions
module.exports = {
    getConnectionStatus,
    checkConnectionBeforeAction
};
