import 'regenerator-runtime/runtime.js';
import { config } from './config';
import { Client, Intents, Collection } from 'discord.js';
import * as fs from 'fs';
import * as db from './db';
import { getUserTag } from './util';

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
  console.log('Creasury Bot ready!');
  client.guilds.cache.forEach(guild => {
    guild.invites.fetch()
      .then(invites => {
        console.log('Invites cached');
        const codeUses = new Map();
        invites.each(inv => codeUses.set(inv.code, inv.uses));

        guildInvites.set(guild.id, codeUses);
      })
      .catch(err => {
        console.log('OnReady Error:', err);
      });
  });
});

client.on('inviteCreate', async invite => {
  console.log('New invite link created');
  const invites = await invite.guild.invites.fetch();

  const codeUses = new Map();
  invites.each(inv => codeUses.set(inv.code, inv.uses));

  guildInvites.set(invite.guild.id, codeUses);
});

client.on('guildMemberAdd', async member => {
  console.log(`Member added: ${getUserTag(member.user)}`);
  const cachedInvites = guildInvites.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch();
  try {
    const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
    if (!usedInvite) {
      console.log('Warning: inviter could not be found', [...newInvites.values()].map(inv => inv.code), [...cachedInvites.keys()]);
    } else {
      const message = `User ${getUserTag(member.user)} joined the server, they were invited by ${getUserTag(usedInvite.inviter)}.`;
      sendInviteMessage(message);

      db.addMember(member, usedInvite.inviter);
      db.incrementInvites(usedInvite.inviter, member.guild.id);
    }
  } catch (err) {
    console.log('OnGuildMemberAdd Error:', err);
  }

  newInvites.each(inv => cachedInvites.set(inv.code, inv.uses));
  guildInvites.set(member.guild.id, cachedInvites);
});

client.on('guildMemberRemove', async member => {
  console.log(`Member removed: ${getUserTag(member.user)}`);
  const inviter = await db.getInviter(member);

  let message = `User ${getUserTag(member.user)} left the server, they were invited by `;
  if (inviter) {
    db.removeMember(member);
    db.decrementInvites(inviter, member.guild.id);
    message += `${getUserTag(inviter)}.`;
  } else {
    message += 'some mysterious force.';
  }
  sendInviteMessage(message);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
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
