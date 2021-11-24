import { SlashCommandBuilder } from '@discordjs/builders';
import { sendLogMessage } from '../util';
import * as guild from '../guild';
import * as discord from '../discord';
import * as stage from '../stage';

export const data = new SlashCommandBuilder()
  .setName('stage')
  .setDescription('Controls stage state.')
  .setDefaultPermission(false)
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Start a stage')
      .addStringOption(option =>
        option.setName('stage_id')
          .setDescription('Stage ID')
          .setRequired(true)));

export async function updatePermissions(client, commandId) {
  await discord.grantCommandPermissionToAdminRole(client, commandId);
  console.log('Permission to use /stage command granted to admin role');
}

export async function execute(interaction) {
  // Get guild config
  const guildConfig = await guild.getGuildConfig(interaction.guild.id);
  if (!guildConfig || !guildConfig.adminRoleId) {
    await interaction.reply('Admin role ID is not configured.');
    return;
  }

  const admin = interaction.member.roles.cache.some(role => role.id === guildConfig.adminRoleId);
  if (!admin) {
    await interaction.reply('This command requires an admin role.');
    return;
  }

  try {
    if (interaction.options.getSubcommand() === 'start') {
      const stageId = interaction.options.get('stage_id').value;

      const startedStage = await stage.startStage(stageId, interaction.guild.id);
      if (startedStage) {
        await sendLogMessage(interaction.client, interaction.guild.id, `Started stage **${startedStage.id}** at ${startedStage.startedAt}`);

        let message = `Big news, @everyone! I am pleased to announce that the stage **${startedStage.id}** has just started! :fire::fire::fire:\n\n`;
        message = `${message}The stage goal is set to reach **${startedStage.goals?.memberCount}** members. Good luck, @everyone!\n`;

        // Announce the new stage
        await interaction.reply(message);
      } else {
        await interaction.reply(`Stage not found: ${stageId}`);
      }
    } else {
      await interaction.reply(`Unknown subcommand: ${interaction.options.getSubcommand()}`);
    }

  } catch (e) {
    await interaction.reply(e.message);
  }
}