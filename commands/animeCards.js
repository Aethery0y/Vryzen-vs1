/**
 * Anime Card Game Commands
 * Handles all commands related to the anime card game
 */

const animeCardGame = require('../lib/animeCardGame');
const pointsSystem = require('../lib/pointsSystem');

/**
 * Command handler for drawing a card (.drawcard)
 */
async function handleDrawCardCommand({ sock, sender, message, remoteJid }) {
    // Draw a card for the user
    const drawResult = animeCardGame.drawCard(sender);
    
    if (!drawResult.success) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ ${drawResult.error}`,
            quoted: message 
        });
        return;
    }
    
    // Format the card
    const formattedCard = animeCardGame.formatCard(drawResult.card);
    
    // Create response message
    let response = `*🎴 You drew a new card! 🎴*\n\n`;
    response += formattedCard;
    
    if (drawResult.pointsAwarded > 0) {
        response += `\n\n*+${drawResult.pointsAwarded} points* for drawing a ${drawResult.rarity.name} card!`;
    }
    
    response += `\n\nYou now have ${drawResult.collectionSize} cards in your collection.`;
    
    await sock.sendMessage(remoteJid, { 
        text: response,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for viewing collection (.mycards)
 */
async function handleMyCardsCommand({ sock, sender, message, remoteJid, messageContent }) {
    // Get user's card collection
    const collection = animeCardGame.getUserCards(sender);
    
    if (collection.cards.length === 0) {
        await sock.sendMessage(remoteJid, { 
            text: "You don't have any cards yet! Use *.drawcard* to get your first card.",
            quoted: message 
        });
        return;
    }
    
    // Check if user wants to see a specific card
    const args = messageContent.split(' ').slice(1);
    
    if (args.length > 0 && !isNaN(parseInt(args[0]))) {
        // Show specific card
        const cardIndex = parseInt(args[0]) - 1;
        
        if (cardIndex < 0 || cardIndex >= collection.cards.length) {
            await sock.sendMessage(remoteJid, { 
                text: `❌ Invalid card number. You have ${collection.cards.length} cards (1-${collection.cards.length}).`,
                quoted: message 
            });
            return;
        }
        
        const card = collection.cards[cardIndex];
        const formattedCard = animeCardGame.formatCard(card);
        
        await sock.sendMessage(remoteJid, { 
            text: `*Card #${cardIndex + 1}*\n\n${formattedCard}`,
            quoted: message 
        });
        return;
    }
    
    // Show collection summary
    let response = `*🎴 Your Anime Card Collection 🎴*\n\n`;
    response += `Total Cards: ${collection.stats.total}\n\n`;
    
    response += `*Collection by Rarity:*\n`;
    response += `• Common: ${collection.stats.common}\n`;
    response += `• Uncommon: ${collection.stats.uncommon}\n`;
    response += `• Rare: ${collection.stats.rare}\n`;
    response += `• Epic: ${collection.stats.epic}\n`;
    response += `• Legendary: ${collection.stats.legendary}\n\n`;
    
    // List first 10 cards
    if (collection.cards.length > 0) {
        response += `*Your cards (showing first 10):*\n`;
        
        collection.cards.slice(0, 10).forEach((card, index) => {
            const rarityInfo = Object.values(animeCardGame.RARITIES).find(r => r.id === card.rarity);
            response += `${index + 1}. ${rarityInfo.color} ${card.name} (${card.anime})\n`;
        });
        
        if (collection.cards.length > 10) {
            response += `\n_...and ${collection.cards.length - 10} more cards_`;
        }
    }
    
    // Add draw info
    response += `\n\n*Next card draw:* ${collection.canDraw ? 'Available now!' : collection.nextDraw.toLocaleString()}`;
    response += `\n\n_Use .mycards [number] to view details of a specific card_`;
    
    await sock.sendMessage(remoteJid, { 
        text: response,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for starting a card battle (.cardbattle)
 */
async function handleCardBattleCommand({ sock, sender, message, remoteJid, messageContent }) {
    // Check if there's an opponent mentioned
    const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    
    if (!mentionedJid || mentionedJid.length === 0) {
        await sock.sendMessage(remoteJid, { 
            text: "❌ You need to mention someone to battle with! Example: *.cardbattle @user*",
            quoted: message 
        });
        return;
    }
    
    const opponentJid = mentionedJid[0];
    
    // Start the battle
    const battleResult = animeCardGame.startBattle(remoteJid, sender, opponentJid);
    
    if (!battleResult.success) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ ${battleResult.error}`,
            quoted: message 
        });
        return;
    }
    
    // Format and send challenge message
    const challengerNumber = sender.split('@')[0];
    const opponentNumber = opponentJid.split('@')[0];
    
    const challengeMessage = `*🎴 CARD BATTLE CHALLENGE 🎴*\n\n@${challengerNumber} has challenged @${opponentNumber} to an anime card battle!\n\nChallenger's cards: ${battleResult.challengerCardCount}\nOpponent's cards: ${battleResult.opponentCardCount}\n\n@${opponentNumber}, use *.acceptbattle* to accept this challenge!\n\n_This challenge expires in 5 minutes._`;
    
    await sock.sendMessage(remoteJid, { 
        text: challengeMessage,
        quoted: message,
        mentions: [sender, opponentJid]
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for accepting a card battle (.acceptbattle)
 */
async function handleAcceptBattleCommand({ sock, sender, message, remoteJid }) {
    // Accept the battle
    const acceptResult = animeCardGame.acceptBattle(remoteJid, sender);
    
    if (!acceptResult.success) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ ${acceptResult.error}`,
            quoted: message 
        });
        return;
    }
    
    // Format and send acceptance message
    const challengerCard = acceptResult.challengerCard;
    const opponentCard = acceptResult.opponentCard;
    
    // Get rarity info
    const challengerRarity = Object.values(animeCardGame.RARITIES).find(r => r.id === challengerCard.rarity);
    const opponentRarity = Object.values(animeCardGame.RARITIES).find(r => r.id === opponentCard.rarity);
    
    const acceptMessage = `*🎴 BATTLE ACCEPTED 🎴*\n\nThe battle has begun!\n\n*Challenger's Card:*\n${challengerRarity.color} ${challengerCard.name} (${challengerCard.anime})\n\n*Opponent's Card:*\n${opponentRarity.color} ${opponentCard.name} (${opponentCard.anime})\n\nChallenger, use *.selectstat [stat]* to choose which stat to battle with!\n\nAvailable stats: power, speed, intelligence, special`;
    
    await sock.sendMessage(remoteJid, { 
        text: acceptMessage,
        quoted: message
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for selecting a battle stat (.selectstat)
 */
async function handleSelectStatCommand({ sock, sender, message, remoteJid, messageContent }) {
    // Extract stat from command
    const args = messageContent.split(' ').slice(1);
    
    if (args.length === 0) {
        await sock.sendMessage(remoteJid, { 
            text: "❌ You need to specify which stat to battle with! Example: *.selectstat power*\n\nAvailable stats: power, speed, intelligence, special",
            quoted: message 
        });
        return;
    }
    
    const stat = args[0].toLowerCase();
    
    // Select the stat and get battle result
    const battleResult = animeCardGame.selectBattleStat(remoteJid, sender, stat);
    
    if (!battleResult.success) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ ${battleResult.error}`,
            quoted: message 
        });
        return;
    }
    
    // Format and send battle result
    const challengerCard = battleResult.challengerCard;
    const opponentCard = battleResult.opponentCard;
    
    // Get rarity info
    const challengerRarity = Object.values(animeCardGame.RARITIES).find(r => r.id === challengerCard.rarity);
    const opponentRarity = Object.values(animeCardGame.RARITIES).find(r => r.id === opponentCard.rarity);
    
    // Format stat name
    const statName = battleResult.selectedStat.charAt(0).toUpperCase() + battleResult.selectedStat.slice(1);
    
    // Determine winner text
    let winnerText = '';
    if (battleResult.isDraw) {
        winnerText = "It's a draw! Both cards are equally matched!";
    } else {
        const winnerNumber = battleResult.winner.split('@')[0];
        winnerText = `@${winnerNumber} wins the battle!\n\n+${pointsSystem.POINT_VALUES.GROUP_GAME} points awarded!`;
    }
    
    const resultMessage = `*🎴 BATTLE RESULT 🎴*\n\nStat selected: *${statName}*\n\n*Challenger's Card:*\n${challengerRarity.color} ${challengerCard.name}\n${statName}: ${battleResult.challengerStatValue}\n\n*Opponent's Card:*\n${opponentRarity.color} ${opponentCard.name}\n${statName}: ${battleResult.opponentStatValue}\n\n*${winnerText}*`;
    
    await sock.sendMessage(remoteJid, { 
        text: resultMessage,
        quoted: message,
        mentions: battleResult.isDraw ? [] : [battleResult.winner]
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

/**
 * Command handler for viewing card game help (.cardhelp)
 */
async function handleCardHelpCommand({ sock, sender, message, remoteJid }) {
    const helpText = `*🎴 Anime Card Game Help 🎴*

*Commands:*
• .drawcard - Draw a new anime character card (cooldown: 1 hour)
• .mycards - View your card collection
• .mycards [number] - View details of a specific card
• .cardbattle @user - Challenge someone to a card battle
• .acceptbattle - Accept a card battle challenge
• .selectstat [stat] - Select a stat to battle with
• .cardhelp - Show this help message

*Card Rarities:*
• ⚪ Common - 60% chance
• 🟢 Uncommon - 25% chance
• 🔵 Rare - 10% chance
• 🟣 Epic - 4% chance
• 🟡 Legendary - 1% chance

*Card Stats:*
• Power - Raw strength and attack power
• Speed - Agility and reaction time
• Intelligence - Tactical thinking and knowledge
• Special - Unique abilities and techniques

*Battle Rules:*
1. The challenger selects which stat to battle with
2. The card with the higher stat value wins
3. Rarity provides a stat boost (Legendary cards are 3x stronger!)
4. Winner gets +${pointsSystem.POINT_VALUES.GROUP_GAME} points

Start your collection today with *.drawcard*!`;

    await sock.sendMessage(remoteJid, { 
        text: helpText,
        quoted: message 
    });
    
    // Award points for using the command
    pointsSystem.awardPoints(sender, 'COMMAND', remoteJid);
}

module.exports = {
    handleDrawCardCommand,
    handleMyCardsCommand,
    handleCardBattleCommand,
    handleAcceptBattleCommand,
    handleSelectStatCommand,
    handleCardHelpCommand
};