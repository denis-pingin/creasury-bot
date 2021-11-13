import 'regenerator-runtime/runtime.js';
import { config } from './config';
import { Client, Intents, Collection } from 'discord.js';
import * as fs from 'fs';
import * as db from './db';
import { getUserTag } from './util';

console.log(`Creasury Bot is starting for guild: ${config.guildId}`);

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
    console.log('Creasury Bot ready!');
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

    console.log('New invite link created');
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
    newInvites.each(inv => cachedInvites.set(inv.code, inv.uses));
    guildInvites.set(member.guild.id, cachedInvites);

    db.addMember(member, usedInvite?.inviter);

    let message = `${getUserTag(member.user)} has joined the Creasury community. They were invited by `;
    if (usedInvite) {
      const inviteCount = await db.incrementGlobalInvites(usedInvite.inviter, member.guild.id);
      message += `${getUserTag(usedInvite.inviter)}, who just gained 1 point and now has ${inviteCount} ${inviteCount === 1 ? 'point' : 'points'} in total.`;
    } else {
      message += 'some mysterious force, which some of us might want to investigate.';
      console.log('Warning: inviter could not be found', [...newInvites.values()].map(inv => inv.code), [...cachedInvites.keys()]);
    }

    sendInviteMessage(message);
  } catch (err) {
    console.log('OnGuildMemberAdd Error:', err);
  }
});

client.on('guildMemberRemove', async member => {
  try {
    if (member.guild.id !== config.guildId) return;

    console.log(`Member removed: ${getUserTag(member.user)}`);

    db.removeMember(member);

    let message = `${getUserTag(member.user)} has left the Creasury community. They were invited by `;

    const inviter = await db.getInviter(member);
    if (inviter) {
      const inviteCount = await db.decrementGlobalInvites(inviter, member.guild.id);
      message += `${getUserTag(inviter)}, who just lost 1 point and now has ${inviteCount} ${inviteCount === 1 ? 'point' : 'points'} in total.`;
    } else {
      message += 'some mysterious force, which some of us might want to investigate.';
    }

    sendInviteMessage(message);
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

function sendInviteMessage(message) {
  console.log(message);

  const channel = client.channels.cache.get(config.inviteChannelId);
  if (!channel) {
    console.log('Warning: invite channel not found');
  } else {
    channel.send(message);
  }
}

client.login(config.token);
