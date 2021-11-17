import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getLeaderboard } from '../ranking';
import { getRewardTag, getUserTag } from '../util';

const STAGE_CURRENT = 'current';
const STAGE_PREVIOUS = 'previous';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Prints the stage leaderboard.')
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
    console.log(`Get leaderboard for user ${interaction.user.id} and stage ${stageOption}`);

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
      console.log(`Leaderboard for the stage "${stage.id}" with levels:`, stage.levels);

      const leaderboard = await getLeaderboard(stage, interaction.user, interaction.guildId);
      if (leaderboard) {
        message = printLeaderboard(stage, leaderboard);
      } else {
        message = `Leaderboard for the stage **${stage.id}** does not exist yet.`;
      }
    }

    await interaction.reply(message);
  },
};

function printLeaderboard(stage, leaderboard) {
  let message = `-------------------- Current leaderboard for the stage **${stage.id}** --------------------\n`;
  leaderboard.forEach(entry => {
    if (entry.type === 'spacer') {
      message = `${message}...\n`;
    } else {
      message = `${message}${entry.position}. ${getUserTag(entry)} ${entry.points} ${entry.points === 1 ? 'point' : 'points'}, ${entry.level ? '**' + getRewardTag(stage, entry.level) + '** candidate' : 'not enough points for a reward'}.`;
      if (entry.me) {
        message = `${message} <== that's you!`;
      }
    }
    message = `${message}\n`;
  });
  return message;
}