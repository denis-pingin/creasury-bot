const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Checks your current stage rank'),
  async execute(interaction) {
    const rank = 'Test';
    await interaction.reply(rank);
  },
};