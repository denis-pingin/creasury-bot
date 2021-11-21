import * as db from './db';

const reloadTime = 10 * 1000;
const guildConfigMap = {};

export async function getGuildConfig(guildId) {
  if (!guildConfigMap[guildId]) {
    guildConfigMap[guildId] = {};
  }
  const timestamp = Date.now();
  if (!guildConfigMap[guildId].updatedAt || timestamp - guildConfigMap[guildId].updatedAt > reloadTime) {
    console.log('Loading guild config from DB');
    guildConfigMap[guildId].value = await db.getGuildConfig(guildId);
    guildConfigMap[guildId].updatedAt = timestamp;
  }
  return guildConfigMap[guildId].value;
}

export async function getMembers(guild, guildConfig) {
  const members = await guild.members.fetch();
  return members.filter(m => !m.user.bot && !excludedFromRanking(m.user.id, guildConfig));
}

export function excludedFromRanking(userId, guildConfig) {
  return guildConfig.excludedFromRanking.some(id => id === userId);
}