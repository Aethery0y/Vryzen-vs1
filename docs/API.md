# API Documentation

## Core Modules

### Database Module
```javascript
const database = require('../lib/database');

// User Data
database.getUserData(userId);
database.setUserData(userId, data);
database.updateUserData(userId, callback);

// Group Data
database.getGroupData(groupId);
database.setGroupData(groupId, data);
database.updateGroupData(groupId, callback);

// Bot Settings
database.getBotSettings();
database.updateBotSettings(settings);
```

### Points System
```javascript
const pointsSystem = require('../lib/pointsSystem');

// User Points
pointsSystem.getUserPoints(userId);
pointsSystem.updatePoints(userId, points, reason);
pointsSystem.getUserProfile(userId);

// Leaderboard
pointsSystem.getTopUsers(limit);
pointsSystem.getUserRank(userId);

// Daily Bonus
pointsSystem.grantDailyBonus(userId);
pointsSystem.canClaimDailyBonus(userId);
```

### Anime Quiz
```javascript
const animeQuiz = require('../lib/animeQuiz');

// Quiz Management
animeQuiz.startQuiz(params);
animeQuiz.endQuiz(params);
animeQuiz.getCurrentQuiz(groupId);

// User Stats
animeQuiz.getUserStats(userId);
animeQuiz.updateUserStats(userId, stats);
animeQuiz.getLeaderboard(limit);
```

### Anime Cards
```javascript
const animeCardGame = require('../lib/animeCardGame');

// Card Operations
animeCardGame.drawCard(userId);
animeCardGame.getUserCards(userId);
animeCardGame.tradeCard(fromUserId, toUserId, cardId);

// Collection Stats
animeCardGame.getUserCardStats(userId);
animeCardGame.getCollectionCompletion(userId);
```

## Command Parameters

All command handlers receive a `params` object with:
```javascript
{
    sock: WhatsAppSocket,      // WhatsApp socket instance
    message: Message,          // Original message
    messageContent: string,    // Message text
    sender: string,            // Sender's JID
    remoteJid: string,         // Chat JID
    isGroup: boolean,          // Is group chat
    quotedMsg: Message         // Quoted message (if any)
}
```

## Response Format

Command handlers should return:
```javascript
{
    success: boolean,          // Operation success
    message: string,           // Response message
    data: any,                 // Additional data
    mentions: string[]         // User mentions
}
```

## Error Handling

Use the error handler:
```javascript
const errorHandler = require('../lib/errorHandler');

try {
    // Your code
} catch (error) {
    errorHandler.handle(error, {
        command: 'commandName',
        userId: sender,
        groupId: remoteJid
    });
}
```

## Event System

Subscribe to events:
```javascript
const events = require('../lib/events');

events.on('userJoined', (data) => {
    // Handle user join
});

events.on('messageReceived', (data) => {
    // Handle message
});

events.on('commandExecuted', (data) => {
    // Handle command
});
```

## Utility Functions

### Message Formatting
```javascript
const utils = require('../lib/utils');

// Format user mention
utils.formatMention(userId);

// Format points
utils.formatPoints(points);

// Format time
utils.formatTime(timestamp);
```

### Validation
```javascript
const validator = require('../lib/validator');

// Validate user input
validator.isValidNumber(number);
validator.isValidCommand(command);
validator.hasRequiredPermissions(userId, command);
```

## Rate Limiting

Use the rate limiter:
```javascript
const rateLimiter = require('../lib/rateLimiter');

// Check if user can perform action
if (rateLimiter.canPerformAction(userId, 'command')) {
    // Execute command
}
```

## Logging

Use the logger:
```javascript
const logger = require('../lib/logger');

logger.info('Message', data);
logger.warn('Warning', data);
logger.error('Error', error);
```

## Security

### Permission Levels
```javascript
const permissions = require('../lib/permissions');

permissions.isOwner(userId);
permissions.isAdmin(userId);
permissions.canUseCommand(userId, command);
```

### Content Filtering
```javascript
const contentFilter = require('../lib/contentFilter');

contentFilter.checkMessage(message);
contentFilter.isProfane(text);
contentFilter.isSpam(message);
``` 