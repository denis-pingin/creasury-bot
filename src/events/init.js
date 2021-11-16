import * as db from '../db';

export async function handleInit(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  const members = await guild.members.fetch();
  members.forEach(member => db.initMember(member.user, member.guild.id));
}