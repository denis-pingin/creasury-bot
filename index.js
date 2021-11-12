import { Client, Intents, Collection } from 'discord.js';
import { config } from './config';
import * as fs from 'fs';
const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_BANS, Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS, Intents.FLAGS.GUILD_INTEGRATIONS, Intents.FLAGS.GUILD_WEBHOOKS, Intents.FLAGS.GUILD_INVITES, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MESSAGE_TYPING, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.DIRECT_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGE_TYPING],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

if (!config.clientId) throw new Error('Client ID not provided');
if (!config.guildId) throw new Error('Guild ID not provided');
if (!config.token) throw new Error('Token not provided');
if (!config.inviteChannelId) throw new Error('Invite channel ID not provided');

// Load commands
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

client.once('ready', () => {
	console.log('Creasury Bot ready!');
});

const guildInvites = new Map();

client.on('inviteCreate', async invite => {
	const invites = await invite.guild.invites.fetch();

	const codeUses = new Map();
	invites.each(inv => codeUses.set(inv.code, inv.uses));

	guildInvites.set(invite.guild.id, codeUses);
});

client.once('ready', () => {
	client.guilds.cache.forEach(guild => {
		guild.invites.fetch()
			.then(invites => {
				console.log('INVITES CACHED');
				const codeUses = new Map();
				invites.each(inv => codeUses.set(inv.code, inv.uses));

				guildInvites.set(guild.id, codeUses);
			})
			.catch(err => {
				console.log('OnReady Error:', err);
			});
	});
});

client.on('guildMemberAdd', async member => {
	console.log(`Member added: ${member.user.tag}`);
	const cachedInvites = guildInvites.get(member.guild.id);
	const newInvites = await member.guild.invites.fetch();
	try {
		const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
		// console.log("Cached", [...cachedInvites.keys()])
		// console.log("New", [...newInvites.values()].map(inv => inv.code))
		// console.log("Used", usedInvite)
		// console.log(`The code ${usedInvite.code} was just used by ${member.user.username}.`)

		const channel = client.channels.cache.get(config.inviteChannelId);
		if (!channel) {
			console.log('Warning: invite channel not found');
		}
		else {
			const message = `User ${member.user.tag} joined the server, they were invited by ${usedInvite.inviter.tag}.`;
			console.log(message);
			channel.send(message);
		}
	}
	catch (err) {
		console.log('OnGuildMemberAdd Error:', err);
	}

	newInvites.each(inv => cachedInvites.set(inv.code, inv.uses));
	guildInvites.set(member.guild.id, cachedInvites);
});

client.on('guildMemberRemove', async member => {
	console.log(`Member removed: ${member.user.tag}`);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	}
	catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

// Login to Discord with your client's token
client.login(config.token);
