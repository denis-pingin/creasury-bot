require('dotenv').config();

export const config = {
  token: `${process.env.DISCORD_TOKEN}`,
  clientId: `${process.env.DISCORD_CLIENT_ID}`,
  guildId: `${process.env.DISCORD_GUILD_ID}`,
  inviteChannelId: `${process.env.DISCORD_INVITE_CHANNEL_ID}`,
  dbConnectionString: `${process.env.DB_CONNECTION_STRING}`,
  dbName: `${process.env.DB_NAME}`,
  dbInviteTableName: `${process.env.DB_INVITE_TABLE_NAME}`,
};

if (!config.clientId) throw new Error('Client ID not provided');
if (!config.guildId) throw new Error('Guild ID not provided');
if (!config.token) throw new Error('Token not provided');
if (!config.inviteChannelId) throw new Error('Invite channel ID not provided');
if (!config.dbConnectionString) throw new Error('DB connection string not provided');
if (!config.dbName) throw new Error('DB name not provided');
if (!config.dbInviteTableName) throw new Error('DB invite table name not provided');
