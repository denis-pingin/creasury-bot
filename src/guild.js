export async function getMembers(guild, guildConfig) {
  const members = await guild.members.fetch();
  return members.filter(m => !m.user.bot && !excludedFromRanking(m.user.id, guildConfig));
}

export function excludedFromRanking(userId, guildConfig) {
  return guildConfig.excludedFromRanking.some(id => id === userId);
}