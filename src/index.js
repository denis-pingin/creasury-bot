import 'regenerator-runtime/runtime.js';
import { config } from './config';
import { Client, Intents, Collection } from 'discord.js';
import * as fs from 'fs';
import { getUserTag, sendLogMessage } from './util';
import handleGuildMemberAdd from './events/guildMemberAdd';
import handleGuildMemberRemove from './events/guildMemberRemove';
import { getDatabase } from './db';

console.log(`Creasury Bot is starting for guild: ${config.guildId}`);

getDatabase().then(db => {
  db.createIndex('members', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'ids' });
  db.createIndex('memberCounters', { 'id': 1, 'guildId': 1 }, { unique: true, name: 'ids' });
});

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

const guildInvites = new Map();

client.once('ready', () => {
  try {
    sendLogMessage(client, 'Creasury Bot ready for action!');
    client.guilds.cache
      .filter(guild => guild.id === config.guildId)
      .forEach(guild => {
        guild.invites.fetch()
          .then(invites => {
            const codeUses = new Map();
            invites.each(inv => codeUses.set(inv.code, inv.uses));

            guildInvites.set(guild.id, codeUses);
            console.log('Invites cached');
          })
          .catch(err => {
            console.log('OnReady Error:', err);
          });
      });
  } catch (err) {
    console.log('OnReady Error:', err);
  }
});

client.on('inviteCreate', async invite => {
  try {
    if (invite.guild.id !== config.guildId) return;

    sendLogMessage(client, `A new invite code ${invite.code} was created by ${getUserTag(invite.inviter)} for channel <#${invite.channel.id}>.`);
    const invites = await invite.guild.invites.fetch();

    const codeUses = new Map();
    invites.each(inv => codeUses.set(inv.code, inv.uses));

    guildInvites.set(invite.guild.id, codeUses);
  } catch (err) {
    console.log('OnInviteCreate Error:', err);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    if (member.guild.id !== config.guildId) return;

    console.log(`Member added: ${getUserTag(member.user)}`);

    const cachedInvites = guildInvites.get(member.guild.id);
    const newInvites = await member.guild.invites.fetch();

    const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
    if (!usedInvite) {
      console.log(`Warning: inviter for member ${getUserTag(member.user)} could not be found`, [...newInvites.values()].map(inv => inv.code), [...cachedInvites.keys()]);
    }

    newInvites.each(inv => cachedInvites.set(inv.code, inv.uses));
    guildInvites.set(member.guild.id, cachedInvites);

    await handleGuildMemberAdd(client, member, usedInvite?.inviter);
  } catch (err) {
    console.log('OnGuildMemberAdd Error:', err);
  }
});

client.on('guildMemberRemove', async member => {
  try {
    if (member.guild.id !== config.guildId) return;

    console.log(`Member removed: ${getUserTag(member.user)}`);

    await handleGuildMemberRemove(client, member);
  } catch (err) {
    console.log('OnGuildMemberRemove Error:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.guild && interaction.guild.id !== config.guildId) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log(`Warn: command not found: ${interaction.commandName}`);
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

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit:true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit:true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit:true }));
