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
const animeNews = require('./lib/animeNews');
const profanityFilter = require('./lib/profanityFilter');
const contacts = require('./lib/contacts');
const translation = require('./lib/translation');
const analytics = require('./lib/analytics');
const autoReply = require('./lib/autoReply');
const commandHandler = require('./commands');
const config = require('./config');
const groupRelationship = require('./lib/groupRelationship');
const messageStats = require('./lib/messageStats');
const animeBetting = require('./lib/animeBetting');

// Conversation context map (for short-term memory)
const conversationContext = new Map();

// Track bot connections
let sock = null;
let isConnected = false;

// Function to connect to WhatsApp
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        // Create socket connection
        sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,
            browser: ['WhatsApp Bot', 'Chrome', '10.0.0']
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const shouldReconnect = 
                    (lastDisconnect.error instanceof Boom)?.output?.statusCode !==
                    DisconnectReason.loggedOut;
                
                console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting:', shouldReconnect);
                
                // Reconnect if not logged out
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('WhatsApp bot connected!');
                isConnected = true;
                
                // Schedule anime news updates
                schedule.scheduleJob('*/10 * * * *', async () => { // Every 10 minutes
                    if (isConnected) {
                        try {
                            await animeNews.sendAnimeNewsUpdates(sock);
                        } catch (error) {
                            console.error('Error sending scheduled anime news:', error);
                        }
                    }
                });
            }
        });

        // Save credentials whenever they're updated
        sock.ev.on('creds.update', saveCreds);
        
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
            }
        });

        // Initialize database
        await database.init();
        
        // Initialize group relationship module
        await groupRelationship.init();
        
        // Initialize message statistics for leaderboard
        await messageStats.init();
        
        // Initialize anime game modules
        try {
            const animeQuiz = require('./lib/animeQuiz');
            const animeCardGame = require('./lib/animeCardGame');
            const pointsSystem = require('./lib/pointsSystem');
            
            console.log('Initializing anime features...');
            pointsSystem.initialize();
            animeQuiz.initialize();
            animeCardGame.initialize();
            animeBetting.initialize();
            
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

// Start the bot
connectToWhatsApp();
