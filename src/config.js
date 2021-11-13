require('dotenv').config();

export const config = {
  token: `${process.env.DISCORD_TOKEN}`,
  clientId: `${process.env.DISCORD_CLIENT_ID}`,
  guildId: `${process.env.DISCORD_GUILD_ID}`,
  inviteChannelId: `${process.env.DISCORD_INVITE_CHANNEL_ID}`,
  logChannelId: `${process.env.DISCORD_LOG_CHANNEL_ID}`,
  minAccountAge: `${process.env.DISCORD_MIN_ACCOUNT_AGE}`,
  dbConnectionString: `${process.env.DB_CONNECTION_STRING}`,
  dbName: `${process.env.DB_NAME}`,
  dbInviteTableName: `${process.env.DB_INVITE_TABLE_NAME}`,
};

if (!config.clientId) throw new Error('Client ID was not provided');
if (!config.guildId) throw new Error('Guild ID was not provided');
if (!config.token) throw new Error('Token was not provided');
if (!config.inviteChannelId) throw new Error('Invite channel ID was not provided');
if (!config.logChannelId) throw new Error('Log channel ID was not provided');
if (!config.minAccountAge) throw new Error('Min account age was not provided');
if (!config.dbConnectionString) throw new Error('DB connection string was not provided');
if (!config.dbName) throw new Error('DB name was not provided');
if (!config.dbInviteTableName) throw new Error('DB invite table name was not provided');
