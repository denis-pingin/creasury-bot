require('dotenv').config();

export const config = {
	clientId: `${process.env.DISCORD_CLIENT_ID}`,
	guildId: `${process.env.DISCORD_GUILD_ID}`,
	token: `${process.env.DISCORD_TOKEN}`,
	inviteChannelId: `${process.env.DISCORD_INVITE_CHANNEL_ID}`,
};