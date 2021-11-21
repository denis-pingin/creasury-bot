import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getRewardTag } from '../util';
import { getNextLevelPoints, getRankings } from '../ranking';
import * as guild from '../guild';

const STAGE_CURRENT = 'current';
const STAGE_PREVIOUS = 'previous';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Checks your current stage rank.')
    .addStringOption(option =>
      option.setName('stage')
        .setDescription('Stage selector')
        .setRequired(false)
        .addChoice(STAGE_CURRENT, STAGE_CURRENT)
        .addChoice(STAGE_PREVIOUS, STAGE_PREVIOUS)),
  async execute(interaction) {
    // Get guild config
    const guildConfig = await guild.getGuildConfig(interaction.guildId);
    if (guildConfig && guildConfig.rankAllowedChannelIds &&
      guildConfig.rankAllowedChannelIds.length > 0 &&
      !guildConfig.rankAllowedChannelIds.includes(interaction.channelId)) {
      await interaction.reply(`This command can only be used in ${guildConfig.rankAllowedChannelIds.length === 1 ? 'channel' : 'channels'} ${guildConfig.rankAllowedChannelIds.map(id => `<#${id}> `)}`);
      return;
    }

    const options = interaction.options.get('stage');
    let stageOption = STAGE_CURRENT;
    if (options && options.value) {
      stageOption = options.value;
    }
    console.log(`Get rank for user ${interaction.user.id} and stage ${stageOption}`);

    let stage;
    let message = '';
    if (stageOption === STAGE_CURRENT) {
      stage = await db.getActiveStage(interaction.guildId);
      if (!stage) {
        console.log('Active stage not found.');
        message = 'Currently there is no active stage.';
      }
    } else if (stageOption === STAGE_PREVIOUS) {
      stage = await db.getPreviousStage(interaction.guildId);
      if (!stage) {
        console.log('Previous stage not found.');
        message = 'Previous stage not found.';
      }
    }

    if (stage) {
      console.log(`Rank for the stage "${stage.id}" with levels:`, stage.levels);

      const rankings = await getRankings(stage.id, interaction.guildId);
      if (rankings) {
        // Find member position
        const position = rankings.rankings.findIndex((user) => user.id === interaction.user.id);
        if (position >= 0) {
          const rank = rankings.rankings[position];
          const nextLevelPoints = getNextLevelPoints(rank.level, rankings, stage);

          if (rank.level) {
            // Some level
            let tadas = '';
            for (let i = 0; i < rank.level; i++) tadas = `${tadas}:tada:`;
            message = `Stage **${stage.id}**: you have **${rank.points}** ${rank.points === 1 ? 'point' : 'points'} and your rank is **${rank.position}**. You are a **${getRewardTag(stage, rank.level)}** ${stage.ended ? tadas : 'candidate!'}\n`;
          } else {
            // No level
            message = `Stage **${stage.id}**: You have **${rank.points}** ${rank.points === 1 ? 'point' : 'points'} and your rank is **${rank.position}**. ${stage.ended ? 'You have no achievements in this stage' : 'You need to work harder to earn a reward'}.\n`;
          }
          if (!stage.ended && nextLevelPoints) {
            message = `${message}As of now, you need ${nextLevelPoints} more ${nextLevelPoints === 1 ? 'point' : 'points'} to reach the next level.`;
          }
        } else {
          message = 'Hmmm, cannot find you in the ranking table, this actually shouldn\'t happen. Sorry for that, please contact our support.';
        }
      } else {
        message = `Ranking table for the stage **${stage.id}** does not exist yet.`;
      }
    }
    await interaction.reply(message);
  },
};