import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getLeaderboard } from '../ranking';
import { getRewardTag, getUserTag } from '../util';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Prints the stage leaderboard.'),
  async execute(interaction) {
    const stage = await db.getActiveStage();
    let message = '';
    if (!stage) {
      message = 'Currently there is no active event happening.';
    } else {
      console.log(`Active stage is "${stage.id}" with levels:`, stage.levels);
      const leaderboard = await getLeaderboard(stage, interaction.user, interaction.guildId);
      if (leaderboard) {
        message = printLeaderboard(stage, leaderboard);
      } else {
        message = 'Leaderboard does not exist (yet).';
      }
    }
    await interaction.reply(message);
  },
};

function printLeaderboard(stage, leaderboard) {
  let message = `-------------------- Current leaderboard for the event **${stage.id}** --------------------\n`;
  leaderboard.forEach(entry => {
    if (entry.me) {
      message = `${message}**`;
    }

    if (entry.type === 'spacer') {
      message = `${message}...\n`;
    } else {
      message = `${message}${entry.position}. ${getUserTag(entry)} ${entry.points} ${entry.points === 1 ? 'point' : 'points'}, ${entry.level ? '**' + getRewardTag(stage, entry.level, true) + '**' : 'not enough points for a reward'}.`;
      if (entry.me) {
        message = `${message} <== that's you!`;
      }
    }

    if (entry.me) {
      message = `${message}**`;
    }
    message = `${message}\n`;
  });
  return message;
}