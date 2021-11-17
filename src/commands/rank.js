import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getRewardTag } from '../util';
import { getMemberRanking } from '../ranking';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Checks your current stage rank.'),
  async execute(interaction) {
    const stage = await db.getActiveStage(interaction.guildId);
    let message = '';
    if (!stage) {
      message = 'Currently there is no active event happening.';
    } else {
      console.log(`Active stage is "${stage.id}" with levels:`, stage.levels);

      const rank = await getMemberRanking(interaction.user.id, stage.id, interaction.guildId);
      if (rank) {
        if (rank.level) {
          // Some level
          message = `You have **${rank.points}** ${rank.points === 1 ? 'point' : 'points'} and your rank is **${rank.position}**. You are a ${getRewardTag(stage, rank.level, true)}.`;
        } else {
          // No level
          message = `You have **${rank.points}** ${rank.points === 1 ? 'point' : 'points'} and your rank is **${rank.position}**. You need to work harder to earn a reward.`;
        }
      } else {
        message = 'Unfortunately I could not find you in the ranking table.';
      }
    }
    await interaction.reply(message);
  },
};

