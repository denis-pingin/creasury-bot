import { Client, Collection, Intents } from 'discord.js';
import fs from 'fs';
import { getUserTag, logObject, sendLogMessage } from './util';
import * as inviteTracker from './invite-tracker';
import { handleInit } from './events/init';
import { config } from './config';
import handleGuildMemberAdd from './events/guildMemberAdd';
import handleGuildMemberRemove from './events/guildMemberRemove';

export function createClient() {
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
  return client;
}

export function addEventHandlers(client) {
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

      logObject('inviteCreate event:', invite);

      await inviteTracker.handleInviteCreate(invite);

      await sendLogMessage(client, `A new invite code "${invite.code}" was created by ${getUserTag(invite.inviter)} for channel <#${invite.channel.id}>.`);
    } catch (err) {
      logObject('OnInviteCreate error:', err);
    }
  });

  client.on('guildMemberAdd', async member => {
    try {
      if (member.guild.id !== config.guildId) return;

      logObject('guildMemberAdd event:', member);

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

      logObject('guildMemberRemove event:', member);

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
}

export function login(client, token) {
  client.login(token);
}