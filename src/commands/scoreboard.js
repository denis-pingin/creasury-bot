import { SlashCommandBuilder } from '@discordjs/builders';
import * as db from '../db';
import { getScoreboard } from '../ranking';
import { getRewardTag, getUserTag } from '../util';
import * as guild from '../guild';

const STAGE_CURRENT = 'current';
const STAGE_PREVIOUS = 'previous';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scoreboard')
    .setDescription('Prints stage levels and ranking.')
    .addStringOption(option =>
      option.setName('stage')
        .setDescription('Stage selector')
        .setRequired(false)
        .addChoice(STAGE_CURRENT, STAGE_CURRENT)
        .addChoice(STAGE_PREVIOUS, STAGE_PREVIOUS)),
  async execute(interaction) {
    // Get guild config
    const guildConfig = await guild.getGuildConfig(interaction.guildId);
    if (guildConfig && guildConfig.scoreboardAllowedChannelIds &&
      guildConfig.scoreboardAllowedChannelIds.length > 0 &&
      !guildConfig.scoreboardAllowedChannelIds.includes(interaction.channelId)) {
      await interaction.reply(`This command can only be used in ${guildConfig.scoreboardAllowedChannelIds.length === 1 ? 'channel' : 'channels'} ${guildConfig.scoreboardAllowedChannelIds.map(id => `<#${id}> `)}`);
      return;
    }

    const options = interaction.options.get('stage');
    let stageOption = STAGE_CURRENT;
    if (options && options.value) {
      stageOption = options.value;
    }
    console.log(`Get scoreboard for user ${interaction.user.id} and stage ${stageOption}`);

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
      console.log(`Scoreboard for the stage "${stage.id}" with levels:`, stage.levels);

      const scoreboard = await getScoreboard(stage, interaction.user, interaction.guildId);
      if (scoreboard) {
        message = printScoreboard(stage, scoreboard);
      } else {
        message = `Scoreboard for the stage **${stage.id}** does not exist yet.`;
      }
    }

    await interaction.reply({
      content: message,
      allowedMentions: {
        users: [],
      },
    });
  },
};

function printScoreboard(stage, scoreboard) {
  let message = `-------------------- Current scoreboard for the stage **${stage.id}** --------------------\n`;
  scoreboard.forEach(entry => {
    if (entry.type === 'spacer') {
      message = `${message}...\n`;
    } else {
      message = `${message}${entry.position}. ${getUserTag(entry)} ${entry.points} ${entry.points === 1 ? 'point' : 'points'}, ${entry.level ? `**${getRewardTag(stage, entry.level)}**${stage.ended ? '' : ' candidate'}` : 'not enough points for an achievement'}`;
      if (entry.me) {
        message = `${message} <== that's you!`;
      } else {
        message = `${message}.`;
      }
    }
    message = `${message}\n`;
  });
  return message;
}