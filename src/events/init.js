import * as db from '../db';
import { startStageTimer } from '../stage';

export async function handleInit(client, guildId) {
  const guild = client.guilds.cache.get(guildId);

  // Init members
  const members = await guild.members.fetch();
  members.forEach(member => db.initMember(member.user, member.guild.id));

  // Check stage timer
  const stage = await db.getActiveStage(guildId);
  if (stage && stage.endTime) {
    await startStageTimer(client, stage, guildId, 10000);
  }
}