# Vryzen Bot Commands Documentation

## General Commands
- `.cmds` - Shows all available commands
- `.help [command]` - Shows detailed help for a specific command
- `.admincmds` - Shows admin-only commands
- `.clear` - Clears the conversation
- `.sticker` - Creates a sticker from media (reply to an image/video)

## Points System Commands
- `.profile` - Shows your profile and points
- `.leaderboard` - Shows the points leaderboard
- `.dailycheck` - Claims your daily bonus points
- `.achievements` - Shows available achievements
- `.pointsinfo` - Shows points system rules and rewards

## Anime Quiz Commands
- `.quiz start/new` - Starts a new quiz
- `.quiz end/stop` - Ends the current quiz
- `.quiz stats` - Shows your quiz statistics
- `.quiz leaderboard/top` - Shows quiz leaderboard
- `.quiz help` - Shows quiz help

## Anime Card Game Commands
- `.card draw` - Draws a new anime card
- `.card inventory/inv` - Shows your card collection
- `.card stats` - Shows card statistics
- `.card trade` - Trades cards with other users
- `.card help` - Shows card game help

## Anime News Commands
- `.animenews [count]` - Shows recent anime news (default: 1)
- `.anime subscribe` - Subscribes to automatic anime news updates
- `.anime unsubscribe` - Unsubscribes from automatic anime news updates

## Group Management Commands
- `.track` - Tracks group changes
- `.active [period]` - Shows active members
- `.detector` - Sets up group activity detector
- `.silence @user [duration]` - Silences a user (e.g., "1h", "1d", "30m")
- `.influence` - Finds group influencers
- `.dominate [count]` - Dominates chat with messages
- `.distract [topic]` - Distracts group with a topic
- `.analyze` - Shows group analysis
- `.activity [timeframe]` - Tracks group activity
- `.topics` - Analyzes group topics

## Admin Commands
- `.ban @user` - Bans a user
- `.removeall` - Removes all members
- `.setname [name]` - Sets group name
- `.setdesc [description]` - Sets group description
- `.adduser [number]` - Adds a user to the group
- `.admins` - Shows group admins
- `.hijack [count]` - Hijacks group with fake members
- `.pmall [message]` - PMs all group members
- `.stagevote [reason]` - Stages a vote
- `.securityalert` - Sends security alert

## Protection Commands
- `.shadowmute` - Shadow mutes a user
- `.evidence` - Collects evidence of violations

## Analytics Commands
- `.useractivity` - Shows user activity (admin only)
- `.cmdstats` - Shows command statistics (admin only)

## Auto-reply Commands
- `.autoreply2` - Creates an auto-reply (admin only)

## Notes
- Commands marked with (admin only) require admin privileges
- Some commands may be restricted in private mode
- Duration formats: h = hours, m = minutes, d = days
- Use @ to mention users in commands
- All commands start with a dot (.) 