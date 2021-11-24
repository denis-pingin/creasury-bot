import * as discord from '../discord';

const { SlashCommandBuilder } = require('@discordjs/builders');

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!')
  .setDefaultPermission(false);

export async function updatePermissions(client, commandId) {
  await discord.grantCommandPermissionToAdminRole(client, commandId);
  console.log('Permission to use /ping command granted to admin role');
}

export async function execute(interaction) {
  await interaction.reply('Pong!');
}

