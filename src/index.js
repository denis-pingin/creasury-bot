import 'regenerator-runtime/runtime.js';
import { config } from './config';
import { Client, Collection, Intents } from 'discord.js';
import * as fs from 'fs';
import { getUserTag, logObject, sendLogMessage } from './util';
import handleGuildMemberAdd from './events/guildMemberAdd';
import handleGuildMemberRemove from './events/guildMemberRemove';
import * as inviteTracker from './invite-tracker';
import * as db from './db';
import { handleInit } from './events/init';
import { deployCommands } from './deploy-commands';

console.log(`Creasury Bot is starting for guild: ${config.guildId}`);

deployCommands();

db.init();

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_BANS, Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS, Intents.FLAGS.GUILD_INTEGRATIONS, Intents.FLAGS.GUILD_WEBHOOKS, Intents.FLAGS.GUILD_INVITES, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MESSAGE_TYPING, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.DIRECT_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGE_TYPING],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync(`${__dirname}/commands`).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
  try {
    await sendLogMessage(client, 'Creasury Bot ready for action!');

    inviteTracker.init(client);

    await handleInit(client, config.guildId);
  } catch (err) {
    logObject('OnReady error:', err);
  }
});

client.on('inviteCreate', async invite => {
  try {
    if (invite.guild.id !== config.guildId) return;

    await inviteTracker.handleInviteCreate(invite);

    await sendLogMessage(client, `A new invite code ${invite.code} was created by ${getUserTag(invite.inviter)} for channel <#${invite.channel.id}>.`);
  } catch (err) {
    logObject('OnInviteCreate error:', err);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    if (member.guild.id !== config.guildId) return;

    const inviter = await inviteTracker.handleJoin(member);

    await sendLogMessage(client, `New member joined ${getUserTag(member.user)} invited by ${getUserTag(inviter)}.`);

    await handleGuildMemberAdd(client, member, inviter);
  } catch (err) {
    logObject('OnGuildMemberAdd error:', err);
  }
});

client.on('guildMemberRemove', async member => {
  try {
    if (member.guild.id !== config.guildId) return;

    await sendLogMessage(client, `Member left: ${getUserTag(member.user)}.`);

    await handleGuildMemberRemove(client, member);
  } catch (err) {
    logObject('OnGuildMemberRemove error:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.guild && interaction.guild.id !== config.guildId) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.warn(`Command not found: ${interaction.commandName}`);
  } else {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

client.login(config.token);

async function exitHandler(options, exitCode) {
  await sendLogMessage(client, 'Creasury Bot is going to rest now.');
  if (exitCode || exitCode === 0) {
    console.log(`Exit code: ${exitCode}`);
  }
  if (options.exit) {
    process.exit();
  }
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup:true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit:true }));

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, { exit:true }));
// process.on('SIGUSR2', exitHandler.bind(null, { exit:true }));
//
// // catches uncaught exceptions
// process.on('uncaughtException', exitHandler.bind(null, { exit:true }));
