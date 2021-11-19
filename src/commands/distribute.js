import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getRankings } from '../ranking';
import { getUserTag, logObject, markdownEscape, sendLogMessage } from '../util';
import { config } from '../config';
import { distributeLevelRewards } from '../distribution';

export const data = new SlashCommandBuilder()
  .setName('distribute')
  .setDescription('Initiates reward distribution.')
  .addStringOption(option =>
    option.setName('level')
      .setDescription('Level')
      .setRequired(true));

export async function execute(interaction) {
  const admin = interaction.member.roles.cache.some(role => role.id === config.adminRoleId);
  if (!admin) {
    await interaction.reply('This command requires admin.');
    return;
  }

  const level = interaction.options.get('level').value;
  if (!level) {
    await interaction.reply('Please provide the reward level.');
    return;
  }

  sendLogMessage(interaction.client, `Initiating distribution for level ${level}`);

  const stage = await db.getPreviousStage(interaction.guildId);
  if (!stage) {
    await interaction.reply('Previous stage not found.');
    return;
  }

  const rankings = await getRankings(stage.id, interaction.guild.id);
  if (!rankings) {
    await interaction.reply(`Rankings for the stage ${stage.id} not found`);
    return;
  }

  try {
    const results = await distributeLevelRewards(stage, rankings, level, interaction.guildId);
    logObject('Distribution results:', results);
    const message = buildInviteMessage(stage, level, results);
    interaction.reply(message);
  } catch (e) {
    interaction.reply(e.message);
  }
}

export function buildInviteMessage(stage, level, results) {
  let message = `Attention @everyone, starting reward distribution for the stage **${stage.id}** and level **${level}**.\n\n`;
  // Distributed rewards
  if (results.distributed.length > 0) {
    for (let i = 0; i < results.distributed.length; i++) {
      const reward = results.distributed[i];
      if (reward.winners && reward.winners.length > 0) {
        const winnerTags = reward.winners.map(winner => `${getUserTag({ id: winner })}`);
        message = `${message}Reward **${markdownEscape(reward.id)}** ${reward.winners.length === 1 ? 'winner is' : 'winners are'}: ${winnerTags}. Congratulations!!! :tada::tada::tada:\n\n`;
      } else {
        // No winners
        message = `${message}Reward **${markdownEscape(reward.id)}** winners could not yet be determined.\n\n`;
      }
    }
  }
  // Unclaimed rewards
  if (results.unclaimed.length > 0) {
    for (let i = 0; i < results.unclaimed.length; i++) {
      const reward = results.unclaimed[i];
      if (reward.supply) {
        message = `${message}**${reward.supply} ${markdownEscape(reward.id)}** ${reward.supply === 1 ? 'reward' : 'rewards'} left unclaimed, as there were not enough candidates.\n\n`;
      } else {
        message = `${message}**${markdownEscape(reward.id)}** rewards left unclaimed, as there were not enough candidates.\n\n`;
      }
    }
  }
  // Already distributed
  if (results.distributed.length === 0 && results.unclaimed.length === 0) {
    message = `${message}Oops, it seems all rewards for this level have already been distributed.\n\n`;
  }
  return message;
}