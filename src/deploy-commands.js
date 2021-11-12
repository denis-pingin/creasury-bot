import * as fs from 'fs';

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
import { config } from './config';

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commands = [];
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(config.token);

rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);