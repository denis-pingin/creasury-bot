import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getRewardTag } from '../util';
import { getMemberRanking } from '../ranking';

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

      const rank = await getMemberRanking(interaction.user.id, stage.id, interaction.guildId);
      if (rank) {
        if (rank.level) {
          // Some level
          let tadas = '';
          for (let i = 0; i < rank.level; i++) tadas = `${tadas}:tada:`;
          message = `Stage **${stage.id}**: you have **${rank.points}** ${rank.points === 1 ? 'point' : 'points'} and your rank is **${rank.position}**. You are a **${getRewardTag(stage, rank.level)}** ${stage.ended ? tadas : 'candidate!'}`;
        } else {
          // No level
          message = `Stage **${stage.id}**: You have **${rank.points}** ${rank.points === 1 ? 'point' : 'points'} and your rank is **${rank.position}**. ${stage.ended ? 'You have no achievements in this stage' : 'You need to work harder to earn a reward'}.`;
        }
      } else {
        message = `Ranking table for the stage **${stage.id}** does not exist yet.`;
      }
    }
    await interaction.reply(message);
  },
};

